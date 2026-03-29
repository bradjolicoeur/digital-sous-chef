---
name: playwright-login
description: "Use when you need to log in to the Digital Sous-Chef app via Playwright browser automation before validating UI changes. Covers: navigating to a protected route, detecting the FusionAuth login redirect, filling credentials, submitting, and confirming the app has loaded."
---

# Playwright Login Skill

Use this skill whenever you need to authenticate in the browser before validating UI changes. The app uses FusionAuth for auth — any protected route will redirect to the FusionAuth login page at `http://localhost:9011`.

## Test credentials (from README)

| User | Email | Password |
|------|-------|----------|
| Regular user | `chef@example.com` | `password` |
| Admin | `admin@digitalsouschef.local` | `password` |

Use `chef@example.com` / `password` for general UI validation unless admin access is specifically required.

## Login steps

### 1. Navigate to a protected page

```
navigate to https://localhost:56178/gallery
```

The app will redirect to FusionAuth if not already logged in.

### 2. Fill in credentials and submit

Use `browser_fill_form` targeting the Login and Password textboxes, then click Submit:

```
fill_form:
  - name: Login,    type: textbox, value: chef@example.com
  - name: Password, type: textbox, value: password

click: Submit button
```

### 3. Confirm redirect back to the app

After clicking Submit, the browser should redirect back to `https://localhost:56178/...`. Confirm the page URL starts with `https://localhost:56178` and the top nav is visible before proceeding with further validation.

## Full example sequence

1. `browser_navigate` → `https://localhost:56178/import`  
   _(redirects to FusionAuth login)_

2. `browser_fill_form` → Login: `chef@example.com`, Password: `password`

3. `browser_click` → Submit button (`ref` will be the button with text " Submit")

4. Wait for redirect — page URL should return to `https://localhost:56178/import`

5. Confirm snapshot contains expected page content before taking screenshots or asserting UI state.

## Already logged in?

If the page URL after navigation is already `https://localhost:56178/...` (no redirect to port 9011), the session is still active — skip the login steps and proceed directly to validation.

## Notes

- FusionAuth runs at `http://localhost:9011` — the login page title is "Login | FusionAuth"
- The login form has two textboxes: `Login` (email) and `Password`
- After successful login the app redirects to the originally requested URL (preserved via `sessionStorage.postLoginRedirect`)
- The session persists for the browser session — you only need to log in once per Playwright session
