import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { FusionAuthProvider } from '@fusionauth/react-sdk'
import './index.css'
import App from './App.tsx'

declare const __FUSIONAUTH_URL__: string;
declare const __FUSIONAUTH_CLIENT_ID__: string;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FusionAuthProvider
        clientId={__FUSIONAUTH_CLIENT_ID__}
        serverUrl={window.location.origin}
        redirectUri={window.location.origin}
        postLogoutRedirectUri={window.location.origin}
        scope="openid email profile offline_access"
        shouldAutoRefresh={true}
        shouldAutoFetchUserInfo={true}
      >
        <App />
      </FusionAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
