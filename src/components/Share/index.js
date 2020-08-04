import React, { useState } from 'react'
import styled from 'styled-components'
import {MaxWidthWrapper,Button} from '../../theme'
import Modal from '../Modal'
import useCopyClipboard from '../../hooks/useCopyClipboard'

const ShareWrapper = styled(MaxWidthWrapper)`
	margin-bottom:1rem;
`
const ShareButtonWrapper = styled(Button)`
  font-size:16px;
  font-weight:500;
	border-radius:20px;
	padding:18px;
`
const ModalWrapper = styled.div`
  padding:16px;
  font-size:14px;
  h3{
  	font-size:16px;
  	margin-bottom:10px;
  	text-align:center;
  }
  p{
  	word-break:break-all;
  }
  button{
  	margin-top:10px;
  }
`
export default function Share({outputCurrency,outputID}) {
	const [,setCopied] = useCopyClipboard(1500)
	const [showSwapModal, setShowSwapModal] = useState(false)
	const copyText = `点击参与 Uniswap 项目 ${outputCurrency}: https://uniswap.mathwallet.xyz/#/swap?outputCurrency=${outputID}`

	function Copy(){
		if(!outputCurrency){
			return alert('请选择输出代币')
		}
		setCopied(copyText)
		setShowSwapModal(true);
	}
	function goWechat(){
		window.location.href="wexin://"
		setShowSwapModal(false);
	}

	return (
		<ShareWrapper>
			<ShareButtonWrapper onClick={()=>Copy()}>分享项目</ShareButtonWrapper>
			<Modal isOpen={showSwapModal} onDismiss={() => setShowSwapModal(false)}>
				<ModalWrapper>
					<h3>邀请文案已复制</h3>
					<p>{copyText}</p>
					<Button onClick={()=>goWechat()}>打开微信，去分享</Button>
				</ModalWrapper>
			</Modal>
		</ShareWrapper>
	)
}
