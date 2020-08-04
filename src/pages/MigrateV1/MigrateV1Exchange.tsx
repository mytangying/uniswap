import { TransactionResponse } from '@ethersproject/abstract-provider'
import { AddressZero } from '@ethersproject/constants'
import { Currency, CurrencyAmount, Fraction, JSBI, Percent, Token, TokenAmount, WETH } from '@uniswap/sdk'
import React, { useCallback, useMemo, useState } from 'react'
import ReactGA from 'react-ga'
import { Redirect, RouteComponentProps } from 'react-router'
import { Text } from 'rebass'
import { ButtonConfirmed } from '../../components/Button'
import { LightCard, PinkCard, YellowCard } from '../../components/Card'
import { AutoColumn } from '../../components/Column'
import CurrencyLogo from '../../components/CurrencyLogo'
import QuestionHelper from '../../components/QuestionHelper'
import { AutoRow, RowBetween, RowFixed } from '../../components/Row'
import { Dots } from '../../components/swap/styleds'
import { DEFAULT_DEADLINE_FROM_NOW, INITIAL_ALLOWED_SLIPPAGE } from '../../constants'
import { MIGRATOR_ADDRESS } from '../../constants/abis/migrator'
import { PairState, usePair } from '../../data/Reserves'
import { useTotalSupply } from '../../data/TotalSupply'
import { useActiveWeb3React } from '../../hooks'
import { useToken } from '../../hooks/Tokens'
import { ApprovalState, useApproveCallback } from '../../hooks/useApproveCallback'
import { useV1ExchangeContract, useV2MigratorContract } from '../../hooks/useContract'
import { NEVER_RELOAD, useSingleCallResult } from '../../state/multicall/hooks'
import { useIsTransactionPending, useTransactionAdder } from '../../state/transactions/hooks'
import { useETHBalances, useTokenBalance } from '../../state/wallet/hooks'
import { BackArrow, ExternalLink, TYPE } from '../../theme'
import { getEtherscanLink, isAddress } from '../../utils'
import { BodyWrapper } from '../AppBody'
import { EmptyState } from './EmptyState'

const POOL_CURRENCY_AMOUNT_MIN = new Fraction(JSBI.BigInt(1), JSBI.BigInt(1000000))
const WEI_DENOM = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(18))
const ZERO = JSBI.BigInt(0)
const ONE = JSBI.BigInt(1)
const ZERO_FRACTION = new Fraction(ZERO, ONE)
const ALLOWED_OUTPUT_MIN_PERCENT = new Percent(JSBI.BigInt(10000 - INITIAL_ALLOWED_SLIPPAGE), JSBI.BigInt(10000))

function FormattedPoolCurrencyAmount({ currencyAmount }: { currencyAmount: CurrencyAmount }) {
  return (
    <>
      {currencyAmount.equalTo(JSBI.BigInt(0))
        ? '0'
        : currencyAmount.greaterThan(POOL_CURRENCY_AMOUNT_MIN)
        ? currencyAmount.toSignificant(4)
        : `<${POOL_CURRENCY_AMOUNT_MIN.toSignificant(1)}`}
    </>
  )
}

export function V1LiquidityInfo({
  token,
  liquidityTokenAmount,
  tokenWorth,
  ethWorth
}: {
  token: Token
  liquidityTokenAmount: TokenAmount
  tokenWorth: TokenAmount
  ethWorth: CurrencyAmount
}) {
  const { chainId } = useActiveWeb3React()

  return (
    <>
      <AutoRow style={{ justifyContent: 'flex-start', width: 'fit-content' }}>
        <CurrencyLogo size="24px" currency={token} />
        <div style={{ marginLeft: '.75rem' }}>
          <TYPE.mediumHeader>
            {<FormattedPoolCurrencyAmount currencyAmount={liquidityTokenAmount} />}{' '}
            {token.equals(WETH[chainId]) ? 'WETH' : token.symbol}/ETH
          </TYPE.mediumHeader>
        </div>
      </AutoRow>

      <RowBetween my="1rem">
        <Text fontSize={16} fontWeight={500}>
          流动池中的 {token.equals(WETH[chainId]) ? 'WETH' : token.symbol}:
        </Text>
        <RowFixed>
          <Text fontSize={16} fontWeight={500} marginLeft={'6px'}>
            {tokenWorth.toSignificant(4)}
          </Text>
          <CurrencyLogo size="20px" style={{ marginLeft: '8px' }} currency={token} />
        </RowFixed>
      </RowBetween>
      <RowBetween mb="1rem">
        <Text fontSize={16} fontWeight={500}>
          流动池中的 ETH:
        </Text>
        <RowFixed>
          <Text fontSize={16} fontWeight={500} marginLeft={'6px'}>
            <FormattedPoolCurrencyAmount currencyAmount={ethWorth} />
          </Text>
          <CurrencyLogo size="20px" style={{ marginLeft: '8px' }} currency={Currency.ETHER} />
        </RowFixed>
      </RowBetween>
    </>
  )
}

function V1PairMigration({ liquidityTokenAmount, token }: { liquidityTokenAmount: TokenAmount; token: Token }) {
  const { account, chainId } = useActiveWeb3React()
  const totalSupply = useTotalSupply(liquidityTokenAmount.token)
  const exchangeETHBalance = useETHBalances([liquidityTokenAmount.token.address])?.[liquidityTokenAmount.token.address]
  const exchangeTokenBalance = useTokenBalance(liquidityTokenAmount.token.address, token)

  const [v2PairState, v2Pair] = usePair(chainId ? WETH[chainId] : undefined, token)
  const isFirstLiquidityProvider: boolean = v2PairState === PairState.NOT_EXISTS

  const v2SpotPrice = v2Pair?.reserveOf(token)?.divide(v2Pair?.reserveOf(WETH[chainId]))

  const [confirmingMigration, setConfirmingMigration] = useState<boolean>(false)
  const [pendingMigrationHash, setPendingMigrationHash] = useState<string | null>(null)

  const shareFraction: Fraction = totalSupply ? new Percent(liquidityTokenAmount.raw, totalSupply.raw) : ZERO_FRACTION

  const ethWorth: CurrencyAmount = exchangeETHBalance
    ? CurrencyAmount.ether(exchangeETHBalance.multiply(shareFraction).multiply(WEI_DENOM).quotient)
    : CurrencyAmount.ether(ZERO)

  const tokenWorth: TokenAmount = exchangeTokenBalance
    ? new TokenAmount(token, shareFraction.multiply(exchangeTokenBalance.raw).quotient)
    : new TokenAmount(token, ZERO)

  const [approval, approve] = useApproveCallback(liquidityTokenAmount, MIGRATOR_ADDRESS)

  const v1SpotPrice =
    exchangeTokenBalance && exchangeETHBalance
      ? exchangeTokenBalance.divide(new Fraction(exchangeETHBalance.raw, WEI_DENOM))
      : null

  const priceDifferenceFraction: Fraction | undefined =
    v1SpotPrice && v2SpotPrice
      ? v1SpotPrice
          .divide(v2SpotPrice)
          .multiply('100')
          .subtract('100')
      : undefined

  const priceDifferenceAbs: Fraction | undefined = priceDifferenceFraction?.lessThan(ZERO)
    ? priceDifferenceFraction?.multiply('-1')
    : priceDifferenceFraction

  const minAmountETH: JSBI | undefined =
    v2SpotPrice && tokenWorth
      ? tokenWorth
          .divide(v2SpotPrice)
          .multiply(WEI_DENOM)
          .multiply(ALLOWED_OUTPUT_MIN_PERCENT).quotient
      : ethWorth?.numerator

  const minAmountToken: JSBI | undefined =
    v2SpotPrice && ethWorth
      ? ethWorth
          .multiply(v2SpotPrice)
          .multiply(JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(token.decimals)))
          .multiply(ALLOWED_OUTPUT_MIN_PERCENT).quotient
      : tokenWorth?.numerator

  const addTransaction = useTransactionAdder()
  const isMigrationPending = useIsTransactionPending(pendingMigrationHash)

  const migrator = useV2MigratorContract()
  const migrate = useCallback(() => {
    if (!minAmountToken || !minAmountETH) return

    setConfirmingMigration(true)
    migrator
      .migrate(
        token.address,
        minAmountToken.toString(),
        minAmountETH.toString(),
        account,
        Math.floor(new Date().getTime() / 1000) + DEFAULT_DEADLINE_FROM_NOW
      )
      .then((response: TransactionResponse) => {
        ReactGA.event({
          category: 'Migrate',
          action: 'V1->V2',
          label: token?.symbol
        })

        addTransaction(response, {
          summary: `Migrate ${token.symbol} liquidity to V2`
        })
        setPendingMigrationHash(response.hash)
      })
      .catch(() => {
        setConfirmingMigration(false)
      })
  }, [minAmountToken, minAmountETH, migrator, token, account, addTransaction])

  const noLiquidityTokens = !!liquidityTokenAmount && liquidityTokenAmount.equalTo(ZERO)

  const largePriceDifference = !!priceDifferenceAbs && !priceDifferenceAbs.lessThan(JSBI.BigInt(5))

  const isSuccessfullyMigrated = !!pendingMigrationHash && !!noLiquidityTokens

  return (
    <AutoColumn gap="20px">
      <TYPE.body my={9} style={{ fontWeight: 400 }}>
        该工具安全地将V1的流动性资产迁移到V2，价格风险最小。这个过程是完全不可信的，多亏了
        <ExternalLink href={getEtherscanLink(chainId, MIGRATOR_ADDRESS, 'address')}>
          <TYPE.blue display="inline">Uniswap 迁移合同↗</TYPE.blue>
        </ExternalLink>
        .
      </TYPE.body>

      {!isFirstLiquidityProvider && largePriceDifference ? (
        <YellowCard>
          <TYPE.body style={{ marginBottom: 8, fontWeight: 400 }}>
            最好将流动性资产以你认为正确的价格存入Uniswap V2。如果V2价格看起来不正确，你可以进行兑换来改变价格或者等待其他人这样做。
          </TYPE.body>
          <AutoColumn gap="8px">
            <RowBetween>
              <TYPE.body>V1 价格:</TYPE.body>
              <TYPE.black>
                {v1SpotPrice?.toSignificant(6)} {token.symbol}/ETH
              </TYPE.black>
            </RowBetween>
            <RowBetween>
              <div />
              <TYPE.black>
                {v1SpotPrice?.invert()?.toSignificant(6)} ETH/{token.symbol}
              </TYPE.black>
            </RowBetween>

            <RowBetween>
              <TYPE.body>V2 价格:</TYPE.body>
              <TYPE.black>
                {v2SpotPrice?.toSignificant(6)} {token.symbol}/ETH
              </TYPE.black>
            </RowBetween>
            <RowBetween>
              <div />
              <TYPE.black>
                {v2SpotPrice?.invert()?.toSignificant(6)} ETH/{token.symbol}
              </TYPE.black>
            </RowBetween>

            <RowBetween>
              <TYPE.body color="inherit">差价:</TYPE.body>
              <TYPE.black color="inherit">{priceDifferenceAbs.toSignificant(4)}%</TYPE.black>
            </RowBetween>
          </AutoColumn>
        </YellowCard>
      ) : null}

      {isFirstLiquidityProvider && (
        <PinkCard>
          <TYPE.body style={{ marginBottom: 8, fontWeight: 400 }}>
            您是Uniswap V2上这对交易对的第一位流动性资金池提供者。 您的流动资金将在当前的V1价格。 您的交易成本还包括创建资金池的费用。
          </TYPE.body>

          <AutoColumn gap="8px">
            <RowBetween>
              <TYPE.body>V1 价格:</TYPE.body>
              <TYPE.black>
                {v1SpotPrice?.toSignificant(6)} {token.symbol}/ETH
              </TYPE.black>
            </RowBetween>
            <RowBetween>
              <div />
              <TYPE.black>
                {v1SpotPrice?.invert()?.toSignificant(6)} ETH/{token.symbol}
              </TYPE.black>
            </RowBetween>
          </AutoColumn>
        </PinkCard>
      )}

      <LightCard>
        <V1LiquidityInfo
          token={token}
          liquidityTokenAmount={liquidityTokenAmount}
          tokenWorth={tokenWorth}
          ethWorth={ethWorth}
        />

        <div style={{ display: 'flex', marginTop: '1rem' }}>
          <AutoColumn gap="12px" style={{ flex: '1', marginRight: 12 }}>
            <ButtonConfirmed
              confirmed={approval === ApprovalState.APPROVED}
              disabled={approval !== ApprovalState.NOT_APPROVED}
              onClick={approve}
            >
              {approval === ApprovalState.PENDING ? (
                <Dots>授权中</Dots>
              ) : approval === ApprovalState.APPROVED ? (
                '已授权'
              ) : (
                '授权'
              )}
            </ButtonConfirmed>
          </AutoColumn>
          <AutoColumn gap="12px" style={{ flex: '1' }}>
            <ButtonConfirmed
              confirmed={isSuccessfullyMigrated}
              disabled={
                isSuccessfullyMigrated ||
                noLiquidityTokens ||
                isMigrationPending ||
                approval !== ApprovalState.APPROVED ||
                confirmingMigration
              }
              onClick={migrate}
            >
              {isSuccessfullyMigrated ? '成功' : isMigrationPending ? <Dots>迁移中</Dots> : '迁移'}
            </ButtonConfirmed>
          </AutoColumn>
        </div>
      </LightCard>
      <TYPE.darkGray style={{ textAlign: 'center' }}>
        {`你的 Uniswap V1 ${token.symbol}/ETH 流动资金 将会变成 Uniswap V2 ${token.symbol}/ETH 流动资金.`}
      </TYPE.darkGray>
    </AutoColumn>
  )
}

export default function MigrateV1Exchange({
  history,
  match: {
    params: { address }
  }
}: RouteComponentProps<{ address: string }>) {
  const validatedAddress = isAddress(address)
  const { chainId, account } = useActiveWeb3React()

  const exchangeContract = useV1ExchangeContract(validatedAddress ? validatedAddress : undefined)
  const tokenAddress = useSingleCallResult(exchangeContract, 'tokenAddress', undefined, NEVER_RELOAD)?.result?.[0]

  const token = useToken(tokenAddress)

  const liquidityToken: Token | undefined = useMemo(
    () =>
      validatedAddress && token
        ? new Token(chainId, validatedAddress, 18, `UNI-V1-${token.symbol}`, 'Uniswap V1')
        : undefined,
    [chainId, validatedAddress, token]
  )
  const userLiquidityBalance = useTokenBalance(account, liquidityToken)

  // redirect for invalid url params
  if (!validatedAddress || tokenAddress === AddressZero) {
    console.error('路径中的地址无效', address)
    return <Redirect to="/migrate/v1" />
  }

  return (
    <BodyWrapper style={{ padding: 24 }}>
      <AutoColumn gap="16px">
        <AutoRow style={{ alignItems: 'center', justifyContent: 'space-between' }} gap="8px">
          <BackArrow to="/migrate/v1" />
          <TYPE.mediumHeader>迁移V1流动性</TYPE.mediumHeader>
          <div>
            <QuestionHelper text="将您的流动性代币从 Uniswap V1 迁移到 Uniswap V2。" />
          </div>
        </AutoRow>

        {!account ? (
          <TYPE.largeHeader>您必须连接一个账号</TYPE.largeHeader>
        ) : validatedAddress && token?.equals(WETH[chainId]) ? (
          <>
            <TYPE.body my={9} style={{ fontWeight: 400 }}>
              由于Uniswap V2在后台使用WETH，因此您的Uniswap V1 WETH/ETH流动性无法迁移。 您可能想取消您的流动性。
            </TYPE.body>

            <ButtonConfirmed
              onClick={() => {
                history.push(`/remove/v1/${validatedAddress}`)
              }}
            >
              移除
            </ButtonConfirmed>
          </>
        ) : userLiquidityBalance && token ? (
          <V1PairMigration liquidityTokenAmount={userLiquidityBalance} token={token} />
        ) : (
          <EmptyState message="加载中..." />
        )}
      </AutoColumn>
    </BodyWrapper>
  )
}
