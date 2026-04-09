# Squad Decisions

## Active Decisions

---

### 2025: CI/CD Bootstrap (Livingston)

**By:** Livingston  
**Status:** Accepted

**What:**

| Choice | Decision |
|--------|----------|
| Base images | `sdk:10.0`/`aspnet:10.0` (server); `node:22-alpine`/`nginx:1.27-alpine` (client) |
| esproj stripping | `sed` applied twice in `Dockerfile.server` — before restore (cache key) and after full `COPY` (re-applies patch). Keeps application code untouched. |
| Integration test gating | `continue-on-error: true` until a `postgres:17` service container is wired. Image builds gate CI; tests are informational. |
| Layer caching | NuGet: `hashFiles('**/*.csproj')`; npm: `package.json`+`package-lock.json`; Docker: `type=gha,mode=max`. |
| Artifact Registry push | Deferred — requires GCP Artifact Registry, `GCP_SA_KEY` secret, and `docker/login-action`. |

**Why:** The Server `.csproj` references `Microsoft.VisualStudio.JavaScript.Sdk` (VS-internal, not on public NuGet). Frontend is built independently. Cache layering ensures pure source changes skip the heaviest restore/install steps.

**Next steps for Brad:** Create GCP Artifact Registry; add `GCP_SA_KEY` secret; set `push: true`; add `postgres:17` service container and remove `continue-on-error`.

---

### 2026-03-31: Single-Image Deployment Model (Livingston)

**By:** Livingston  
**Status:** Accepted

**What:**

The deployment artifact is now a single Docker image built from `Dockerfile.server`. The React/Vite frontend is compiled in a `node-build` stage (`node:22-alpine`) and the resulting `dist/` output is copied into `wwwroot/` of the published .NET application. ASP.NET Core serves the SPA statically.

| Change | Detail |
|--------|--------|
| `Dockerfile.server` | Three-stage build: `node-build` → `build` → `final`. React dist copied to `wwwroot` after `dotnet publish`. |
| `Dockerfile.client` | Retained for reference; no longer the deployment artifact. |
| `ci.yml` | Removed `build-client` job. `ci-summary` now depends only on `test-backend` and `build-server`. |
| `Program.cs` | Replaced `MapStaticAssets()` with `UseStaticFiles()` to support Docker-copied wwwroot files. |

**Why:** Eliminates the two-container model (API + nginx SPA) and the operational complexity of coordinating them in production (Cloud Run revisions, URL routing, CORS). ASP.NET Core already calls `UseDefaultFiles()`, `UseStaticFiles()`, and `MapFallbackToFile("/index.html")` — wwwroot serving was already wired up. Vite config uses `/api/*` relative paths, which resolve correctly when frontend and API share the same origin. Reduces CI time: one Docker build instead of two; GHA layer cache (`type=gha,mode=max`) covers the npm install and dotnet restore layers independently.

**Trade-offs:** Image is larger than a pure nginx image (includes ASP.NET Core runtime + static assets). Node build happens inside Docker — no separate npm caching in CI outside of BuildKit's layer cache. `Dockerfile.client` is orphaned but kept for reference in case a CDN-fronted static deployment is ever desired.

---

### 2026-01-31: Grocery List Store Assignment — Architecture (Danny)

**By:** Danny  
**Status:** Active

**What:**

1. **Store as plain `string?`** on `GroceryItem` — no separate entity. Derived by `DISTINCT` over non-null values. `null`/`""` = Master List.
2. **Single `PATCH /api/grocery/items/:itemId`** endpoint — request body: `UpdateGroceryItemRequest(bool? IsPurchased, int? Quantity, string? Store)`. `null` = no change.
3. **`DELETE /api/grocery/items?purchased=true&store={name}`** — `ClearPurchasedItemsCommand` gains optional `string? Store`; filters by store when provided; global clear when omitted.
4. **`POST /api/grocery/items`** gains optional `string? Store` — omit from Master List view, pass from Store view.

**Why:** Minimal footprint; stores are implicitly created. Unified PATCH keeps frontend simple. Store-scoped clear aligns with spec 4.5 behaviour.

**Gap list:** GAP-1 through GAP-15 detailed in original inbox file. Backend (GAP-1→4) owned by Rusty; Frontend (GAP-5→15) owned by Linus. Sequencing: backend model first, then API layer, then UI behaviours.

---

### 2026-03-29: Grocery List Integration Test Approach — spec 4.5 (Basher)

**By:** Basher  
**Status:** Proposed

**What:**

1. **Auth override via `TestAuthHandler`** — always authenticates with fixed `sub` claim `test-user-001`. Replaces `JwtBearer` default scheme in `AppFixture`.
2. **Connection string via env var** — reads `MARTEN_CONNECTION_STRING` → `ConnectionStrings__marten` → localhost fallback. Works with Aspire and standalone `dotnet test`.
3. **File-scoped response DTOs** — tests deserialize into `file record` types, not server domain classes. Decouples tests from internal model changes.
4. **Tests are intentionally forward-looking** — `GroceryItem.Store` and updated commands don't exist yet; compile errors are expected until Rusty implements GAP-1→4.

**Why:** TestAuthHandler avoids FusionAuth dependency in tests (too fragile, too slow). Env-var connection string supports both Aspire-hosted and standalone runs. File-scoped DTOs isolate test contracts.

**Rusty must implement for tests to compile:** `GroceryItem.Store`; updated `AddGroceryItemCommand`, `UpdateGroceryItemRequest`, `UpdateGroceryItemCommand`, `ClearPurchasedItemsCommand`; `ClearPurchasedItems` endpoint must bind `string? store` from query string.

---

### 2026-04-09: Playwright Chromium Pre-Install for Cloud Run (Livingston & Rusty)

**By:** Livingston & Rusty  
**Status:** Accepted

**What:**

Cloud Run's read-only filesystem caused `/api/recipes/import` to fail with 500 errors when `PlaywrightRecipeExtractor.cs` attempted to download Chromium at runtime. Solution: pre-bake Chromium into the Docker image at build time.

| Change | Detail |
|--------|--------|
| `Dockerfile.server` build stage | Install PowerShell; set `PLAYWRIGHT_BROWSERS_PATH=/app/playwright-browsers`; run `pwsh playwright.ps1 install chromium` to pre-download Chromium |
| `Dockerfile.server` final stage | Add Chromium system deps (libnss3, libnspr4, libatk1.0-0, libatk-bridge2.0-0, libcups2, libdrm2, libgbm1, libgtk-3-0, libxkbcommon0, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libx11-xcb1, libasound2); copy browser from build stage to `/app/.playwright-browsers`; set `ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers` |
| `PlaywrightRecipeExtractor.cs` | Guard runtime `install` call with `PLAYWRIGHT_BROWSERS_PATH` check; only download locally when env var is unset; add `--disable-gpu` launch arg for containerised environments |

**Why:** Build-time installation eliminates runtime browser downloads (solves 27-second timeouts). Environment variable guard preserves local dev experience. Selective Chromium install keeps image ~200MB smaller than Playwright base image. No runtime filesystem writes required — compatible with Cloud Run's read-only root.

**Trade-offs:** PowerShell is only in build stage (kept lean), but requires apt install. Browser version pinned to bundled Microsoft.Playwright version; upgrades automatically on next Docker build.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
