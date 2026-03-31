# Project Context

- **Owner:** Brad Jolicoeur
- **Project:** Digital Sous Chef — recipe organization app with gallery (scan/store recipes), meal planner, and grocery shopping list
- **Stack:** .NET 10 / ASP.NET Core, Wolverine (command bus), Marten (PostgreSQL, document store + event sourcing), React 19 / TypeScript / Vite / Tailwind CSS / React Router v7, FusionAuth (auth), .NET Aspire (orchestration), xUnit + Alba (integration tests)
- **Created:** 2026-03-29

## Learnings

- `GroceryItem.Store` is `string?` — `null`/`""` means Master List (unassigned). Stores are implicit; no separate store entity.
- When Aspire is running, `dotnet build` may fail due to file locks from the server process. Use `Stop-Process -Id <PID>` on the specific process ID holding the lock, then build with `--disable-build-servers`.
- `ClearPurchasedItemsCommand` now accepts optional `string? Store` param; `null` = clear all (backwards compat).
- Replaced `app.MapStaticAssets()` with `app.UseStaticFiles()` in Program.cs (2026-03-31). `MapStaticAssets()` is .NET 9/10's build-pipeline-integrated static file serving that relies on a publish-time manifest for fingerprinted assets — it does NOT serve arbitrary files dropped into wwwroot at Docker build time. `UseStaticFiles()` serves any files placed in wwwroot conventionally, which is required when the Vite build output is copied into wwwroot by the Docker build process.

📌 Team update (2026-03-29T21:15:00Z): CI/CD bootstrap complete — `Dockerfile.server`, `Dockerfile.client`, `nginx.conf`, `.dockerignore`, `.github/workflows/ci.yml` committed to main. Backend tests run in CI with `continue-on-error: true` (no postgres service container yet). — decided by Livingston

📌 Team update (2026-03-31T08:30:04Z): Single-image deployment model complete — `Dockerfile.server` three-stage build, `Program.cs` static file handler update, `ci.yml` simplified. Livingston + Rusty. — decided by Livingston
