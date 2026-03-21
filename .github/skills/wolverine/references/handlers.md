# Wolverine Handler Patterns

## Handler Discovery

Wolverine auto-discovers handlers by scanning assemblies. A handler is any:
- `public` class with a `public` method named `Handle`, `HandleAsync`, `Consume`, or `ConsumeAsync`
- Any method decorated with `[WolverineHandler]`
- `Handle*` method on a `Saga` subclass

```csharp
// Convention-based discovery
public class OrderHandler
{
    public void Handle(CreateOrder cmd) { }
    public Task HandleAsync(ShipOrder cmd) { }
    public void Consume(OrderCreated evt) { }
}

// Explicit attribute (use when naming differs)
public class MyService
{
    [WolverineHandler]
    public void ProcessOrder(CreateOrder cmd) { }
}
```

### Controlling Discovery

```csharp
opts.Discovery
    .DisableConventionalDiscovery()              // Turn off auto-scan
    .IncludeType<OrderHandler>()                  // Add specific types
    .IncludeAssembly(typeof(OrderHandler).Assembly) // Add whole assembly
    .IncludeNamespace("MyApp.Handlers");          // Filter by namespace
```

## Handler Method Signatures

Wolverine resolves method parameters in this order:

| Parameter | Source |
|-----------|--------|
| Message type | The incoming message |
| `CancellationToken` | From the execution context |
| `Envelope` | Wolverine message metadata |
| `IMessageContext` or `IMessageBus` | Current messaging context |
| Any `IDocumentSession` / `DbContext` | From IoC container |
| Any service type | From IoC container |
| Objects returned by middleware `Before()` | Passed through by Wolverine |

```csharp
public class FullExampleHandler
{
    // All parameters besides the message are injected by Wolverine
    public static async Task<OrderResult> Handle(
        CreateOrder cmd,           // The message
        IDocumentSession session,  // Marten session from IoC
        IEmailService emails,      // Service from IoC
        IMessageContext ctx,       // Current message context
        Envelope envelope,         // Message metadata
        ILogger<FullExampleHandler> logger,
        CancellationToken ct)
    {
        logger.LogInformation("Handling {MessageType} {Id}", envelope.MessageType, envelope.Id);
        var order = new Order { ... };
        session.Store(order);
        await emails.NotifyAsync(order, ct);
        return new OrderResult(order.Id);
    }
}
```

## Multiple Handlers for One Message Type

Wolverine supports multiple handlers per message type. They execute sequentially in discovery order:

```csharp
public class OrderAuditHandler
{
    public void Handle(CreateOrder cmd, IAuditLog audit) => audit.Log(cmd);
}

public class OrderProcessingHandler
{
    public OrderCreated Handle(CreateOrder cmd, IDocumentSession session)
    {
        session.Store(new Order { ... });
        return new OrderCreated(cmd.OrderId);
    }
}
```

## Static vs. Instance Handlers

Static handlers avoid object allocation overhead. Prefer static methods for simple, pure handlers:

```csharp
// Preferred — static, pure function
public static class OrderHandler
{
    public static OrderCreated Handle(CreateOrder cmd)
        => new(Guid.NewGuid(), cmd.Total);
}

// Instance — use when you need injected state (e.g., singletons)
public class OrderHandler(IOrderRepository repo)
{
    public async Task<OrderCreated> Handle(CreateOrder cmd)
    {
        await repo.SaveAsync(new Order { ... });
        return new OrderCreated(cmd.OrderId);
    }
}
```

## Return Values

| Return Type | Behavior |
|-------------|----------|
| `void` / `Task` / `ValueTask` | No cascade |
| Any message class | Cascaded and published per routing rules |
| `(T1, T2, ...)` tuple | All non-null tuple items cascaded |
| `IEnumerable<object>` | Each item cascaded |
| `IAsyncEnumerable<object>` | Each item cascaded |
| Implements `ISideEffect` | Executed inline, not cascaded |
| `OutgoingMessages` | Batch of cascaded messages with routing control |
| Inherits `Saga` | Creates a new saga instance |

```csharp
// Returning OutgoingMessages for fine-grained routing control
public static OutgoingMessages Handle(ProcessBatch cmd)
{
    var messages = new OutgoingMessages();
    foreach (var item in cmd.Items)
    {
        messages.Add(new ProcessItem(item));
        messages.RespondToSender(new ItemAcknowledged(item.Id)); // reply to sender
    }
    return messages;
}
```

## Timeout Messages

```csharp
// TimeoutMessage auto-schedules itself with the given delay
public record OrderExpired(string OrderId) : TimeoutMessage(24.Hours());

// In a saga Start() method, return the timeout alongside the saga state:
public static (Order, OrderExpired) Start(CreateOrder cmd)
    => (new Order { Id = cmd.OrderId }, new OrderExpired(cmd.OrderId));
```

## Handler Batch Processing

```csharp
// Wolverine can batch adjacent messages of the same type
opts.ListenAtPort(5555).AllowMaximumParallelism(10);

// In the handler, receive as IReadOnlyList<T>
public static async Task Handle(IReadOnlyList<CreateOrder> commands, IDocumentSession session)
{
    foreach (var cmd in commands)
        session.Store(new Order { ... });
    // One SaveChanges for the whole batch
}
```

## Sticky Handlers

Route a message type to always use a specific, named endpoint:

```csharp
[StickyHandler("financial")]
public class FinancialOrderHandler
{
    public void Handle(CreateOrder cmd) { }
}
```
