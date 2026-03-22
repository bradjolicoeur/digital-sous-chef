import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { FusionAuthProvider } from '@fusionauth/react-sdk'
import './index.css'
import App from './App.tsx'

declare const __FUSIONAUTH_URL__: string;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FusionAuthProvider
        clientId="e9fdb985-9173-4e01-9d73-ac2d60d1dc8e"
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
