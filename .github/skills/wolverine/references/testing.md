# Wolverine Testing Patterns

## Core Testing Philosophy

Wolverine is designed for **testability without mocks**. The preferred approach:

1. **Unit test handlers as pure functions** — call the handler method directly
2. **Integration test with tracked sessions** — await all async side effects

## Unit Testing Handlers

Since Wolverine handlers are plain methods (no required base classes), test them directly:

```csharp
// Handler under test
public static class CreateOrderHandler
{
    public static (Order, OrderCreated) Handle(CreateOrder cmd, IDocumentSession session)
    {
        var order = new Order { CustomerId = cmd.CustomerId, Total = cmd.Total };
        session.Store(order);
        return (order, new OrderCreated(order.Id, order.Total));
    }
}

// Unit test — no mocks for the handler logic itself
[Fact]
public void creates_order_with_correct_data()
{
    var cmd = new CreateOrder(Guid.NewGuid(), 99.99m);

    // Use a stub/real session if needed, or null for pure logic tests
    var session = new InMemoryDocumentSession(); // or Mock<IDocumentSession>

    var (order, evt) = CreateOrderHandler.Handle(cmd, session);

    order.CustomerId.ShouldBe(cmd.CustomerId);
    order.Total.ShouldBe(99.99m);
    evt.Total.ShouldBe(99.99m);
}
```

## Testing Cascaded Messages (State-Based Testing)

Instead of verifying calls to `IMessageContext`, return cascaded messages and assert on them:

```csharp
// Prefer this: pure function that returns cascades
public static class OrderHandler
{
    public static IEnumerable<object> Handle(ProcessOrder cmd, Order order)
    {
        if (order.Total > 1000)
            yield return new RequireApproval(cmd.OrderId);
        yield return new OrderProcessed(cmd.OrderId);
    }
}

// Test: assert on returned messages, not mock invocations
[Fact]
public void large_order_requires_approval()
{
    var order = new Order { Total = 2000m };
    var messages = OrderHandler.Handle(new ProcessOrder("order-1"), order).ToList();

    messages.ShouldContain(m => m is RequireApproval);
    messages.ShouldContain(m => m is OrderProcessed);
}
```

## Side Effects Testing

```csharp
public static class FileHandler
{
    // Returns ISideEffect — easy to assert without touching the file system
    public static WriteFile Handle(SaveDocument cmd)
        => new WriteFile(cmd.FileName, cmd.Content);
}

[Fact]
public void produces_correct_write_file_side_effect()
{
    var result = FileHandler.Handle(new SaveDocument("test.txt", "hello"));
    result.Path.ShouldBe("test.txt");
    result.Contents.ShouldBe("hello");
    // No file system involved!
}
```

## Integration Testing with Tracked Sessions

Tracked sessions wait for **all async message processing to complete** before returning.
This solves the "how do I know when async work is done?" problem.

### Setup

```bash
dotnet add package WolverineFx.Testing  # or included in WolverineFx
```

```csharp
// Typical test fixture (xUnit collection fixture pattern)
public class AppFixture : IAsyncLifetime
{
    public IHost Host { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Host = await Microsoft.Extensions.Hosting.Host
            .CreateDefaultBuilder()
            .UseWolverine(opts =>
            {
                // Test configuration — use SQLite or in-memory for speed
                opts.PersistMessagesWithSqlite("Data Source=test.db");
                opts.Policies.AutoApplyTransactions();
            })
            .StartAsync();

        await Host.ResetResourceState(); // Clean up between tests
    }

    public async Task DisposeAsync() => await Host.StopAsync();
}
```

### Tracked Session Methods

```csharp
// Execute a message and wait for all resulting messages/cascades to finish
await Host.InvokeMessageAndWaitAsync(new CreateOrder(customerId, 99.99m));

// Publish and wait
await Host.SendMessageAndWaitAsync(new CreateOrder(customerId, 99.99m));

// With a tracked session object for inspecting what happened
var session = await Host.TrackActivity()
    .WaitForMessageToBeReceivedAt<OrderCreated>(Host) // can span multiple nodes
    .InvokeMessageAndWaitAsync(new CreateOrder(customerId, 99.99m));

// Inspect messages sent/received
session.Sent.MessagesOf<OrderCreated>().Count().ShouldBe(1);
session.Executed.MessagesOf<CreateOrder>().Count().ShouldBe(1);

// Access specific sent messages
var evt = session.Sent.SingleMessage<OrderCreated>();
evt.Total.ShouldBe(99.99m);
```

### Multi-Node Integration Tests

```csharp
// Test message flowing between two separate host instances
var session = await sender.TrackActivity()
    .AlsoTrack(receiver)  // Track activity on the receiver node too
    .WaitForMessageToBeReceivedAt<OrderCreated>(receiver)
    .SendMessageAndWaitAsync(new CreateOrder(customerId, 99.99m));
```

## Testing HTTP Endpoints

Wolverine.Http endpoints can be tested via the standard ASP.NET Core test client:

```csharp
await using var host = await AlbaHost.For<Program>(app =>
{
    app.UseEnvironment("Testing");
});

// Test a Wolverine HTTP endpoint
var result = await host.PostAsJson("/orders", new CreateOrderRequest
{
    CustomerId = Guid.NewGuid(),
    Total = 99.99m
});
result.StatusCode.ShouldBe(HttpStatusCode.Created);
```

Or use tracked sessions with HTTP:

```csharp
var tracked = await Host.TrackActivity()
    .WaitForMessageToBeReceivedAt<OrderCreated>(Host)
    .ExecuteRequestAsync(httpClient =>
        httpClient.PostAsJsonAsync("/orders", new CreateOrderRequest { ... }));
```

## Testing Sagas

```csharp
// Unit test saga state machine directly
[Fact]
public async Task order_saga_timeout_cancels_order()
{
    var saga = new OrderSaga { Id = "order-1", Status = "Pending" };

    saga.Handle(new OrderTimeout("order-1"), NullLogger<OrderSaga>.Instance);

    saga.IsCompleted.ShouldBeTrue();
}

// Integration test full saga lifecycle
[Fact]
public async Task full_saga_completes()
{
    await Host.InvokeMessageAndWaitAsync(new StartOrder("saga-1"));
    await Host.InvokeMessageAndWaitAsync(new PaymentReceived("saga-1", 100m));

    // Assert final state
    using var session = Host.Services.GetRequiredService<IQuerySession>();
    var saga = await session.LoadAsync<OrderSaga>("saga-1");
    saga.ShouldBeNull(); // MarkCompleted() deletes the saga
}
```

## Testing Error Handling

```csharp
// Verify that exceptions are handled per policy
opts.Policies.OnException<InvalidOperationException>().Discard();

// In integration tests, check that discarded messages don't throw
await Should.NotThrowAsync(async () =>
    await Host.InvokeMessageAndWaitAsync(new BadCommand()));
```
