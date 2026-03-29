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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
