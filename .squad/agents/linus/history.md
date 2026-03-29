# Project Context

- **Owner:** Brad Jolicoeur
- **Project:** Digital Sous Chef — recipe organization app with gallery (scan/store recipes), meal planner, and grocery shopping list
- **Stack:** .NET 10 / ASP.NET Core, Wolverine (command bus), Marten (PostgreSQL, document store + event sourcing), React 19 / TypeScript / Vite / Tailwind CSS / React Router v7, FusionAuth (auth), .NET Aspire (orchestration), xUnit + Alba (integration tests)
- **Created:** 2026-03-29

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-29 — Grocery Store Tabs
- `GroceryItem.store?: string` — `null`/`""` = Master List; non-empty = named store. Stores are DERIVED from items (distinct non-empty store values), not stored separately.
- Master List view shows only unassigned items (`!i.store`). Store view filters to `i.store === activeStore`.
- `extraStores` local state tracks newly-created store tabs that have no items yet — merged with `assignedStores` to form `allStores`.
- Store assignment dropdown hides (opacity-0) until group hover — keeps the UI clean per-item.
- Share List and Clear Completed are only shown in store-view (not Master List).
- `clearPurchased(store?)` passes `&store=` query param so backend only clears that store's purchased items.
- Quick-add passes `activeStore ?? undefined` so items land in the currently active tab.

📌 Team update (2026-03-29T21:15:00Z): CI/CD bootstrap complete — `Dockerfile.client` uses `node:22-alpine` → `nginx:1.27-alpine`. Client image builds are gated in CI. `nginx.conf` handles SPA fallback and fingerprinted asset caching. — decided by Livingston

