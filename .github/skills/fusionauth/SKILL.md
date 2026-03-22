---
name: fusionauth
description: "Use when integrating FusionAuth authentication into the React frontend or ASP.NET Core backend. Covers: @fusionauth/react-sdk, FusionAuthProvider setup, FusionAuthProviderConfig, useFusionAuth hook, isLoggedIn/startLogin/startLogout/userInfo, protected routes, OAuth 2.0 PKCE flow, user info fetching from /app/me, clientId/serverUrl config, CORS setup, access tokens, refresh tokens, scope, redirectUri, postLogoutRedirectUri, local FusionAuth via Docker."
---

# FusionAuth Skill

FusionAuth is a self-hostable or cloud identity/auth platform. In this project it runs locally (or in Docker) and is integrated with the React frontend via the official React SDK.

**Quickstart docs**: https://fusionauth.io/docs/quickstarts/react  
**React SDK docs**: https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-react/docs

## Setup

```bash
npm install @fusionauth/react-sdk
```

FusionAuth server runs at `http://localhost:9011` (local Docker) or your hosted instance URL.

## FusionAuthProvider — Wrap the App

Wrap the entire React app (inside `BrowserRouter`) with `FusionAuthProvider`:

```tsx
import { FusionAuthProvider } from '@fusionauth/react-sdk';
import type { FusionAuthProviderConfig } from '@fusionauth/react-sdk';

const fusionAuthProviderConfig: FusionAuthProviderConfig = {
  clientId: 'YOUR_CLIENT_ID_FROM_FUSIONAUTH_APP',   // from FusionAuth Applications UI
  serverUrl: 'http://localhost:9011',                 // FusionAuth base URL
  redirectUri: 'http://localhost:3000',              // where to land after login
  postLogoutRedirectUri: 'http://localhost:3000',    // where to land after logout
  shouldAutoRefresh: true,                           // auto-renew access tokens
  shouldAutoFetchUserInfo: true,                     // populate userInfo on login
  scope: 'openid email profile offline_access',      // OAuth 2.0 scopes
  onRedirect: () => { console.log('Login successful'); },
};

// In main.tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FusionAuthProvider {...fusionAuthProviderConfig}>
        <App />
      </FusionAuthProvider>
    </BrowserRouter>
  </StrictMode>
);
```

### Config Properties

| Property | Type | Description |
|----------|------|-------------|
| `clientId` | `string` | Application ID from FusionAuth admin UI |
| `serverUrl` | `string` | Base URL of the FusionAuth instance |
| `redirectUri` | `string` | Redirect target after successful login |
| `postLogoutRedirectUri` | `string` | Redirect target after logout |
| `shouldAutoRefresh` | `boolean` | Auto-renew access token before expiry |
| `shouldAutoFetchUserInfo` | `boolean` | Fetch OIDC user info on login |
| `scope` | `string` | Space-separated OAuth 2.0 scopes |
| `onRedirect` | `() => void` | Callback when redirect occurs |

## useFusionAuth Hook

The primary hook for auth state and actions in any component:

```tsx
import { useFusionAuth } from '@fusionauth/react-sdk';

function MyComponent() {
  const {
    isLoggedIn,           // boolean — is the user currently authenticated
    isFetchingUserInfo,   // boolean — user info fetch in progress
    startLogin,           // () => void — redirect to FusionAuth login page
    startLogout,          // () => void — redirect to FusionAuth logout endpoint
    userInfo,             // object — OIDC claims (email, given_name, family_name, etc.)
  } = useFusionAuth();
}
```

### userInfo Shape (OIDC claims)

```ts
interface UserInfo {
  email?: string;
  given_name?: string;
  family_name?: string;
  birthdate?: string;
  sub?: string;      // FusionAuth user ID
  // ...any other claims from the configured scope
}
```

## Login Flow

```tsx
export default function Home() {
  const navigate = useNavigate();
  const { isLoggedIn, startLogin, startLogout, userInfo } = useFusionAuth();

  useEffect(() => {
    // After FusionAuth redirects back, navigate to the protected page
    if (isLoggedIn && sessionStorage.getItem('justLoggedIn') === 'true') {
      sessionStorage.removeItem('justLoggedIn');
      navigate('/account');
    }
  }, [isLoggedIn, navigate]);

  return (
    <div>
      {isLoggedIn ? (
        <>
          <span>{userInfo?.email}</span>
          <button onClick={() => startLogout()}>Logout</button>
        </>
      ) : (
        <button
          onClick={() => {
            sessionStorage.setItem('justLoggedIn', 'true'); // flag for post-login redirect
            startLogin();
          }}
        >
          Login
        </button>
      )}
    </div>
  );
}
```

## Protected Routes

Guard a page so unauthenticated users are redirected away:

```tsx
export default function Account() {
  const navigate = useNavigate();
  const { isLoggedIn, isFetchingUserInfo, startLogout, userInfo } = useFusionAuth();

  // Redirect to home if not logged in
  useEffect(() => {
    if (!isLoggedIn) navigate('/');
  }, [isLoggedIn, navigate]);

  // Don't render content until auth state is resolved
  if (!isLoggedIn || isFetchingUserInfo) return null;

  return (
    <div>
      <span>{userInfo?.email}</span>
      <button onClick={() => startLogout()}>Logout</button>
      {/* protected content */}
    </div>
  );
}
```

## Fetching User Info from FusionAuth API

After login, call the FusionAuth hosted `/app/me` endpoint with the auth cookie to get full user data:

```tsx
async function getUserInfo() {
  const response = await fetch('http://localhost:9011/app/me', {
    method: 'GET',
    credentials: 'include',  // sends the FusionAuth session cookie
    headers: { 'Accept': 'application/json' },
  });
  const info = await response.json();
  return info; // { given_name, family_name, birthdate, email, sub, ... }
}

// Use in component
const [userDetails, setUserDetails] = useState({ given_name: '', family_name: '', birthdate: '' });

<button onClick={async () => setUserDetails(await getUserInfo())}>
  Show my info
</button>

<div>{userDetails.given_name} {userDetails.family_name}</div>
```

## Local FusionAuth via Docker

FusionAuth can run locally using Docker Compose. The `kickstart.json` file pre-configures everything:

```bash
# Start FusionAuth locally
docker compose up -d

# Admin UI
# http://localhost:9011/admin
# admin@example.com / password
```

The `kickstart.json` file in the repo configures:
- API key
- CORS settings (required for React frontend origin)
- The application (with redirect URIs)
- Test users

## Aspire / .NET Backend Integration

When using FusionAuth with an ASP.NET Core backend (Wolverine/Marten):

- The React frontend handles login/logout via the FusionAuth React SDK — no backend involvement
- The .NET backend validates JWT access tokens from FusionAuth on protected API calls
- Use `Microsoft.AspNetCore.Authentication.JwtBearer` to validate tokens:

```csharp
// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "http://localhost:9011";  // FusionAuth server URL
        options.Audience = "YOUR_CLIENT_ID";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
        };
    });

builder.Services.AddAuthorization();

// After app is built:
app.UseAuthentication();
app.UseAuthorization();
```

- API calls from React to the .NET backend should include the access token in the `Authorization: Bearer <token>` header
- Wolverine endpoint handlers can use `[Authorize]` or check `HttpContext.User` as needed

## CORS Configuration

FusionAuth must have CORS configured to allow the React dev origin (`http://localhost:3000`). The kickstart file handles this for local dev. For production, configure in FusionAuth admin at Settings → System → CORS.

## Key URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:9011` | FusionAuth server base URL |
| `http://localhost:9011/admin` | FusionAuth admin UI |
| `http://localhost:9011/app/me` | OIDC userinfo endpoint (cookie auth) |
| `http://localhost:9011/.well-known/openid-configuration` | OIDC discovery document |
