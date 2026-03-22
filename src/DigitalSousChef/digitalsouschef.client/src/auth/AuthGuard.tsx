import { useFusionAuth } from '@fusionauth/react-sdk';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isFetchingUserInfo, startLogin } = useFusionAuth();
  const location = useLocation();
  const didRedirect = useRef(false);

  useEffect(() => {
    // Wait until the SDK has finished its initial check before deciding
    if (isFetchingUserInfo) return;
    if (!isLoggedIn && !didRedirect.current) {
      didRedirect.current = true;
      // Remember where the user wanted to go
      sessionStorage.setItem('postLoginRedirect', location.pathname);
      startLogin();
    }
  }, [isLoggedIn, isFetchingUserInfo, startLogin, location.pathname]);

  if (!isLoggedIn) return null;
  return <>{children}</>;
};

export default AuthGuard;
