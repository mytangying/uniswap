import { CurrencyAmount, JSBI,Currency,Token,ETHER} from '@uniswap/sdk'
import React, { useCallback, useContext, useEffect, useState } from 'react'
import { ArrowDown } from 'react-feather'
import ReactGA from 'react-ga'
import { Text } from 'rebass'
import { ThemeContext } from 'styled-components'
import AddressInputPanel from '../../components/AddressInputPanel'
import { ButtonError, ButtonLight, ButtonPrimary } from '../../components/Button'
import Card, { GreyCard } from '../../components/Card'
import { AutoColumn } from '../../components/Column'
import ConfirmationModal from '../../components/ConfirmationModal'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import { SwapPoolTabs } from '../../components/NavigationTabs'
import { AutoRow, RowBetween } from '../../components/Row'
import AdvancedSwapDetailsDropdown from '../../components/swap/AdvancedSwapDetailsDropdown'
import BetterTradeLink from '../../components/swap/BetterTradeLink'
import confirmPriceImpactWithoutFee from '../../components/swap/confirmPriceImpactWithoutFee'
import { ArrowWrapper, BottomGrouping, Dots, Wrapper } from '../../components/swap/styleds'
import SwapModalFooter from '../../components/swap/SwapModalFooter'
import SwapModalHeader from '../../components/swap/SwapModalHeader'
import TradePrice from '../../components/swap/TradePrice'
import { TokenWarningCards } from '../../components/TokenWarningCard'
import { BETTER_TRADE_LINK_THRESHOLD, INITIAL_ALLOWED_SLIPPAGE } from '../../constants'
import { getTradeVersion, isTradeBetter } from '../../data/V1'
import { useActiveWeb3React } from '../../hooks'
// import { useCurrency } from '../../hooks/Tokens'
import { ApprovalState, useApproveCallbackFromTrade } from '../../hooks/useApproveCallback'
import useENSAddress from '../../hooks/useENSAddress'
import { useSwapCallback } from '../../hooks/useSwapCallback'
import useToggledVersion, { Version } from '../../hooks/useToggledVersion'
import useWrapCallback, { WrapType } from '../../hooks/useWrapCallback'
import { useToggleSettingsMenu, useWalletModalToggle } from '../../state/application/hooks'
import { Field } from '../../state/swap/actions'
import {
  useDefaultsFromURLSearch,
  useDerivedSwapInfo,
  useSwapActionHandlers,
  useSwapState
} from '../../state/swap/hooks'
import {
  useExpertModeManager,
  useUserDeadline,
  useUserSlippageTolerance,
  useTokenWarningDismissal
} from '../../state/user/hooks'
import { CursorPointer, LinkStyledButton, TYPE, MaxWidthWrapper, NullWrapper} from '../../theme'
import { maxAmountSpend } from '../../utils/maxAmountSpend'
import { computeSlippageAdjustedAmounts, computeTradePriceBreakdown, warningSeverity } from '../../utils/prices'
import AppBody from '../AppBody'
import { ClickableText } from '../Pool/styleds'

// 分享
import Share from '../../components/Share'

// 更新k线图表信息依赖
import Toggle from '../../components/Toggle'
import { useChartModeManager } from '../../state/user/hooks'
import PairPage from '../../components/PairPage'
import TokenDataContextProvider from '../../contexts/TokenData'
import GlobalDataContextProvider from '../../contexts/GlobalData'
import PairDataContextProvider from '../../contexts/PairData'

import {usePair} from '../../data/Reserves'

// 更新k线图表信息
function ContextProviders({ children }) {
  return (
    <TokenDataContextProvider>
      <GlobalDataContextProvider>
        <PairDataContextProvider>{children}</PairDataContextProvider>
      </GlobalDataContextProvider>
    </TokenDataContextProvider>
  )
}

// 获取代币地址
function currencyKey(currency: Currency): string {
  return currency instanceof Token ? currency.address.toLowerCase() : currency === ETHER ? '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2':'';
}

export default function Swap(props) {
  const [chartMode, toggleChartMode] = useChartModeManager()

  useDefaultsFromURLSearch()

  const { account, chainId } = useActiveWeb3React()
  const theme = useContext(ThemeContext)

  // toggle wallet when disconnected
  const toggleWalletModal = useWalletModalToggle()

  // for expert mode
  const toggleSettings = useToggleSettingsMenu()
  const [expertMode] = useExpertModeManager()

  // get custom setting values for user
  const [deadline] = useUserDeadline()
  const [allowedSlippage] = useUserSlippageTolerance()

  // swap state
  const { independentField, typedValue, recipient } = useSwapState()
  const { v1Trade, v2Trade, currencyBalances, parsedAmount, currencies, error } = useDerivedSwapInfo()
  const { wrapType, execute: onWrap, error: wrapError } = useWrapCallback(
    currencies[Field.INPUT],
    currencies[Field.OUTPUT],
    typedValue
  )
  const showWrap: boolean = wrapType !== WrapType.NOT_APPLICABLE
  const { address: recipientAddress } = useENSAddress(recipient)
  const toggledVersion = useToggledVersion()

  const trade = showWrap
    ? undefined
    : {
        [Version.v1]: v1Trade,
        [Version.v2]: v2Trade
      }[toggledVersion]

  const betterTradeLinkVersion: Version | undefined =
    toggledVersion === Version.v2 && isTradeBetter(v2Trade, v1Trade, BETTER_TRADE_LINK_THRESHOLD)
      ? Version.v1
      : toggledVersion === Version.v1 && isTradeBetter(v1Trade, v2Trade)
      ? Version.v2
      : undefined
  const parsedAmounts = showWrap
    ? {
        [Field.INPUT]: parsedAmount,
        [Field.OUTPUT]: parsedAmount
      }
    : {
        [Field.INPUT]: independentField === Field.INPUT ? parsedAmount : trade?.inputAmount,
        [Field.OUTPUT]: independentField === Field.OUTPUT ? parsedAmount : trade?.outputAmount
      }

  const { onSwitchTokens, onCurrencySelection, onUserInput, onChangeRecipient } = useSwapActionHandlers()
  const isValid = !error
  const dependentField: Field = independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT

  const handleTypeInput = useCallback(
    (value: string) => {
      onUserInput(Field.INPUT, value)
    },
    [onUserInput]
  )
  const handleTypeOutput = useCallback(
    (value: string) => {
      onUserInput(Field.OUTPUT, value)
    },
    [onUserInput]
  )

  // modal and loading
  const [showConfirm, setShowConfirm] = useState<boolean>(false) // show confirmation modal
  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // waiting for user confirmaion/rejection
  const [txHash, setTxHash] = useState<string>('')

  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]: showWrap
      ? parsedAmounts[independentField]?.toExact() ?? ''
      : parsedAmounts[dependentField]?.toSignificant(6) ?? ''
  }

  const route = trade?.route
  const userHasSpecifiedInputOutput = Boolean(
    currencies[Field.INPUT] && currencies[Field.OUTPUT] && parsedAmounts[independentField]?.greaterThan(JSBI.BigInt(0))
  )
  const noRoute = !route

  // check whether the user has approved the router on the input token
  const [approval, approveCallback] = useApproveCallbackFromTrade(trade, allowedSlippage)

  // check if user has gone through approval process, used to show two step buttons, reset on token change
  const [approvalSubmitted, setApprovalSubmitted] = useState<boolean>(false)

  // mark when a user has submitted an approval, reset onTokenSelection for input field
  useEffect(() => {
    if (approval === ApprovalState.PENDING) {
      setApprovalSubmitted(true)
    }
  }, [approval, approvalSubmitted])

  const maxAmountInput: CurrencyAmount | undefined = maxAmountSpend(currencyBalances[Field.INPUT])
  const atMaxAmountInput = Boolean(maxAmountInput && parsedAmounts[Field.INPUT]?.equalTo(maxAmountInput))

  const slippageAdjustedAmounts = computeSlippageAdjustedAmounts(trade, allowedSlippage)

  // the callback to execute the swap
  const swapCallback = useSwapCallback(trade, allowedSlippage, deadline, recipient)

  const { priceImpactWithoutFee, realizedLPFee } = computeTradePriceBreakdown(trade)

  function onSwap() {
    if (priceImpactWithoutFee && !confirmPriceImpactWithoutFee(priceImpactWithoutFee)) {
      return
    }
    if (!swapCallback) {
      return
    }
    setAttemptingTxn(true)
    swapCallback()
      .then(hash => {
        setAttemptingTxn(false)
        setTxHash(hash)

        ReactGA.event({
          category: 'Swap',
          action:
            recipient === null
              ? 'Swap w/o Send'
              : (recipientAddress ?? recipient) === account
              ? 'Swap w/o Send + recipient'
              : 'Swap w/ Send',
          label: [
            trade?.inputAmount?.currency?.symbol,
            trade?.outputAmount?.currency?.symbol,
            getTradeVersion(trade)
          ].join('/')
        })
      })
      .catch(error => {
        setAttemptingTxn(false)
        // we only care if the error is something _other_ than the user rejected the tx
        if (error?.code !== 4001) {
          console.error(error)
        }
      })
  }

  // errors
  const [showInverted, setShowInverted] = useState<boolean>(false)

  // warnings on slippage
  const priceImpactSeverity = warningSeverity(priceImpactWithoutFee)

  // show approve flow when: no error on inputs, not approved or pending, or approved in current session
  // never show if price impact is above threshold in non expert mode
  const showApproveFlow =
    !error &&
    (approval === ApprovalState.NOT_APPROVED ||
      approval === ApprovalState.PENDING ||
      (approvalSubmitted && approval === ApprovalState.APPROVED)) &&
    !(priceImpactSeverity > 3 && !expertMode)

  function modalHeader() {
    return (
      <SwapModalHeader
        currencies={currencies}
        formattedAmounts={formattedAmounts}
        slippageAdjustedAmounts={slippageAdjustedAmounts}
        priceImpactSeverity={priceImpactSeverity}
        independentField={independentField}
        recipient={recipient}
      />
    )
  }

  function modalBottom() {
    return (
      <SwapModalFooter
        confirmText={priceImpactSeverity > 2 ? '仍然兑换' : '确认兑换'}
        showInverted={showInverted}
        severity={priceImpactSeverity}
        setShowInverted={setShowInverted}
        onSwap={onSwap}
        realizedLPFee={realizedLPFee}
        parsedAmounts={parsedAmounts}
        priceImpactWithoutFee={priceImpactWithoutFee}
        slippageAdjustedAmounts={slippageAdjustedAmounts}
        trade={trade}
      />
    )
  }

  // 设置默认输出代币
  // const {
  //   location: {
  //     search: outputCurrency
  //   },
  // } = props;

  // const MATHCurreny = useCurrency('0x08d967bb0134F2d07f7cfb6E246680c53927DD30');

  // if((!outputCurrency || !outputCurrency.replace('?outputCurrency=','')) && !currencies[Field.OUTPUT]){
  //   onCurrencySelection(Field.OUTPUT, MATHCurreny);
  // }


  // text to show while loading
  const pendingText = `将 ${parsedAmounts[Field.INPUT]?.toSignificant(6)} ${
    currencies[Field.INPUT]?.symbol
  } 兑换为 ${parsedAmounts[Field.OUTPUT]?.toSignificant(6)} ${currencies[Field.OUTPUT]?.symbol}`

  const [dismissedToken0] = useTokenWarningDismissal(chainId, currencies[Field.INPUT])
  const [dismissedToken1] = useTokenWarningDismissal(chainId, currencies[Field.OUTPUT])
  const showWarning =
    (!dismissedToken0 && !!currencies[Field.INPUT]) || (!dismissedToken1 && !!currencies[Field.OUTPUT])

  const pairAddress = usePair(currencies[Field.INPUT] ,currencies[Field.OUTPUT])[1]?.liquidityToken?.address.toLowerCase();

  return (
    <>
      {showWarning && <TokenWarningCards currencies={currencies} />}
      <AppBody disabled={!!showWarning}>
        <SwapPoolTabs active={'swap'} />
        <Wrapper id="swap-page">
          <ConfirmationModal
            isOpen={showConfirm}
            title="确认兑换"
            onDismiss={() => {
              setShowConfirm(false)
              // if there was a tx hash, we want to clear the input
              if (txHash) {
                onUserInput(Field.INPUT, '')
              }
              setTxHash('')
            }}
            attemptingTxn={attemptingTxn}
            hash={txHash}
            topContent={modalHeader}
            bottomContent={modalBottom}
            pendingText={pendingText}
          />

          <AutoColumn gap={'md'}>
            <CurrencyInputPanel
              label={independentField === Field.OUTPUT && !showWrap ? '输入 (预估)' : '输入'}
              value={formattedAmounts[Field.INPUT]}
              showMaxButton={!atMaxAmountInput}
              currency={currencies[Field.INPUT]}
              onUserInput={handleTypeInput}
              onMax={() => {
                maxAmountInput && onUserInput(Field.INPUT, maxAmountInput.toExact())
              }}
              onCurrencySelect={currency => {
                setApprovalSubmitted(false) // reset 2 step UI for approvals
                onCurrencySelection(Field.INPUT, currency)
              }}
              otherCurrency={currencies[Field.OUTPUT]}
              id="swap-currency-input"
            />

            <CursorPointer>
              <AutoColumn justify="space-between">
                <AutoRow justify="space-between" style={{ padding: '0 1rem' }}>
                  <ArrowWrapper clickable>
                    <ArrowDown
                      size="16"
                      onClick={() => {
                        setApprovalSubmitted(false) // reset 2 step UI for approvals
                        onSwitchTokens()
                      }}
                      color={currencies[Field.INPUT] && currencies[Field.OUTPUT] ? theme.primary1 : theme.text2}
                    />
                  </ArrowWrapper>
                  {recipient === null && !showWrap ? (
                    <LinkStyledButton id="add-recipient-button" onClick={() => onChangeRecipient('')}>
                      + 添加发送（可选）
                    </LinkStyledButton>
                  ) : null}
                </AutoRow>
              </AutoColumn>
            </CursorPointer>
            <CurrencyInputPanel
              value={formattedAmounts[Field.OUTPUT]}
              onUserInput={handleTypeOutput}
              label={independentField === Field.INPUT && !showWrap ? '输出 (预估)' : '输出'}
              showMaxButton={false}
              currency={currencies[Field.OUTPUT]}
              onCurrencySelect={address => onCurrencySelection(Field.OUTPUT, address)}
              otherCurrency={currencies[Field.INPUT]}
              id="swap-currency-output"
            />

            {recipient !== null && !showWrap ? (
              <>
                <AutoRow justify="space-between" style={{ padding: '0 1rem' }}>
                  <ArrowWrapper clickable={false}>
                    <ArrowDown size="16" color={theme.text2} />
                  </ArrowWrapper>
                  <LinkStyledButton id="remove-recipient-button" onClick={() => onChangeRecipient(null)}>
                    - 删除发送
                  </LinkStyledButton>
                </AutoRow>
                <AddressInputPanel id="recipient" value={recipient} onChange={onChangeRecipient} />
              </>
            ) : null}

            {showWrap ? null : (
              <Card padding={'.25rem .75rem 0 .75rem'} borderRadius={'20px'}>
                <AutoColumn gap="4px">
                  <RowBetween align="center">
                    <Text fontWeight={500} fontSize={14} color={theme.text2}>
                      价格
                    </Text>
                    <TradePrice
                      inputCurrency={currencies[Field.INPUT]}
                      outputCurrency={currencies[Field.OUTPUT]}
                      price={trade?.executionPrice}
                      showInverted={showInverted}
                      setShowInverted={setShowInverted}
                    />
                  </RowBetween>

                  {allowedSlippage !== INITIAL_ALLOWED_SLIPPAGE && (
                    <RowBetween align="center">
                      <ClickableText fontWeight={500} fontSize={14} color={theme.text2} onClick={toggleSettings}>
                        滑点限制
                      </ClickableText>
                      <ClickableText fontWeight={500} fontSize={14} color={theme.text2} onClick={toggleSettings}>
                        {allowedSlippage ? allowedSlippage / 100 : '-'}%
                      </ClickableText>
                    </RowBetween>
                  )}
                </AutoColumn>
              </Card>
            )}
          </AutoColumn>
          <BottomGrouping>
            {!account ? (
              <ButtonLight onClick={toggleWalletModal}>连接钱包</ButtonLight>
            ) : showWrap ? (
              <ButtonPrimary disabled={Boolean(wrapError)} onClick={onWrap}>
                {wrapError ?? (wrapType === WrapType.WRAP ? 'Wrap' : wrapType === WrapType.UNWRAP ? 'Unwrap' : null)}
              </ButtonPrimary>
            ) : noRoute && userHasSpecifiedInputOutput ? (
              <GreyCard style={{ textAlign: 'center' }}>
                <TYPE.main mb="4px">该交易的流动性不足。</TYPE.main>
              </GreyCard>
            ) : showApproveFlow ? (
              <RowBetween>
                <ButtonPrimary
                  onClick={approveCallback}
                  disabled={approval !== ApprovalState.NOT_APPROVED || approvalSubmitted}
                  width="48%"
                  altDisbaledStyle={approval === ApprovalState.PENDING} // show solid button while waiting
                >
                  {approval === ApprovalState.PENDING ? (
                    <Dots>授权中</Dots>
                  ) : approvalSubmitted && approval === ApprovalState.APPROVED ? (
                    '已授权'
                  ) : (
                    '授权 ' + currencies[Field.INPUT]?.symbol
                  )}
                </ButtonPrimary>
                <ButtonError
                  onClick={() => {
                    expertMode ? onSwap() : setShowConfirm(true)
                  }}
                  width="48%"
                  id="swap-button"
                  disabled={!isValid || approval !== ApprovalState.APPROVED || (priceImpactSeverity > 3 && !expertMode)}
                  error={isValid && priceImpactSeverity > 2}
                >
                  <Text fontSize={16} fontWeight={500}>
                    {priceImpactSeverity > 3 && !expertMode
                      ? `价格滑点高`
                      : `${priceImpactSeverity > 2 ? '仍然兑换' : '兑换'}`}
                  </Text>
                </ButtonError>
              </RowBetween>
            ) : (
              <ButtonError
                onClick={() => {
                  expertMode ? onSwap() : setShowConfirm(true)
                }}
                id="swap-button"
                disabled={!isValid || (priceImpactSeverity > 3 && !expertMode)}
                error={isValid && priceImpactSeverity > 2}
              >
                <Text fontSize={20} fontWeight={500}>
                  {error
                    ? error
                    : priceImpactSeverity > 3 && !expertMode
                    ? `价格滑点太高`
                    : `${priceImpactSeverity > 2 ? '仍然兑换' : '兑换'}`}
                </Text>
              </ButtonError>
            )}
            {betterTradeLinkVersion && <BetterTradeLink version={betterTradeLinkVersion} />}
          </BottomGrouping>
        </Wrapper>
      </AppBody>

      <AdvancedSwapDetailsDropdown trade={trade} />

      <Share outputID={currencyKey(currencies[Field.OUTPUT])} outputCurrency={currencies[Field.OUTPUT]?.symbol}/>

      <MaxWidthWrapper>
        <RowBetween>
          <TYPE.black fontWeight={400} fontSize={14} color={theme.text2}>
            代币信息图
          </TYPE.black>
          <Toggle isActive={chartMode} toggle={toggleChartMode} />
        </RowBetween>
      </MaxWidthWrapper>
     {
       chartMode?
       (!currencyKey(currencies[Field.INPUT])||!currencyKey(currencies[Field.OUTPUT])?<NullWrapper>选择代币</NullWrapper>:
      (<ContextProviders>
        <>
          <PairPage pairAddress={pairAddress} OUTPUTAddress={currencyKey(currencies[Field.OUTPUT])}/>
        </>
      </ContextProviders>))
      : <></>
     }
    </>
  )
}
