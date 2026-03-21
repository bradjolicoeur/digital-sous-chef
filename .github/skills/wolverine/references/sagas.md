# Wolverine Sagas — Stateful Long-Running Processes

A "saga" in Wolverine is a stateful, long-running process that tracks state between steps.
It's also called a "process manager" in Enterprise Integration Patterns.

## Core Structure

```csharp
// 1. Define messages that drive the saga
public record StartOrder(string OrderId);
public record PaymentReceived(string OrderId, decimal Amount);
public record OrderTimeout(string OrderId) : TimeoutMessage(30.Minutes()); // auto-scheduled

// 2. Define the saga state class — inherits from Saga
public class OrderSaga : Saga
{
    // Id property is required — Wolverine uses this to load/save the saga
    public string? Id { get; set; }
    public decimal AmountPaid { get; set; }
    public bool IsCompleted { get; set; }

    // Static Start() method creates a NEW saga instance
    // Can return (SagaState, messages...) or just the state
    public static (OrderSaga, OrderTimeout) Start(StartOrder cmd, ILogger<OrderSaga> log)
    {
        log.LogInformation("Starting order saga {Id}", cmd.OrderId);
        return (
            new OrderSaga { Id = cmd.OrderId },
            new OrderTimeout(cmd.OrderId)  // scheduled automatically
        );
    }

    // Handle() methods on the saga class update the state
    public IEnumerable<object> Handle(PaymentReceived evt, ILogger<OrderSaga> log)
    {
        AmountPaid += evt.Amount;
        log.LogInformation("Payment received for order {Id}: {Amount}", Id, evt.Amount);

        if (AmountPaid >= RequiredTotal)
        {
            MarkCompleted(); // Deletes saga state after this handler runs
            yield return new OrderFulfilled(Id!);
        }
    }

    // Handle timeout — cancel the order if not completed
    public void Handle(OrderTimeout timeout)
    {
        if (!IsCompleted) MarkCompleted();
    }

    // Optional — called when an incoming message references a saga that doesn't exist
    public static void NotFound(PaymentReceived evt, ILogger<OrderSaga> log)
        => log.LogWarning("Order {Id} not found when processing payment", evt.OrderId);
}
```

## Saga Identity — Connecting Messages to Saga Instances

Wolverine connects messages to sagas via a shared property. The message property name must match the saga `Id` property by convention, or use `[SagaIdentity]`:

```csharp
// Convention: OrderId on the message maps to Id on OrderSaga
public record PaymentReceived(string OrderId, decimal Amount); // "OrderId" -> saga "Id"

// Explicit mapping with attribute
public record PaymentReceived(
    [property: SagaIdentity] string PaymentReference, // maps to saga Id
    decimal Amount);

// Guid-based saga identity
public class ShipmentSaga : Saga
{
    public Guid Id { get; set; }
}
public record ShipmentCreated(Guid ShipmentId); // ShipmentId -> Guid Id
```

## Saga Persistence Options

### With Marten (PostgreSQL — recommended)

```csharp
opts.Services.AddMarten(cfg => cfg.Connection(connectionString))
    .IntegrateWithWolverine();
opts.Policies.AutoApplyTransactions();
// No extra configuration — Marten stores sagas as documents automatically
```

### With EF Core

```csharp
// 1. Add DbSet to your DbContext
public class AppDbContext : DbContext
{
    public DbSet<OrderSaga> OrderSagas { get; set; }
    // EF Core handles the mapping
}

// 2. Configure Wolverine
opts.UseEntityFrameworkCoreTransactions();
opts.PersistMessagesWithSqlServer(connectionString);
```

### With PostgreSQL (bare)

```csharp
opts.PersistMessagesWithPostgresql(connectionString);
// Wolverine creates a saga storage table automatically
```

## Saga Lifecycle

| State | When |
|-------|------|
| Created | `Start()` method called with the initiating message |
| Loaded | Subsequent messages look up existing saga by Id |
| `MarkCompleted()` | Saga state is deleted after handler finishes |
| `NotFound()` | Static method, called when saga not found for a non-start message |

## Cascading from Sagas

```csharp
public class OrderSaga : Saga
{
    // Return messages to cascade
    public OrderApproved Handle(ApproveOrder cmd)
    {
        Status = "Approved";
        MarkCompleted();
        return new OrderApproved(Id!);
    }

    // Return multiple
    public (OrderApproved, SendConfirmation) Handle(ApproveOrder cmd)
    {
        MarkCompleted();
        return (new OrderApproved(Id!), new SendConfirmation(Id!));
    }
}
```

## HTTP Endpoint Integration (Sagas via HTTP)

```csharp
// Start a saga from an HTTP endpoint
[WolverinePost("/orders")]
public static (CreationResponse, StartOrder) Post(CreateOrderRequest req)
    => (CreationResponse.For($"/orders/{req.OrderId}"), new StartOrder(req.OrderId));
```

## Testing Sagas

```csharp
// Unit test — test saga state transitions directly
[Fact]
public void payment_completes_order()
{
    var saga = new OrderSaga { Id = "order-1", RequiredTotal = 100m };
    var messages = saga.Handle(new PaymentReceived("order-1", 100m), NullLogger<OrderSaga>.Instance);
    saga.IsCompleted.ShouldBeTrue();
    messages.ShouldContain(m => m is OrderFulfilled);
}

// Integration test — use tracked sessions to wait for all saga steps
[Fact]
public async Task full_saga_flow()
{
    await Host.InvokeMessageAndWaitAsync(new StartOrder("order-1"));
    await Host.InvokeMessageAndWaitAsync(new PaymentReceived("order-1", 100m));
    // Assert final state in DB
}
```

## Multi-Tenancy and Sagas

```csharp
// Saga identity must be unique per tenant
// Pass TenantId in DeliveryOptions when invoking:
await bus.InvokeAsync(new StartOrder("order-1"),
    new DeliveryOptions { TenantId = "tenant-abc" });
```
