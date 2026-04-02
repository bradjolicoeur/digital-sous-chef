using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace DigitalSousChef.Server.Features.Auth;

/// <summary>
/// Server-side helper endpoints required by the FusionAuth React SDK.
/// See: https://github.com/FusionAuth/fusionauth-javascript-sdk-express#server-code-requirements
/// </summary>
public static class FusionAuthHelperEndpoints
{
    // Cookie names used by the FusionAuth React SDK
    private const string AccessTokenCookie = "app.at";
    private const string RefreshTokenCookie = "app.rt";
    private const string AccessTokenExpCookie = "app.at_exp"; // readable by JS, holds expiry unix timestamp
    private const string PkceVerifierCookie = "app.pkce";
    private const string PostLoginRedirectCookie = "app.post_login_redirect";

    public static WebApplication MapFusionAuthHelperRoutes(
        this WebApplication app, string fusionAuthBaseUrl, string clientId)
    {
        // GET /app/login — start PKCE flow
        app.MapGet("/app/login", (HttpContext ctx, [FromQuery] string? redirect_uri, [FromQuery] string? scope) =>
        {
            var codeVerifier = GenerateCodeVerifier();
            var codeChallenge = GenerateCodeChallenge(codeVerifier);

            // Determine the callback URL visible to the browser (via Vite proxy)
            var browserOrigin = DetermineBrowserOrigin(ctx, redirect_uri);
            var callbackUrl = $"{browserOrigin}/app/callback";

            // Persist verifier and post-login destination in short-lived cookies
            var cookieOpts = new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, MaxAge = TimeSpan.FromMinutes(10) };
            ctx.Response.Cookies.Append(PkceVerifierCookie, codeVerifier, cookieOpts);
            ctx.Response.Cookies.Append(PostLoginRedirectCookie, redirect_uri ?? "/", cookieOpts);

            var scopeValue = Uri.EscapeDataString(scope ?? "openid email profile offline_access");
            var authorizeUrl = $"{fusionAuthBaseUrl}/oauth2/authorize" +
                $"?client_id={Uri.EscapeDataString(clientId)}" +
                $"&redirect_uri={Uri.EscapeDataString(callbackUrl)}" +
                $"&response_type=code" +
                $"&scope={scopeValue}" +
                $"&code_challenge={codeChallenge}" +
                $"&code_challenge_method=S256";

            return Results.Redirect(authorizeUrl);
        }).AllowAnonymous();

        // GET /app/callback — handle FusionAuth redirect, exchange code for tokens
        app.MapGet("/app/callback", async (
            HttpContext ctx,
            [FromQuery] string? code,
            [FromQuery] string? error,
            [FromQuery] string? error_description,
            IHttpClientFactory httpClientFactory) =>
        {
            var postLoginRedirect = ctx.Request.Cookies[PostLoginRedirectCookie] ?? "/";

            if (!string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code))
            {
                var errorMsg = error_description ?? error ?? "Unknown error";
                return Results.Redirect($"{postLoginRedirect}?error={Uri.EscapeDataString(errorMsg)}");
            }

            var codeVerifier = ctx.Request.Cookies[PkceVerifierCookie];
            if (string.IsNullOrEmpty(codeVerifier))
                return Results.Redirect($"{postLoginRedirect}?error=missing_pkce_verifier");

            var callbackUrl = $"{DetermineBrowserOrigin(ctx, null)}/app/callback";

            // Exchange code for tokens
            var http = httpClientFactory.CreateClient();
            var tokenRequest = new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["client_id"] = clientId,
                ["code"] = code,
                ["code_verifier"] = codeVerifier,
                ["redirect_uri"] = callbackUrl
            };

            HttpResponseMessage tokenResponse;
            try
            {
                tokenResponse = await http.PostAsync(
                    $"{fusionAuthBaseUrl}/oauth2/token",
                    new FormUrlEncodedContent(tokenRequest));
            }
            catch (Exception)
            {
                return Results.Redirect($"{postLoginRedirect}?error=token_exchange_failed");
            }

            if (!tokenResponse.IsSuccessStatusCode)
                return Results.Redirect($"{postLoginRedirect}?error=token_exchange_failed");

            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();
            using var tokenDoc = JsonDocument.Parse(tokenJson);
            var root = tokenDoc.RootElement;

            var accessToken = root.GetProperty("access_token").GetString()!;
            var expiresIn = root.TryGetProperty("expires_in", out var exp) ? exp.GetInt64() : 3600;
            var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;

            // Clear PKCE temp cookies
            ctx.Response.Cookies.Delete(PkceVerifierCookie);
            ctx.Response.Cookies.Delete(PostLoginRedirectCookie);

            // Set auth cookies
            var atExp = DateTimeOffset.UtcNow.AddSeconds(expiresIn).ToUnixTimeSeconds();
            var isHttps = ctx.Request.Scheme == "https" || ctx.Request.Headers["X-Forwarded-Proto"] == "https";
            var secureCookieOpts = new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Secure = isHttps
            };
            ctx.Response.Cookies.Append(AccessTokenCookie, accessToken, secureCookieOpts);
            ctx.Response.Cookies.Append(AccessTokenExpCookie, atExp.ToString(),
                new CookieOptions { HttpOnly = false, SameSite = SameSiteMode.Lax, Path = "/", Secure = isHttps }); // JS-readable

            if (!string.IsNullOrEmpty(refreshToken))
                ctx.Response.Cookies.Append(RefreshTokenCookie, refreshToken, secureCookieOpts);

            return Results.Redirect(postLoginRedirect);
        }).AllowAnonymous();

        // GET /app/me — return user info using the access token cookie
        app.MapGet("/app/me", async (HttpContext ctx, IHttpClientFactory httpClientFactory) =>
        {
            var accessToken = ctx.Request.Cookies[AccessTokenCookie];
            if (string.IsNullOrEmpty(accessToken))
                return Results.Unauthorized();

            var http = httpClientFactory.CreateClient();
            http.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            var response = await http.GetAsync($"{fusionAuthBaseUrl}/oauth2/userinfo");
            if (!response.IsSuccessStatusCode)
                return Results.Unauthorized();

            var content = await response.Content.ReadAsStringAsync();
            return Results.Content(content, "application/json");
        }).AllowAnonymous();

        // GET/POST /app/logout — clear cookies and redirect to FusionAuth logout
        app.MapGet("/app/logout", (HttpContext ctx, [FromQuery] string? client_id, [FromQuery] string? post_logout_redirect_uri) =>
        {
            ClearAuthCookies(ctx);
            var logoutUrl = $"{fusionAuthBaseUrl}/oauth2/logout?client_id={Uri.EscapeDataString(client_id ?? clientId)}";
            if (!string.IsNullOrEmpty(post_logout_redirect_uri))
                logoutUrl += $"&post_logout_redirect_uri={Uri.EscapeDataString(post_logout_redirect_uri)}";

            return Results.Redirect(logoutUrl);
        }).AllowAnonymous();

        // POST /app/refresh — refresh the access token using the refresh token cookie
        app.MapPost("/app/refresh", async (HttpContext ctx, IHttpClientFactory httpClientFactory) =>
        {
            var refreshToken = ctx.Request.Cookies[RefreshTokenCookie];
            if (string.IsNullOrEmpty(refreshToken))
                return Results.Unauthorized();

            var http = httpClientFactory.CreateClient();
            var refreshRequest = new Dictionary<string, string>
            {
                ["grant_type"] = "refresh_token",
                ["refresh_token"] = refreshToken,
                ["client_id"] = clientId
            };

            var response = await http.PostAsync(
                $"{fusionAuthBaseUrl}/oauth2/token",
                new FormUrlEncodedContent(refreshRequest));

            if (!response.IsSuccessStatusCode)
            {
                ClearAuthCookies(ctx);
                return Results.Unauthorized();
            }

            var tokenJson = await response.Content.ReadAsStringAsync();
            using var tokenDoc = JsonDocument.Parse(tokenJson);
            var root = tokenDoc.RootElement;

            var accessToken = root.GetProperty("access_token").GetString()!;
            var expiresIn = root.TryGetProperty("expires_in", out var exp) ? exp.GetInt64() : 3600;
            var atExp = DateTimeOffset.UtcNow.AddSeconds(expiresIn).ToUnixTimeSeconds();

            var isHttps = ctx.Request.Scheme == "https" || ctx.Request.Headers["X-Forwarded-Proto"] == "https";
            var secureCookieOpts = new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Secure = isHttps
            };
            ctx.Response.Cookies.Append(AccessTokenCookie, accessToken, secureCookieOpts);
            ctx.Response.Cookies.Append(AccessTokenExpCookie, atExp.ToString(),
                new CookieOptions { HttpOnly = false, SameSite = SameSiteMode.Lax, Path = "/", Secure = isHttps });

            if (root.TryGetProperty("refresh_token", out var newRt))
                ctx.Response.Cookies.Append(RefreshTokenCookie, newRt.GetString()!, secureCookieOpts);

            return Results.Ok();
        }).AllowAnonymous();

        return app;
    }

    private static void ClearAuthCookies(HttpContext ctx)
    {
        ctx.Response.Cookies.Delete(AccessTokenCookie);
        ctx.Response.Cookies.Delete(RefreshTokenCookie);
        ctx.Response.Cookies.Delete(AccessTokenExpCookie);
    }

    private static string DetermineBrowserOrigin(HttpContext ctx, string? redirectUri)
    {
        // If the SDK passed redirect_uri (= window.location.origin), use that as the browser origin
        if (!string.IsNullOrEmpty(redirectUri) && redirectUri.StartsWith("http"))
            return redirectUri.TrimEnd('/');

        // Fallback: use the X-Forwarded headers (Vite proxy sets these) or the request origin header
        var forwardedProto = ctx.Request.Headers["X-Forwarded-Proto"].FirstOrDefault();
        var forwardedHost = ctx.Request.Headers["X-Forwarded-Host"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedProto) && !string.IsNullOrEmpty(forwardedHost))
            return $"{forwardedProto}://{forwardedHost}";

        var originHeader = ctx.Request.Headers.Origin.FirstOrDefault();
        if (!string.IsNullOrEmpty(originHeader))
            return originHeader.TrimEnd('/');

        return $"{ctx.Request.Scheme}://{ctx.Request.Host}";
    }

    private static string GenerateCodeVerifier()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Base64UrlEncode(bytes);
    }

    private static string GenerateCodeChallenge(string codeVerifier)
    {
        var bytes = SHA256.HashData(Encoding.ASCII.GetBytes(codeVerifier));
        return Base64UrlEncode(bytes);
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
