# Livingston — History & Learnings

## Project Context
- **Project:** Digital Sous Chef — recipe organization app with gallery (scan/store recipes), meal planner, and grocery shopping list
- **Owner:** Brad Jolicoeur
- **Stack:** .NET 10 / ASP.NET Core + Wolverine + Marten (PostgreSQL), React 19 / TypeScript / Vite / Tailwind CSS, FusionAuth (auth), .NET Aspire (dev orchestration only)
- **Joined:** 2026-03-29
- **Universe:** Ocean's Eleven

## Team
- Danny — Lead (architecture, decisions, code review)
- Rusty — Backend Dev (.NET, Wolverine, Marten)
- Linus — Frontend Dev (React, TypeScript, Tailwind)
- Basher — Tester (xUnit, Alba)
- Scribe — Session logger
- Ralph — Work monitor

## Key File Paths
- Backend project: `src/DigitalSousChef/DigitalSousChef.Server/`
- Frontend project: `src/DigitalSousChef/digitalsouschef.client/`
- AppHost (Aspire, dev only): `src/DigitalSousChef/DigitalSousChef.AppHost/`
- Tests: `src/DigitalSousChef/DigitalSousChef.Tests/`
- GitHub workflows: `.github/workflows/` (to be created)

## Learnings

- **2026-03-31: Deploy workflow** — Created `.github/workflows/deploy.yml`. Triggers on push to `main` only. Uses `google-github-actions/auth@v2` with `credentials_json: ${{ secrets.GCP_SA_KEY }}` for GCP auth. Builds and pushes `Dockerfile.server` to Artifact Registry (`us-east1-docker.pkg.dev/bradjolicoeur-web/digital-sous-chef/digital-sous-chef`) with both `:sha` (immutable, used by deploy step) and `:latest` tags. Deploys to Cloud Run service `digital-sous-chef-server` in `us-east1` via `google-github-actions/deploy-cloudrun@v2`. Secrets `DATABASE_CONNECTION` → `ConnectionStrings__marten` and `OIDCAUTHORITY` → `FusionAuth__Issuer` are injected as env vars at deploy time, never baked into the image. `ci.yml` `build-server` job correctly keeps `push: false` — image pushes happen only in `deploy.yml` on main merges.

- **2026-04-09: Playwright Chromium pre-install for Cloud Run** — Cloud Run read-only filesystem was blocking `/api/recipes/import` with 500 errors. Updated `Dockerfile.server` to pre-bake Chromium at build time (PowerShell install in SDK stage, copy to runtime, add system deps). Guarded `PlaywrightRecipeExtractor.cs` runtime install with `PLAYWRIGHT_BROWSERS_PATH` env check; added `--disable-gpu` flag. Reduces image size vs Playwright base, enables local dev fallback, zero runtime filesystem writes. — decided by Livingston + Rusty

---

## 2025 — CI/CD Bootstrap

### What was created

| File | Purpose |
|---|---|
| `Dockerfile.server` | Multi-stage .NET 10 build → `aspnet:10.0` runtime, non-root user `app`, `curl` healthcheck on `/health` |
| `Dockerfile.client` | Multi-stage Node 22 build → `nginx:1.27-alpine`, SPA fallback routing |
| `nginx.conf` | SPA fallback, 1-year cache on fingerprinted assets, `/healthz` probe |
| `.dockerignore` | Excludes `.git`, `node_modules`, `bin/obj`, `TestResults`, `.squad`, `.vscode` |
| `.github/workflows/ci.yml` | Parallel jobs: `test-backend`, `build-server`, `build-client`, `ci-summary` |

### Key Gotchas Discovered

1. **No .sln file** — project has no solution file. Dockerfiles and CI restore individual `.csproj` files:
   - Server restore: `DigitalSousChef.Server.csproj` (pulls in `DigitalSousChef.ServiceDefaults` transitively)
   - Test restore: `DigitalSousChef.Tests.csproj`

2. **esproj reference must be stripped in Docker** — `DigitalSousChef.Server.csproj` references `digitalsouschef.client.esproj` which uses `Microsoft.VisualStudio.JavaScript.Sdk/1.0.4338480`, a VS-internal SDK not available on public NuGet. Applied `sed` twice in `Dockerfile.server` (once before restore for cache correctness, once after the full source `COPY` overwrites the patched file). Frontend is built independently in `Dockerfile.client`.

3. **No Node engine constraint in package.json** — no `engines` field. Using `node:22-alpine` (LTS); Vite 8 requires Node 18+.

4. **No vite `base` URL** — `vite.config.ts` has no `base` option, so the built assets reference `/` — nginx config works without any path prefix adjustments.

5. **Integration tests need PostgreSQL** — `continue-on-error: true` on the test step until a postgres service container is wired into the CI job.
