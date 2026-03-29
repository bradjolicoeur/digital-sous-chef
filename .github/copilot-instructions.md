# Digital Sous Chef — Copilot Instructions

## Project Overview

Digital Sous Chef is a recipe management and meal planning app. It uses:
- **.NET 10 / ASP.NET Core** backend with **Wolverine** for all command/query handling
- **Marten** (PostgreSQL) for document storage and event sourcing
- **.NET Aspire** for orchestration (AppHost coordinates all services)
- **React 19 / TypeScript / Vite / Tailwind CSS / React Router v7** frontend
- **FusionAuth** for authentication (self-hosted via Docker, React SDK on the frontend)
- **xUnit + Alba** for integration testing (preferred over unit tests)

The mockup in `mockup/` is the design source of truth for UI layout and UX patterns.

---

## Backend Conventions

### Wolverine — Command & Query Handling

**Wolverine is the primary command bus. Never use MediatR or raw controllers for business logic.**

- Use `WolverineFx.Http` attributes (`[WolverinePost]`, `[WolverineGet]`, `[WolverinePut]`, `[WolverineDelete]`) for HTTP endpoints
- Handlers are `public` classes ending in `Handler` with `Handle` or `HandleAsync` methods
- Prefer `static` methods on handlers — they signal dependencies explicitly
- The first parameter is the message (command/query); all other parameters are injected services
- Return values cascade automatically as new messages — use this instead of calling `bus.PublishAsync` in handlers
- Use `AutoApplyTransactions()` globally rather than `[Transactional]` on each handler

```csharp
// Endpoint definition
public static class RecipeEndpoints
{
    [WolverinePost("/api/recipes")]
    public static async Task<IResult> CreateRecipe(
        CreateRecipeCommand cmd,
        IMessageBus bus)
    {
        var result = await bus.InvokeAsync<RecipeCreated>(cmd);
        return Results.Created($"/api/recipes/{result.RecipeId}", result);
    }

    [WolverineGet("/api/recipes/{id}")]
    public static async Task<IResult> GetRecipe(
        Guid id,
        IQuerySession session)
    {
        var recipe = await session.LoadAsync<Recipe>(id);
        return recipe is null ? Results.NotFound() : Results.Ok(recipe);
    }
}

// Command handler
public class CreateRecipeHandler
{
    public static async Task<RecipeCreated> Handle(
        CreateRecipeCommand cmd,
        IDocumentSession session)
    {
        var recipe = new Recipe { Id = Guid.NewGuid(), Title = cmd.Title, /* ... */ };
        session.Store(recipe);
        return new RecipeCreated(recipe.Id);
    }
}
```

### Message Design

- Commands and events are `record` types (immutable by nature)
- Commands are imperative: `CreateRecipe`, `AddToGroceryList`, `PlanMeal`
- Events are past-tense: `RecipeCreated`, `MealPlanned`, `GroceryItemAdded`
- No base classes or interfaces on messages

```csharp
public record CreateRecipeCommand(string Title, string Description, List<IngredientDto> Ingredients);
public record RecipeCreated(Guid RecipeId);
```

### Marten — Document Storage and Event Sourcing

**Inject `IDocumentSession` for read/write, `IQuerySession` for read-only.**

- Always use `LightweightSession` (no dirty tracking, no identity map) — configured via `.UseLightweightSessions()`
- Always `await session.SaveChangesAsync()` to persist changes
- For CQRS write operations on event-sourced aggregates, use `FetchForWriting<T>`:

```csharp
public static async Task Handle(AddIngredientToRecipe cmd, IDocumentSession session)
{
    var stream = await session.Events.FetchForWriting<Recipe>(cmd.RecipeId);
    var recipe = stream.Aggregate ?? throw new InvalidOperationException("Recipe not found");

    stream.AppendOne(new IngredientAdded(cmd.RecipeId, cmd.Ingredient));
    await session.SaveChangesAsync();
}
```

**Document (non-event) patterns — use for simple state:**

```csharp
// Upsert
session.Store(document);

// Load
var doc = await session.LoadAsync<T>(id);

// LINQ query
var results = await session.Query<Recipe>()
    .Where(x => x.Category == category)
    .OrderBy(x => x.Title)
    .ToListAsync();

// Delete
session.Delete<T>(id);
session.DeleteWhere<Recipe>(x => x.IsArchived);
```

**Projections:**

- Use `SnapshotLifecycle.Inline` for aggregates that must be immediately consistent
- Use `ProjectionLifecycle.Async` for read models (requires Async Daemon)
- Self-aggregating documents define `Create()` / `Apply()` / `ShouldDelete()` methods on the document type
- Register in `Program.cs` via `opts.Projections.Snapshot<T>(lifecycle)` or `opts.Projections.Add<TProjection>(lifecycle)`

**Event appending performance:**

```csharp
// Set in Program.cs for production performance
opts.Events.AppendMode = EventAppendMode.Quick;
```

### Program.cs — Startup Conventions

Use the Aspire-idiomatic pattern with Wolverine + Marten:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();  // Aspire: OpenTelemetry, health checks, resilience

builder.Host.UseWolverine(opts =>
{
    opts.Policies.AutoApplyTransactions();
    opts.Policies.UseDurableLocalQueues();
});

builder.Services.AddWolverineHttp();

builder.Services.AddMarten(opts =>
{
    opts.Connection(builder.Configuration.GetConnectionString("marten")!);
    opts.DatabaseSchemaName = "souschef";
    opts.Events.AppendMode = EventAppendMode.Quick;
    // register projections here
})
.UseLightweightSessions()
.UseNpgsqlDataSource()
.IntegrateWithWolverine()        // Transactional outbox + Marten/Wolverine integration
.AddAsyncDaemon(DaemonMode.HotCold);  // for async projections

var app = builder.Build();

app.MapDefaultEndpoints();        // Aspire health checks
app.MapWolverineEndpoints();      // Wolverine.Http routes

return await app.RunJasperFxCommands(args);  // Wolverine CLI tools
```

### Schema / Migrations

- Use `AutoCreate.CreateOrUpdate` in development
- Use `opts.ApplyAllDatabaseChangesOnStartup()` or the CLI for production: `dotnet run -- db-apply`
- Never manually write SQL schema — let Marten manage it

---

## Frontend Conventions

### React + TypeScript

- Functional components only — no class components
- All props and state have explicit TypeScript types — avoid `any`
- Component files use `.tsx`, utility files use `.ts`
- Components are named with PascalCase; files match the component name
- Use `const` arrow functions for components:

```tsx
interface RecipeCardProps {
  recipe: Recipe;
  onSelect: (id: string) => void;
}

const RecipeCard = ({ recipe, onSelect }: RecipeCardProps) => {
  return (
    <div onClick={() => onSelect(recipe.id)}>
      {/* ... */}
    </div>
  );
};

export default RecipeCard;
```

### Tailwind CSS

- Use Tailwind utility classes exclusively — no inline `style` props, no external CSS modules
- Follow the mockup design patterns from `mockup/src/` for spacing, colors, and layout
- Use responsive prefixes (`sm:`, `md:`, `lg:`) for adaptive layout
- Compose complex class strings with the `cn()` utility (from `lib/utils.ts`) for conditionals

### React Router v7

- Define all routes in `App.tsx`
- Use `<Link>` for navigation, `useNavigate()` for programmatic navigation
- Use `useParams()` for route params, `useSearchParams()` for query strings
- Route structure mirrors the mockup: `/`, `/gallery`, `/recipe/:id`, `/planner`, `/grocery`

### API Communication

- Use `fetch` with the `/api/*` prefix — the Vite dev proxy forwards to the .NET backend
- Centralize API calls in a service module (e.g., `src/api/recipes.ts`)
- Always handle loading, success, and error states
- Type API responses against the shared domain types in `src/types.ts`

---

## Testing Conventions

**Favor integration tests over unit tests.** The entire HTTP stack, Wolverine handlers, and Marten persistence should be tested together via Alba.

### Test Project Setup

```bash
dotnet add package xunit
dotnet add package xunit.runner.visualstudio
dotnet add package Alba
dotnet add package Marten
dotnet add package Shouldly   # preferred for assertions
```

### AppFixture (Shared Host)

```csharp
// TestFixtures/AppFixture.cs
public class AppFixture : IAsyncLifetime
{
    public IAlbaHost Host { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Host = await AlbaHost.For<Program>(b =>
        {
            b.ConfigureServices((_, services) =>
            {
                services.MartenDaemonModeIsSolo(); // faster daemon startup in tests
            });
        });
    }

    public async Task DisposeAsync() => await Host.DisposeAsync();
}

[CollectionDefinition("integration")]
public class IntegrationCollection : ICollectionFixture<AppFixture>;
```

### IntegrationContext Base Class

```csharp
// TestFixtures/IntegrationContext.cs
public abstract class IntegrationContext : IAsyncLifetime
{
    protected readonly AppFixture Fixture;
    protected IAlbaHost Host => Fixture.Host;
    protected IDocumentStore Store => Host.Services.GetRequiredService<IDocumentStore>();

    protected IntegrationContext(AppFixture fixture) => Fixture = fixture;

    public async Task InitializeAsync()
    {
        // Always clean data before each test — never rely on state from prior tests
        await Store.Advanced.ResetAllData();
    }

    public Task DisposeAsync() => Task.CompletedTask;
}
```

### Writing Tests

```csharp
[Collection("integration")]
public class RecipeTests : IntegrationContext
{
    public RecipeTests(AppFixture fixture) : base(fixture) { }

    [Fact]
    public async Task create_recipe_returns_201_with_id()
    {
        var result = await Host.Scenario(x =>
        {
            x.Post.Json(new { Title = "Caesar Salad", Description = "Classic salad" })
                  .ToUrl("/api/recipes");
            x.StatusCodeShouldBe(201);
        });

        var body = result.ReadAsJson<RecipeCreatedResponse>();
        body!.RecipeId.ShouldNotBe(Guid.Empty);
    }

    [Fact]
    public async Task get_recipe_returns_created_recipe()
    {
        // Arrange — seed directly via Marten
        var recipe = new Recipe { Id = Guid.NewGuid(), Title = "Buddha Bowl" };
        await using var session = Store.LightweightSession();
        session.Store(recipe);
        await session.SaveChangesAsync();

        // Act + Assert via HTTP
        await Host.Scenario(x =>
        {
            x.Get.Url($"/api/recipes/{recipe.Id}");
            x.StatusCodeShouldBe(200);
        });
    }
}
```

### Testing Async Projections

Wait for the daemon to catch up before asserting on projected documents:

```csharp
[Fact]
public async Task meal_plan_projection_updates_after_meal_planned()
{
    // Arrange — append events
    var planId = Guid.NewGuid();
    await using var session = Store.LightweightSession();
    session.Events.StartStream<MealPlan>(planId, new MealPlanned(planId, "Monday", "Caesar Salad"));
    await session.SaveChangesAsync();

    // Wait for async projection
    var daemon = await Store.BuildProjectionDaemonAsync();
    await daemon.WaitForNonStaleProjectionDataAsync(TimeSpan.FromSeconds(15));

    // Assert
    await using var q = Store.QuerySession();
    var plan = await q.LoadAsync<MealPlan>(planId);
    plan!.Meals.ShouldContain(x => x.Day == "Monday");
}
```

### Testing Rules

- Test names use snake_case and describe behavior: `create_recipe_returns_201_with_id`
- One logical assertion per test (multiple `ShouldBe` calls on the same object are fine)
- Seed data via Marten sessions directly — don't call endpoints just to set up data
- Never share mutable state between tests — `ResetAllData()` in `InitializeAsync` enforces this
- Use `Shouldly` for assertions (`ShouldBe`, `ShouldNotBeNull`, `ShouldContain`)

---

## File & Folder Conventions

### Backend (`src/DigitalSousChef/DigitalSousChef.Server/`)

```
Features/
  Recipes/
    RecipeEndpoints.cs        # WolverineHttp endpoint definitions
    CreateRecipe.cs           # Command + Handler (co-located)
    GetRecipe.cs              # Query + Handler
    Recipe.cs                 # Domain document/aggregate
    RecipeProjection.cs       # Projection (if separate from document)
  MealPlanner/
    ...
  GroceryList/
    ...
```

- Co-locate commands, handlers, and domain types by feature (vertical slice)
- One file per command/query unless they are trivially small; then group as `RecipeQueries.cs`
- No `Services/` layer — Wolverine handlers ARE the service layer

### Frontend (`src/DigitalSousChef/digitalsouschef.client/src/`)

```
api/
  recipes.ts                   # API client functions
  planner.ts
components/
  RecipeCard.tsx
  TopNavBar.tsx
pages/
  HomePage.tsx
  GalleryPage.tsx
  RecipeDetailPage.tsx
  PlannerPage.tsx
  GroceryListPage.tsx
types.ts                       # Shared TypeScript types (match backend DTOs)
```

### Tests (`src/DigitalSousChef/DigitalSousChef.Tests/`)

```
TestFixtures/
  AppFixture.cs
  IntegrationContext.cs
Features/
  Recipes/
    CreateRecipeTests.cs
    GetRecipeTests.cs
  MealPlanner/
    ...
```

---

## Key Package Reference

| Purpose | Package |
|---------|---------|
| Command bus / messaging | `WolverineFx` |
| HTTP endpoints | `WolverineFx.Http` |
| Marten integration | `WolverineFx.Marten` |
| Document DB + Event Store | `Marten` |
| Integration test host | `Alba` |
| Test framework | `xunit`, `xunit.runner.visualstudio` |
| Assertions | `Shouldly` |
| Aspire orchestration | `Aspire.Hosting.NodeJs` (AppHost) |
| Service defaults | `DigitalSousChef.ServiceDefaults` (internal) |
| Auth — React frontend | `@fusionauth/react-sdk` |
| Auth — .NET backend validation | `Microsoft.AspNetCore.Authentication.JwtBearer` |

---

## Skills

Detailed patterns and API references for the key libraries:

- **Wolverine**: `.github/skills/wolverine/SKILL.md` + `references/` subfolder
- **Marten**: `.github/skills/marten/SKILL.md` + `references/` subfolder
- **FusionAuth**: `.github/skills/fusionauth/SKILL.md`
- **Playwright Login**: `.github/skills/playwright-login/SKILL.md`

Load these when working with Wolverine handlers, Marten event sourcing, projections, testing patterns, FusionAuth authentication, or when logging in via Playwright to validate UI changes.
