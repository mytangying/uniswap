import React, { useState } from 'react'
import styled from 'styled-components'
import {MaxWidthWrapper,Button} from '../../theme'
import Modal from '../Modal'
import useCopyClipboard from '../../hooks/useCopyClipboard'
const url ='https://medishares-cn.oss-cn-hangzhou.aliyuncs.com/Uniswap/shareText/index.json'
async function getTextJSON(url){
    let response;
    try {
      response = await fetch(url)
    } catch (error) {
      console.log(error)
    }
    const json = await response.json()
    return json
}

let textJSON = '';
getTextJSON(url).then(res=>{
  textJSON=res.text;
})

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
  padding:16px 16px 32px;
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
	const copyText = `${textJSON} ${outputCurrency}: https://uniswap.mathwallet.xyz/#/swap?outputCurrency=${outputID}`

	function Copy(){
		if(!outputCurrency){
			return alert('请选择输出代币')
		}
		setCopied(copyText)
		setShowSwapModal(true);
	}
	function goWechat(){
		window.location.href="weixin://"
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
