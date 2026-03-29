# Project Context

- **Owner:** Brad Jolicoeur
- **Project:** Digital Sous Chef — recipe organization app with gallery (scan/store recipes), meal planner, and grocery shopping list
- **Stack:** .NET 10 / ASP.NET Core, Wolverine (command bus), Marten (PostgreSQL, document store + event sourcing), React 19 / TypeScript / Vite / Tailwind CSS / React Router v7, FusionAuth (auth), .NET Aspire (orchestration), xUnit + Alba (integration tests)
- **Created:** 2026-03-29

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Team update (2026-03-29T21:15:00Z): CI/CD bootstrap complete — `Dockerfile.server`, `Dockerfile.client`, `nginx.conf`, `.dockerignore`, `.github/workflows/ci.yml` committed to main. Integration tests run with `continue-on-error: true` until postgres service container is wired. Image builds gate CI. — decided by Livingston

### 2026-01-31 — Grocery List Spec 4.5 Gap Analysis

Conducted a full gap analysis between spec 4.5 and the current implementation of the grocery list feature. Key findings:

- **Store is a string, not an entity.** Implicit creation on first assignment. `null`/`""` = Master List. Derive available stores from `DISTINCT Store` across items. No separate store management endpoint needed.
- **Single PATCH endpoint is the right call.** Adding `string? Store` to the existing `UpdateGroceryItemRequest` keeps the pattern consistent and avoids endpoint proliferation.
- **Master List view and Store List view have different per-item actions.** Master List = delete (pantry check) + store assignment. Store List = purchased checkbox + store reassignment. The UI must conditionally render based on active tab.
- **15 discrete gaps identified** across 6 files: `GroceryList.cs`, `AddGroceryItem.cs`, `UpdateGroceryItem.cs`, `ClearPurchasedItems.cs`, `GroceryEndpoints.cs` (backend); `types.ts`, `api/grocery.ts`, `GroceryListPage.tsx` (frontend).
- The store tab/switcher UI (GAP-9) is the structural blocker — all other frontend gaps depend on having active tab state established first.
