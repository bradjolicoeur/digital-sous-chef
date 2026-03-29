# Project Context

- **Owner:** Brad Jolicoeur
- **Project:** Digital Sous Chef — recipe organization app with gallery (scan/store recipes), meal planner, and grocery shopping list
- **Stack:** .NET 10 / ASP.NET Core, Wolverine (command bus), Marten (PostgreSQL, document store + event sourcing), React 19 / TypeScript / Vite / Tailwind CSS / React Router v7, FusionAuth (auth), .NET Aspire (orchestration), xUnit + Alba (integration tests)
- **Created:** 2026-03-29

## Learnings

- `GroceryItem.Store` is `string?` — `null`/`""` means Master List (unassigned). Stores are implicit; no separate store entity.
- When Aspire is running, `dotnet build` may fail due to file locks from the server process. Use `Stop-Process -Id <PID>` on the specific process ID holding the lock, then build with `--disable-build-servers`.
- `ClearPurchasedItemsCommand` now accepts optional `string? Store` param; `null` = clear all (backwards compat).
