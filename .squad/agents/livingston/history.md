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

- **2026-03-31: Single-image deployment model** — Deployment is now a single Docker image. `Dockerfile.server` builds the React/Vite frontend in a `node-build` stage and copies the `/app/dist` output into `/app/publish/wwwroot` after `dotnet publish`. ASP.NET Core serves the SPA via `UseDefaultFiles`/`UseStaticFiles`/`MapFallbackToFile`. The separate `Dockerfile.client` (nginx) is retained for reference but is no longer the deployment artifact. The `build-client` CI job has been removed. Rusty updated Program.cs to use `UseStaticFiles()` instead of `MapStaticAssets()` to support Docker-copied wwwroot files. (Decision 2026-03-31 accepted.)

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
