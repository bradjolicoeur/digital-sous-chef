# Marten Integration Testing Reference

## Packages

```bash
dotnet add package Marten
dotnet add package Alba                   # ASP.NET Core integration test host
dotnet add package xunit
dotnet add package xunit.runner.visualstudio
dotnet add package Microsoft.AspNetCore.Mvc.Testing
```

## PostgreSQL Test Database

Use Docker for a dedicated test database:

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - "5433:5432"   # use 5433 to avoid conflicts with dev DB
```

```bash
docker compose up -d
```

Connection string for tests:
```
"Host=localhost;Port=5433;Database=postgres;Username=postgres;Password=postgres"
```

## AppFixture Pattern (Shared Host)

Create one `AlbaHost` per test class grouping to avoid slow startup overhead:

```csharp
// AppFixture.cs
public class AppFixture : IAsyncLifetime
{
    public IAlbaHost Host { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Host = await AlbaHost.For<Program>(b =>
        {
            // Override any services for testing
            b.ConfigureServices((ctx, services) =>
            {
                services.MartenDaemonModeIsSolo();  // Marten V8.8+ — faster daemon startup
            });
        });
    }

    public async Task DisposeAsync()
    {
        await Host.DisposeAsync();
    }
}
```

## Collection Definition (Shared Fixture)

Share the `AppFixture` across multiple test classes in the same file/assembly to avoid creating a new host per class:

```csharp
// IntegrationCollection.cs
[CollectionDefinition("integration")]
public class IntegrationCollection : ICollectionFixture<AppFixture>;

// Apply to test classes
[Collection("integration")]
public class OrderTests : IntegrationContext
{
    public OrderTests(AppFixture fixture) : base(fixture) { }

    [Fact]
    public async Task place_order()
    {
        // ...
    }
}
```

## IntegrationContext Base Class

```csharp
public abstract class IntegrationContext : IAsyncLifetime
{
    protected readonly AppFixture Fixture;
    protected IAlbaHost Host => Fixture.Host;

    protected IntegrationContext(AppFixture fixture)
    {
        Fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        // Clean all data before each test
        await Host.ResetAllMartenData();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    // Convenience accessor
    protected IDocumentStore Store => Host.DocumentStore();
}
```

## Test Data Reset

```csharp
// Extension method from Marten — truncates all Marten tables
await host.ResetAllMartenData();

// Or directly via store
var store = host.DocumentStore();
await store.Advanced.ResetAllData();
```

**Important**: Call this in `InitializeAsync()` (before each test), not in `DisposeAsync()`, so failures leave data for debugging.

## Per-Test Schema Isolation

For truly isolated tests that can run in parallel without interference:

```csharp
// Each test fixture gets its own schema
public class IsolatedTestFixture : IAsyncLifetime
{
    public IAlbaHost Host { get; private set; } = null!;
    private readonly string _schemaName = "sch" + Guid.NewGuid().ToString().Replace("-", "");

    public async Task InitializeAsync()
    {
        Host = await AlbaHost.For<Program>(b =>
        {
            b.ConfigureServices((ctx, services) =>
            {
                services.AddMarten(opts =>
                {
                    opts.Connection(TestConnectionString);
                    opts.DatabaseSchemaName = _schemaName;
                });
            });
        });
    }

    public async Task DisposeAsync()
    {
        // Schema is cleaned up automatically when connection drops
        await Host.DisposeAsync();
    }
}
```

## MartenDaemonModeIsSolo (Marten V8.8+)

```csharp
// Extension method in the Marten testing package
services.MartenDaemonModeIsSolo();

// This disables multi-node leader election in tests — daemon starts immediately
// Without this, HotCold daemon takes time for leader election which slows tests
```

## Sending HTTP Requests via Alba

```csharp
[Fact]
public async Task post_order_returns_created()
{
    var result = await Host.Scenario(x =>
    {
        x.Post.Json(new PlaceOrderCommand { CustomerId = "cust-1" }).ToUrl("/api/orders");
        x.StatusCodeShouldBe(201);
    });

    var order = result.ReadAsJson<OrderResponse>();
    order.ShouldNotBeNull();
    order.Status.ShouldBe("Placed");
}
```

## Testing Event Projections

```csharp
[Fact]
public async Task order_projection_reflects_shipped_status()
{
    var orderId = Guid.NewGuid();

    // Arrange: append events directly
    await using var session = Store.LightweightSession();
    session.Events.StartStream<Order>(orderId,
        new OrderPlaced(orderId, "cust-1", DateTimeOffset.UtcNow),
        new OrderShipped(orderId, "TRACK-123", DateTimeOffset.UtcNow));
    await session.SaveChangesAsync();

    // For Async projections — wait for daemon to process
    var daemon = await Store.BuildProjectionDaemonAsync();
    await daemon.WaitForNonStaleProjectionDataAsync(TimeSpan.FromSeconds(15));

    // Assert: verify projected document
    await using var querySession = Store.QuerySession();
    var summary = await querySession.LoadAsync<OrderSummary>(orderId);

    summary.ShouldNotBeNull();
    summary.Status.ShouldBe("Shipped");
    summary.TrackingNumber.ShouldBe("TRACK-123");
}
```

## Testing Document Storage

```csharp
[Fact]
public async Task can_store_and_reload_order()
{
    var order = new Order
    {
        Id = Guid.NewGuid(),
        CustomerId = "cust-42",
        Status = "Pending"
    };

    await using var session = Store.LightweightSession();
    session.Store(order);
    await session.SaveChangesAsync();

    await using var readSession = Store.QuerySession();
    var loaded = await readSession.LoadAsync<Order>(order.Id);

    loaded.ShouldNotBeNull();
    loaded.CustomerId.ShouldBe("cust-42");
    loaded.Status.ShouldBe("Pending");
}
```

## Testing HTTP Endpoint + Marten Together

```csharp
[Fact]
public async Task shipping_endpoint_updates_order_status()
{
    // Arrange: seed data
    var orderId = Guid.NewGuid();
    await using var session = Store.LightweightSession();
    session.Events.StartStream<Order>(orderId,
        new OrderPlaced(orderId, "cust-1", DateTimeOffset.UtcNow));
    await session.SaveChangesAsync();

    // Act: call HTTP endpoint
    await Host.Scenario(x =>
    {
        x.Post.Json(new ShipOrderCommand { OrderId = orderId, TrackingNumber = "TRK-1" })
              .ToUrl($"/api/orders/{orderId}/ship");
        x.StatusCodeShouldBe(200);
    });

    // Assert: check projected state (wait for async if needed)
    await using var querySession = Store.QuerySession();
    var order = await querySession.Events.FetchLatest<Order>(orderId);
    order.Status.ShouldBe("Shipped");
}
```

## Common Test Helpers

```csharp
// Get store from host
var store = host.DocumentStore();

// Get store as extension method (from Marten.Testing or custom)
public static IDocumentStore DocumentStore(this IAlbaHost host)
    => host.Services.GetRequiredService<IDocumentStore>();

// Wait for daemon (avoid flaky async projection tests)
var daemon = await store.BuildProjectionDaemonAsync();
await daemon.WaitForNonStaleProjectionDataAsync(TimeSpan.FromSeconds(30));

// Reset data between tests
await store.Advanced.ResetAllData();
```

## Full Example Test Class

```csharp
[Collection("integration")]
public class OrderIntegrationTests : IntegrationContext
{
    public OrderIntegrationTests(AppFixture fixture) : base(fixture) { }

    [Fact]
    public async Task place_order_creates_document()
    {
        // Reset is called by IntegrationContext.InitializeAsync()

        // Seed event
        var orderId = Guid.NewGuid();
        await using var session = Store.LightweightSession();
        session.Events.StartStream<Order>(orderId,
            new OrderPlaced(orderId, "cust-1", DateTimeOffset.UtcNow));
        await session.SaveChangesAsync();

        // Query
        await using var q = Store.QuerySession();
        var order = await q.Events.FetchLatest<Order>(orderId);

        order.ShouldNotBeNull();
        order.Status.ShouldBe("Placed");
    }

    [Fact]
    public async Task post_to_api_creates_order()
    {
        var result = await Host.Scenario(x =>
        {
            x.Post.Json(new PlaceOrderRequest { CustomerId = "cust-99" })
                  .ToUrl("/api/orders");
            x.StatusCodeShouldBe(201);
        });

        var body = result.ReadAsJson<OrderResponse>();
        body!.CustomerId.ShouldBe("cust-99");
    }
}
```
