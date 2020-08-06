import React, { useEffect } from 'react'
import { AutoRow, RowBetween } from '../Row'
import  { AutoColumn } from '../Column'
import PairChart from '../PairChart'

import { formattedNum, formattedPercent } from '../../helpers'
import { usePairData } from '../../contexts/PairData'
import { useEthPrice } from '../../contexts/GlobalData'

import { TYPE,colors,PageWrapper,NullWrapper } from '../../theme'
import TokenLogo from '../TokenLogo'
import Loader from '../Loader'
import { useDarkModeManager } from '../../state/user/hooks'

function PairPage({ pairAddress,OUTPUTAddress}) {
  const [isDark] = useDarkModeManager()
  const backgroundColor = colors(isDark).primary3

  const {
    token0,
    token1,
    reserve0,
    reserve1,
    oneDayVolumeUSD,
    volumeChangeUSD,
  } = usePairData(pairAddress)

  useEffect(() => {
    document.querySelector('body').scrollTo(0, 0)
  }, [])


  // volume
  const volume = oneDayVolumeUSD ? formattedNum(oneDayVolumeUSD, true) : oneDayVolumeUSD === 0 ? '$0' : '-'
  const volumeChange = formattedPercent(volumeChangeUSD)

  // token data for usd
  const [ethPrice] = useEthPrice()
  const token0USD =
    token0?.derivedETH && ethPrice ? formattedNum(parseFloat(token0.derivedETH) * parseFloat(ethPrice), true) : ''

  // rates
  const token0Rate = reserve0 && reserve1 ? formattedNum(reserve1 / reserve0) : '-'

  return (
    <>
    { !pairAddress?<NullWrapper>暂无数据</NullWrapper>:
      (!token0?(
        <NullWrapper>
          <img src={require('./loading.gif')} width="100" alt="loading-icon" />
        </NullWrapper>
      ):
      (<PageWrapper>
        <AutoRow style={{ padding: '0.5rem 0 1.5rem' }}>
          <TokenLogo address={token0?.id} size={'16px'} />
          <TYPE.main fontSize={16} lineHeight={1} fontWeight={500} ml={'4px'}>
            {token0 && token1
              ? `1 ${token0?.symbol} = ${token0Rate} ${token1?.symbol} ${
                  parseFloat(token1?.derivedETH) ? '(' + token0USD + ')' : ''
                }`
              : <Loader/>}
          </TYPE.main>
        </AutoRow>
        <PairChart pairAddress={pairAddress} tokenAddress={OUTPUTAddress} color={backgroundColor} />
        <AutoColumn gap="10px" style={{ margin: '2.5rem 0 1.5rem' }}>
          <RowBetween>
            <TYPE.main>交易量 (24小时)</TYPE.main>
            <div />
          </RowBetween>
          <RowBetween align="flex-end">
            <TYPE.main fontSize={16} lineHeight={1} fontWeight={500}>
              {volume}
            </TYPE.main>
            <TYPE.main>{volumeChange}</TYPE.main>
          </RowBetween>
        </AutoColumn>
        <AutoColumn gap="10px">
          <RowBetween>
            <TYPE.main>流动池中代币</TYPE.main>
            <div />
          </RowBetween>
          <AutoRow gap="4px">
            <TokenLogo address={token0?.id} />
            <TYPE.main fontSize={16} lineHeight={1} fontWeight={500}>
              {reserve0 ? formattedNum(reserve0) : <Loader/>} {token0?.symbol ?? ''}
            </TYPE.main>
          </AutoRow>
          <AutoRow gap="4px">
            <TokenLogo address={token1?.id} />
            <TYPE.main fontSize={16} lineHeight={1} fontWeight={500}>
              {reserve1 ? formattedNum(reserve1) : <Loader/>} {token1?.symbol ?? ''}
            </TYPE.main>
          </AutoRow>
        </AutoColumn>
      </PageWrapper>)
      )}
    </>
  )
}

export default PairPage
