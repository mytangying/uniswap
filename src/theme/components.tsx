import React, { HTMLProps, useCallback } from 'react'
import ReactGA from 'react-ga'
import { Link } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'
import { darken } from 'polished'
import { ArrowLeft, X } from 'react-feather'

export const Button = styled.button.attrs<{ warning: boolean }, { backgroundColor: string }>(({ warning, theme }) => ({
  backgroundColor: warning ? theme.red1 : theme.primary1
}))`
  padding: 1rem 2rem 1rem 2rem;
  border-radius: 3rem;
  cursor: pointer;
  user-select: none;
  font-size: 1rem;
  border: none;
  outline: none;
  background-color: ${({ backgroundColor }) => backgroundColor};
  color: ${({ theme }) => theme.white};
  width: 100%;

  :hover,
  :focus {
    background-color: ${({ backgroundColor }) => darken(0.05, backgroundColor)};
  }

  :active {
    background-color: ${({ backgroundColor }) => darken(0.1, backgroundColor)};
  }

  :disabled {
    background-color: ${({ theme }) => theme.bg1};
    color: ${({ theme }) => theme.text4};
    cursor: auto;
  }
`

export const CloseIcon = styled(X)<{ onClick: () => void }>`
  cursor: pointer;
`

// A button that triggers some onClick result, but looks like a link.
export const LinkStyledButton = styled.button`
  border: none;
  text-decoration: none;
  background: none;

  cursor: pointer;
  color: ${({ theme }) => theme.primary1};
  font-weight: 500;

  :hover {
    text-decoration: underline;
  }

  :focus {
    outline: none;
    text-decoration: underline;
  }

  :active {
    text-decoration: none;
  }
`

// An internal link from the react-router-dom library that is correctly styled
export const StyledInternalLink = styled(Link)`
  text-decoration: none;
  cursor: pointer;
  color: ${({ theme }) => theme.primary1};
  font-weight: 500;

  :hover {
    text-decoration: underline;
  }

  :focus {
    outline: none;
    text-decoration: underline;
  }

  :active {
    text-decoration: none;
  }
`

const StyledLink = styled.a`
  text-decoration: none;
  cursor: pointer;
  color: ${({ theme }) => theme.primary1};
  font-weight: 500;

  :hover {
    text-decoration: underline;
  }

  :focus {
    outline: none;
    text-decoration: underline;
  }

  :active {
    text-decoration: none;
  }
`

/**
 * Outbound link that handles firing google analytics events
 */
export function ExternalLink({
  target = '_blank',
  href,
  rel = 'noopener noreferrer',
  ...rest
}: Omit<HTMLProps<HTMLAnchorElement>, 'as' | 'ref' | 'onClick'> & { href: string }) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      // don't prevent default, don't redirect if it's a new tab
      if (target === '_blank' || event.ctrlKey || event.metaKey) {
        ReactGA.outboundLink({ label: href }, () => {
          console.debug('Fired outbound link event', href)
        })
      } else {
        event.preventDefault()
        // send a ReactGA event and then trigger a location change
        ReactGA.outboundLink({ label: href }, () => {
          window.location.href = href
        })
      }
    },
    [href, target]
  )
  return <StyledLink target={target} rel={rel} href={href} onClick={handleClick} {...rest} />
}

const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`

export const Spinner = styled.img`
  animation: 2s ${rotate} linear infinite;
  width: 16px;
  height: 16px;
`

export const CursorPointer = styled.div`
  :hover {
    cursor: pointer;
  }
`

const BackArrowLink = styled(StyledInternalLink)`
  color: ${({ theme }) => theme.text1};
`
export function BackArrow({ to }: { to: string }) {
  return (
    <BackArrowLink to={to}>
      <ArrowLeft />
    </BackArrowLink>
  )
}

export const MaxWidthWrapper = styled.div`
  max-width:420px;
  width: 100%;
  margin-top:2rem;
  box-sizing:border-box;
`

export const CardWrapper = styled(MaxWidthWrapper)`
  cursor:pointer;
  background-color: ${({ theme }) => theme.primary5};
  color: ${({ theme }) => theme.primaryText1};
  padding: 18px;
  border-radius:20px;
  @media (max-width: 500px){
    padding: 16px;
  }
  *{
    vertical-align:middle;
  }
  img{
    margin-right:8px;

  }
`
export const PageWrapper = styled(MaxWidthWrapper)`
  background:${({ theme }) => theme.advancedBG};
  color: ${({ theme }) => theme.text1};
  border-radius:30px;
  margin-top:1rem;
  box-shadow:0px 0px 1px rgba(0,0,0,0.01), 0px 4px 8px rgba(0,0,0,0.04), 0px 16px 24px rgba(0,0,0,0.04), 0px 24px 32px rgba(0,0,0,0.01);
  padding: 18px;
  @media (max-width: 500px){
    padding: 16px;
  }
  *{
    vertical-align:middle;
  }
  img{
    margin-right:8px;

  }
`
export const NullWrapper = styled(PageWrapper)`
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:2rem;
  font-size:16px;
  font-weight:500;
`

