---
name: wolverine
description: "Use when building with Wolverine (WolverineFx) message handlers, command bus, mediator, pub/sub messaging, HTTP endpoints, sagas, outbox/inbox, or middleware in .NET. Covers: UseWolverine, IMessageBus, message handlers, cascading messages, side effects, transactional outbox, durable messaging, sagas, Wolverine.Http, WolverinePost/Get/Put/Delete attributes, EF Core integration, Marten integration, error handling, retry policies, testing with tracked sessions."
---

# Wolverine (WolverineFx) Skill

Wolverine is a .NET toolset for command execution and message handling. It operates as:
1. An inline mediator (replace MediatR with zero interfaces required)
2. A local message bus for in-process communication
3. A full async messaging framework (RabbitMQ, SQS, Azure Service Bus, Kafka, etc.)
4. HTTP endpoint provider via `WolverineFx.Http`

**Full docs**: https://wolverinefx.net/llms-full.txt

## Setup

```bash
dotnet add package WolverineFx                    # Core
dotnet add package WolverineFx.Http               # HTTP endpoints (optional)
dotnet add package WolverineFx.EntityFrameworkCore # EF Core integration (optional)
dotnet add package WolverineFx.RabbitMQ           # RabbitMQ transport (optional)
```

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Host.UseWolverine(opts => {
    // Configuration goes here
});

// For Wolverine.Http endpoints:
builder.Services.AddWolverineHttp();

var app = builder.Build();
app.MapWolverineEndpoints();

return await app.RunJasperFxCommands(args); // Enables Wolverine CLI tools
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Message** | Plain .NET class/record — no required interfaces or base classes |
| **Handler** | Public method named `Handle`, `HandleAsync`, `Consume`, or `ConsumeAsync` |
| **IMessageBus** | Scoped service — entry point for invoking, publishing, scheduling |
| **Cascade** | Return values from handlers are automatically published as messages |
| **Side Effect** | Return `ISideEffect` implementations — executed inline, not cascaded |
| **Saga** | Stateful long-running process — inherits from `Wolverine.Saga` |
| **Outbox** | Transactional outbox via `[Transactional]` or `AutoApplyTransactions()` |
| **Middleware** | Code woven into handler pipeline — `Before()`/`After()`/`Finally()` methods |

## Messages

```csharp
// Commands and events — plain C# records, no framework types needed
public record CreateOrder(Guid CustomerId, decimal Total);
public record OrderCreated(Guid OrderId, decimal Total);

// Custom message identity (optional — defaults to full type name)
[MessageIdentity("order-created")]
public record OrderCreated(Guid OrderId, decimal Total);
```

## Message Handlers

```csharp
// Convention: class ending in "Handler", method named Handle/Consume/HandleAsync
// No interfaces required!
public class CreateOrderHandler
{
    // Single message arg — Wolverine figures out the rest
    public static OrderCreated Handle(CreateOrder cmd, IDocumentSession session)
    {
        var order = new Order { CustomerId = cmd.CustomerId, Total = cmd.Total };
        session.Store(order);
        return new OrderCreated(order.Id, order.Total); // cascaded automatically
    }
}

// Multiple services injected directly into the method
public class NotifyOrderHandler
{
    public static async Task Handle(
        OrderCreated evt,
        IEmailService email,
        ILogger<NotifyOrderHandler> logger,
        CancellationToken ct)
    {
        await email.SendAsync(evt.OrderId, ct);
        logger.LogInformation("Order {Id} notification sent", evt.OrderId);
    }
}
```

**Handler discovery rules:**
- Method named `Handle`, `HandleAsync`, `Consume`, `ConsumeAsync` **OR** class/method decorated with `[WolverineHandler]`
- Class must be `public`; method must be `public`
- Message type is the first non-service parameter (or parameter named `message`)

## IMessageBus — Sending Messages

```csharp
public class OrderController(IMessageBus bus)
{
    // Execute inline and wait for completion
    await bus.InvokeAsync(new CreateOrder(customerId, total));

    // Execute inline and capture response
    var result = await bus.InvokeAsync<OrderResult>(new CreateOrder(customerId, total));

    // Send — requires at least one subscriber (throws if none)
    await bus.SendAsync(new CreateOrder(customerId, total));

    // Publish — no error if no subscribers (good for events)
    await bus.PublishAsync(new OrderCreated(orderId, total));

    // Schedule for later execution
    await bus.ScheduleAsync(new CancelOrder(orderId), 30.Days());
    await bus.ScheduleAsync(new CancelOrder(orderId), DateTimeOffset.UtcNow.AddDays(30));
}
```

## Return Values / Cascading Messages

```csharp
public class OrderHandler
{
    // Single cascade
    public static OrderCreated Handle(CreateOrder cmd) => new(Guid.NewGuid(), cmd.Total);

    // Multiple cascades
    public static (OrderCreated, SendConfirmationEmail) Handle(CreateOrder cmd)
        => (new(Guid.NewGuid(), cmd.Total), new(cmd.CustomerId));

    // Variable number of cascades
    public static IEnumerable<object> Handle(BulkOrder cmd)
    {
        foreach (var item in cmd.Items)
            yield return new CreateOrder(item.CustomerId, item.Total);
    }

    // Async cascades
    public static async IAsyncEnumerable<object> Handle(BulkOrder cmd)
    {
        await foreach (var item in cmd.Items.ToAsyncEnumerable())
            yield return new CreateOrder(item.CustomerId, item.Total);
    }
}
```

See [return-values reference](./references/return-values.md) for the full table.

## Transactional Outbox

Apply `[Transactional]` or configure `AutoApplyTransactions()` globally:

```csharp
// Per-handler attribute approach
[Transactional]
public static async Task Handle(CreateOrder cmd, IDocumentSession session, IMessageContext ctx)
{
    session.Store(new Order { ... });
    await ctx.PublishAsync(new OrderCreated(...)); // held until DB commit
}

// Global policy (recommended)
opts.Policies.AutoApplyTransactions();
```

See [durability reference](./references/durability.md) for EF Core and Marten outbox setup.

## Error Handling

```csharp
opts.Policies.OnException<SqlException>()
    .RetryWithCooldown(50.Milliseconds(), 100.Milliseconds(), 250.Milliseconds());

opts.Policies.OnException<TimeoutException>()
    .ScheduleRetry(5.Seconds(), 30.Seconds(), 5.Minutes());

opts.Policies.OnException<InvalidOperationException>()
    .Discard(); // Log and drop

opts.Policies.OnException<UnrecoverableException>()
    .MoveToErrorQueue(); // Dead letter queue
```

## Middleware

```csharp
public class ValidationMiddleware
{
    public static (HandlerContinuation, IList<string>) Before(MyMessage msg)
    {
        var errors = Validate(msg);
        return errors.Any()
            ? (HandlerContinuation.Stop, errors)
            : (HandlerContinuation.Continue, errors);
    }
}

// Register globally
opts.Policies.AddMiddleware<ValidationMiddleware>();

// Register selectively
opts.Policies.AddMiddleware<AuthMiddleware>(chain =>
    chain.MessageType.Namespace?.StartsWith("MyApp.Secure") == true);
```

See [middleware reference](./references/middleware.md) for full patterns.

## Sagas

```csharp
public record StartOrder(string OrderId);
public record CompleteOrder(string Id);
public record OrderTimeout(string Id) : TimeoutMessage(1.Minutes()); // auto-scheduled

public class Order : Saga
{
    public string? Id { get; set; }

    // Static Start method creates the saga
    public static (Order, OrderTimeout) Start(StartOrder cmd, ILogger<Order> log)
    {
        log.LogInformation("Starting order {Id}", cmd.OrderId);
        return (new Order { Id = cmd.OrderId }, new OrderTimeout(cmd.OrderId));
    }

    public void Handle(CompleteOrder cmd) => MarkCompleted();
    public void Handle(OrderTimeout timeout) => MarkCompleted(); // timeout = cancel
    
    // Called when saga not found (optional)
    public static void NotFound(CompleteOrder cmd, ILogger<Order> log)
        => log.LogWarning("Order {Id} not found", cmd.Id);
}
```

See [sagas reference](./references/sagas.md) for persistence setup.

## Wolverine.Http Endpoints

```csharp
// Use WolverineGet/Post/Put/Delete attributes
public static class OrderEndpoints
{
    // GET with route param
    [WolverineGet("/orders/{id}")]
    public static async Task<Order> Get(Guid id, IQuerySession session)
        => await session.LoadAsync<Order>(id);

    // POST — first non-simple param is deserialized from body
    [WolverinePost("/orders")]
    public static (CreationResponse, OrderCreated) Post(CreateOrder cmd, IDocumentSession session)
    {
        var order = new Order { ... };
        session.Store(order);
        return (CreationResponse.For($"/orders/{order.Id}"), new OrderCreated(order.Id));
    }

    // With problem details on validation failure
    [WolverinePost("/orders/{id}/complete")]
    public static async Task<IResult> Post(
        Guid id, CompleteOrderRequest req,
        IDocumentSession session, IMessageBus bus)
    {
        var order = await session.LoadAsync<Order>(id);
        if (order is null) return Results.NotFound();
        await bus.PublishAsync(new CompleteOrder(id));
        return Results.Accepted();
    }
}
```

See [http reference](./references/http.md) for full HTTP endpoint patterns.

## Testing

```csharp
// Unit test — pure function, no mocks needed
[Fact]
public void creates_order_and_cascades_event()
{
    var cmd = new CreateOrder(Guid.NewGuid(), 99.99m);
    var result = CreateOrderHandler.Handle(cmd);  // Direct call
    result.Total.ShouldBe(99.99m);
}

// Integration test — tracked sessions wait for all async work to complete
[Fact]
public async Task full_order_flow()
{
    await Host.InvokeMessageAndWaitAsync(new CreateOrder(customerId, 99.99m));
    // Assert DB state, check outgoing messages, etc.
}
```

See [testing reference](./references/testing.md) for tracked session patterns.

## Common Packages

| Package | Purpose |
|---------|---------|
| `WolverineFx` | Core — handlers, local bus, mediator |
| `WolverineFx.Http` | ASP.NET Core HTTP endpoints |
| `WolverineFx.EntityFrameworkCore` | EF Core outbox, sagas, transactional middleware |
| `WolverineFx.Marten` | Marten/PostgreSQL outbox, event sourcing, sagas |
| `WolverineFx.RabbitMQ` | RabbitMQ transport |
| `WolverineFx.AmazonSqs` | Amazon SQS transport |
| `WolverineFx.AzureServiceBus` | Azure Service Bus transport |
| `WolverineFx.Kafka` | Kafka transport |
| `WolverineFx.NATS` | NATS transport |

## References

- [Handler Patterns](./references/handlers.md) — discovery, multiple handlers, handler lifecycle
- [HTTP Endpoints](./references/http.md) — Wolverine.Http full API
- [Durability / Outbox](./references/durability.md) — EF Core, Marten, SQL Server, PostgreSQL setup
- [Sagas](./references/sagas.md) — stateful workflows, persistence options
- [Middleware](./references/middleware.md) — custom middleware patterns
- [Testing](./references/testing.md) — unit and integration testing
- [Transports & Routing](./references/transports.md) — RabbitMQ, SQS, Azure Service Bus, routing rules
