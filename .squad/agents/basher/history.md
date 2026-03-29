# Project Context

- **Owner:** Brad Jolicoeur
- **Project:** Digital Sous Chef — recipe organization app with gallery (scan/store recipes), meal planner, and grocery shopping list
- **Stack:** .NET 10 / ASP.NET Core, Wolverine (command bus), Marten (PostgreSQL, document store + event sourcing), React 19 / TypeScript / Vite / Tailwind CSS / React Router v7, FusionAuth (auth), .NET Aspire (orchestration), xUnit + Alba (integration tests)
- **Created:** 2026-03-29

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-29 — Test infrastructure bootstrapped

- **No test project existed** before this session. `DigitalSousChef.Tests` was created from scratch with `dotnet new xunit`.
- **Auth bypass pattern**: All Wolverine HTTP endpoints require authorization (`opts.RequireAuthorizeOnAll()`). Tests use a `TestAuthHandler` that always returns `AuthenticateResult.Success` with a known `sub` claim (`test-user-001`). The test auth scheme is registered in `AppFixture.ConfigureServices`, overriding JwtBearer defaults so FusionAuth is never contacted.
- **Connection string**: `AddNpgsqlDataSource("marten")` reads from `ConnectionStrings:marten` in `IConfiguration`. AppFixture reads `MARTEN_CONNECTION_STRING` or `ConnectionStrings__marten` env vars, falling back to `localhost:5432/souschef_test`. Aspire injects `ConnectionStrings__marten` for server child processes but NOT for standalone `dotnet test` runs — developers must set this manually for test isolation.
- **`public partial class Program {}`** is required in `Program.cs` so `AlbaHost.For<Program>` can locate the entry point from the test assembly.
- **Naming collision**: The server feature folder and the document class are both named `GroceryList`. In the test project, use a type alias (`using GroceryListDoc = DigitalSousChef.Server.Features.GroceryList.GroceryList`) to avoid ambiguity.
- **Forward-looking tests**: The grocery list store-assignment tests reference `GroceryItem.Store` (and related command/endpoint changes) which don't exist yet. Tests will have compile errors until Rusty adds the `Store` property — this is intentional (test-first for spec 4.5).
- **Response DTOs**: Test files define `file record` response DTOs (not sharing server domain types) for deserialization from `result.ReadAsJson<T>()`. This decouples assertions from server model evolution.

📌 Team update (2026-03-29T21:15:00Z): CI/CD bootstrap complete — `.github/workflows/ci.yml` runs `dotnet test` with `continue-on-error: true` (no postgres yet). Next step: add `postgres:17` service container to `test-backend` job and remove `continue-on-error`. — decided by Livingston

