# Project Context

- **Owner:** Brad Jolicoeur
- **Project:** Digital Sous Chef — recipe organization app with gallery (scan/store recipes), meal planner, and grocery shopping list
- **Stack:** .NET 10 / ASP.NET Core, Wolverine (command bus), Marten (PostgreSQL, document store + event sourcing), React 19 / TypeScript / Vite / Tailwind CSS / React Router v7, FusionAuth (auth), .NET Aspire (orchestration), xUnit + Alba (integration tests)
- **Created:** 2026-03-29

## Learnings

- When Aspire is running, `dotnet build` may fail due to file locks from the server process. Use `Stop-Process -Id <PID>` on the specific process ID holding the lock, then build with `--disable-build-servers`.
- `ClearPurchasedItemsCommand` now accepts optional `string? Store` param; `null` = clear all (backwards compat).
- Replaced `app.MapStaticAssets()` with `app.UseStaticFiles()` in Program.cs (2026-03-31). `MapStaticAssets()` is .NET 9/10's build-pipeline-integrated static file serving that relies on a publish-time manifest for fingerprinted assets — it does NOT serve arbitrary files dropped into wwwroot at Docker build time. `UseStaticFiles()` serves any files placed in wwwroot conventionally, which is required when the Vite build output is copied into wwwroot by the Docker build process.
- **Cloud Run HTTPS/cookie handling (2026-03-31):** Cloud Run terminates TLS at the load balancer — requests arrive at the container over HTTP with `X-Forwarded-Proto: https`. Without `UseForwardedHeaders()`, ASP.NET Core sees `ctx.Request.Scheme == "http"` and won't trust forwarded headers. Auth cookies MUST set `Secure=true` when the external request was HTTPS (detected via `X-Forwarded-Proto: https`), otherwise browsers may reject them. JWT bearer validation failures produce silent 401s — added `OnAuthenticationFailed` logging to capture the actual validation error (e.g., issuer mismatch, signature failure).
- **Playwright Chromium in Cloud Run (2026-04-09):** Cloud Run has a read-only filesystem; `PlaywrightRecipeExtractor.cs` attempting `Microsoft.Playwright.Program.Main(["install", "chromium"])` at runtime causes 500 errors on `/api/recipes/import`. Solution: pre-bake Chromium at Docker build time. `Dockerfile.server` install PowerShell in SDK stage, run `pwsh playwright.ps1 install chromium`, add Chromium system deps, copy browser to final stage, set `ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers`. Rusty guarded the runtime install call with env var check (only download when `PLAYWRIGHT_BROWSERS_PATH` unset) and added `--disable-gpu` launch flag. No runtime filesystem writes, compatible with read-only root, image ~200MB smaller than Playwright base image.

📌 Team update (2026-03-29T21:15:00Z): CI/CD bootstrap complete — `Dockerfile.server`, `Dockerfile.client`, `nginx.conf`, `.dockerignore`, `.github/workflows/ci.yml` committed to main. Backend tests run in CI with `continue-on-error: true` (no postgres service container yet). — decided by Livingston

📌 Team update (2026-03-31T08:30:04Z): Single-image deployment model complete — `Dockerfile.server` three-stage build, `Program.cs` static file handler update, `ci.yml` simplified. Livingston + Rusty. — decided by Livingston
