# Wolverine Durability — Transactional Outbox/Inbox

## Why Outbox/Inbox?

Without the outbox pattern, messages published inside a transaction can be lost if:
- The database commit fails after messages are sent
- The process crashes between DB commit and message send
- Network issues prevent message delivery

Wolverine's outbox stores outgoing messages in the same database transaction as your data changes, then delivers them reliably after commit.

## EF Core Setup

```bash
dotnet add package WolverineFx.EntityFrameworkCore
dotnet add package WolverineFx.SqlServer  # or WolverineFx.Postgresql
```

```csharp
builder.UseWolverine(opts =>
{
    // Tell Wolverine where to store message envelopes
    opts.PersistMessagesWithSqlServer(connectionString); // or PersistMessagesWithPostgresql

    // Enable EF Core transactional middleware + saga support
    opts.UseEntityFrameworkCoreTransactions();

    // Auto-apply [Transactional] to all handlers that use DbContext
    opts.Policies.AutoApplyTransactions();
});

// Register DbContext with Singleton options lifetime (performance optimization)
builder.Services.AddDbContextWithWolverineIntegration<AppDbContext>(
    x => x.UseSqlServer(connectionString));
// -- or manually:
builder.Services.AddDbContext<AppDbContext>(
    x => x.UseSqlServer(connectionString),
    optionsLifetime: ServiceLifetime.Singleton);
```

## Marten Setup

```bash
dotnet add package WolverineFx.Marten
```

```csharp
builder.Host.UseWolverine(opts =>
{
    opts.Policies.AutoApplyTransactions();
});

builder.Services.AddMarten(cfg =>
{
    cfg.Connection(connectionString);
}).IntegrateWithWolverine(); // Adds outbox tables to Marten's PostgreSQL schema
```

## Using the Outbox

### Approach 1: `[Transactional]` Attribute

```csharp
[Transactional]
public static async Task Handle(
    CreateOrder cmd,
    IDocumentSession session,      // Marten or EF Core
    IMessageContext messaging)     // Current message context
{
    session.Store(new Order { ... });

    // These messages are held in the outbox until the DB transaction commits
    await messaging.PublishAsync(new OrderCreated(cmd.OrderId));
    await messaging.ScheduleAsync(new ExpireOrder(cmd.OrderId), 30.Days());
}
```

### Approach 2: `AutoApplyTransactions()` (recommended)

No attribute needed — Wolverine detects `IDocumentSession` or `DbContext` parameters and wraps automatically:

```csharp
// With AutoApplyTransactions() configured, no [Transactional] needed
public static OrderCreated Handle(CreateOrder cmd, IDocumentSession session)
{
    session.Store(new Order { ... });
    return new OrderCreated(cmd.OrderId); // cascaded within same transaction
}
```

### Approach 3: Outbox in HTTP Endpoints

```csharp
[WolverinePost("/orders")]
public static (CreationResponse, OrderCreated) Post(
    CreateOrderRequest req,
    IDocumentSession session)  // Outbox auto-applied via AutoApplyTransactions
{
    var order = new Order { ... };
    session.Store(order);
    return (CreationResponse.For($"/orders/{order.Id}"), new OrderCreated(order.Id));
}
```

## Durability Modes

```csharp
// For single-node deployments
opts.Durability.Mode = DurabilityMode.Solo;

// For multi-node deployments (default — uses leader election)
opts.Durability.Mode = DurabilityMode.Balanced;

// For serverless — disables inbox/outbox
opts.ServerlessMode();
```

## Dead Letter Queue / Error Storage

```csharp
// Store dead letters in the database for replay
opts.Policies.OnException<Exception>()
    .MoveToErrorQueue();

// Access dead letters programmatically
var deadLetters = host.Services.GetRequiredService<IDeadLetterStorage>();
await deadLetters.ReplayAllAsync(); // replay from dead letter queue
```

## Managing Durability

```csharp
// Rebuild envelope storage (e.g., in tests or migrations)
await host.ResetResourceState();

// Apply database schema (creates envelope tables)
builder.Services.AddResourceSetupOnStartup(); // auto-create on startup
```

## Scheduled Messages

```csharp
// Schedule from a handler
await messaging.ScheduleAsync(new ExpireOrder(orderId), 30.Days());
await messaging.ScheduleAsync(new RemindUser(userId), DateTimeOffset.UtcNow.AddHours(2));

// Schedule from application code
await bus.ScheduleAsync(new RemindUser(userId), 4.Hours());

// TimeoutMessage self-schedules (used in sagas)
public record OrderTimeout(string Id) : TimeoutMessage(1.Hours());
```

## EF Core Domain Events

```csharp
// Raise domain events from entities
public class Order : IDomainEventSource  // or use OutboxedEvent interface
{
    private readonly List<object> _events = new();
    public IReadOnlyList<object> DomainEvents => _events;

    public void Complete()
    {
        Status = OrderStatus.Completed;
        _events.Add(new OrderCompleted(Id));
    }
}

// Enable domain event capturing
opts.UseEntityFrameworkCoreTransactions();
// Wolverine automatically publishes domain events after DbContext.SaveChangesAsync()
```

## Modular Monolith — Shared Envelope Storage

```csharp
// Share the same outbox tables across all Marten stores
opts.Durability.MessageStorageSchemaName = "wolverine";

opts.Services.AddMarten(...).IntegrateWithWolverine();
opts.Services.AddMartenStore<IOrderStore>(...)
    .IntegrateWithWolverine(); // Uses same schema via MessageStorageSchemaName
```
