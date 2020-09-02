import React from 'react'
import styled from 'styled-components'
import useCopyClipboard from '../../hooks/useCopyClipboard'
import { useDarkModeManager } from '../../state/user/hooks'
import { CardWrapper } from '../../theme'

const HeaderFrame = styled.div`
	height:54px;
	.box{
		position:fixed;
		top:0;
		left:0;
		right:0;
		display: flex;
	  align-items: center;
	  justify-content: space-between;
		background:#fff;
		padding:12px 16px;
		z-index:1000;
	}
`
const HeadLogo = styled.div`
	background:url('https://staticcdn1.maiziqianbao.net/img/icon/logo.png')no-repeat left center/24px;
	padding-left:32px;
	line-height:30px;
	color:#000;
`
const HeadBtn = styled.button`
	padding: 4px 12px;
  border-radius: 14px;
  border: 1px solid #007aff;
  font: 500 12px/16px SFProText-Medium;
  color: #007aff;
  background:#fff;
  cursor:pointer;
  :focus{
  	outline:none;
  }
`
const url ='https://medishares-cn.oss-cn-hangzhou.aliyuncs.com/Uniswap/shareText/index.json'
async function getWechatInfo(url){
    let response;
    try {
      response = await fetch(url)
    } catch (error) {
      console.log(error)
    }
    const json = await response.json()
    return json
}

let wechatInfo = '';
getWechatInfo(url).then(res=>{
  wechatInfo=res.wechatInfo;
})
// 判断终端
const browser = {
  versions: function() {
    var u = navigator.userAgent;
    return {
      weixin: u.indexOf('MicroMessenger') > -1, //是否微信 （2015-01-22新增）
      mathApp: u.indexOf('MdsApp') > -1, //是否MdsApp
    };
  }()
}

function OpenInApp(){
	if (browser.versions.weixin) {
    alert('点击右上角，在浏览器中打开')
  } else {
    window.location.href="mathwallet://mathwallet.org?action=link&value="+window.location.href;
    window.setTimeout(function() {
      window.location.href = "http://mathwallet.xyz"
    }, 1000)
  }
}

export function OpenApp(){
	const isMathApp = browser.versions.mathApp;
	return (
		<>
			{isMathApp?<></>:
			(<HeaderFrame>
				<div className={'box'}>
					<HeadLogo>麦子钱包</HeadLogo>
					<HeadBtn onClick={() => OpenInApp()}>在 App 内打开</HeadBtn>
				</div>
			</HeaderFrame>)
			}
		</>
	)
}

export function CopyWechat(){
	const [isCopied, setCopied] = useCopyClipboard(1500);
  const [isDark] = useDarkModeManager();

	return (
		<CardWrapper onClick={() => setCopied(wechatInfo)}>
      <img src={isDark?require('../../assets/images/wechat_mode.png'):require('../../assets/images/wechat.png')} width="20" alt="wechat"/>
      <span>{isCopied ? '已复制，去添加微信':'添加微信号 '+wechatInfo+'（复制）'}</span>
    </CardWrapper>
	)
}
