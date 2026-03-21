# Marten Async Daemon Reference

## Overview

The Async Daemon is a background service (`IHostedService`) that processes events and updates async projections and subscriptions. It's disabled by default and must be explicitly enabled.

## Setup

```csharp
builder.Services.AddMarten(opts =>
{
    opts.Connection(connectionString);
    // ... projection registrations ...
})
.AddAsyncDaemon(DaemonMode.Solo);     // single server
// or
.AddAsyncDaemon(DaemonMode.HotCold);  // multi-node
```

## Daemon Modes

| Mode | Description | Use When |
|------|-------------|---------|
| `DaemonMode.Solo` | Single node — all shards run here | Single server, local dev, tests |
| `DaemonMode.HotCold` | Multi-node with leader election via PostgreSQL | Horizontally scaled, multi-instance deployments |
| `DaemonMode.Disabled` | No daemon (default) | Local dev without async projections |

### HotCold Multi-Node

```csharp
// All instances compete for leadership via PostgreSQL advisory locks
// Only one node (the "hot" node) runs the daemon at any time
// Remaining nodes are "cold" standby — take over if leader goes down
.AddAsyncDaemon(DaemonMode.HotCold);

// Configure health check interval
opts.Events.ProcessingOptions.HealthCheckPollingInterval = TimeSpan.FromSeconds(5);
```

## High Water Mark

The daemon tracks the "high water mark" — the highest event sequence number that has been safely committed to the database and is ready for projection processing. The daemon only processes events at or below the high water mark to avoid reading partial transactions.

This is automatically managed — no configuration needed. It becomes relevant when:
- Debugging why projections seem behind
- Diagnosing gaps in async projection updates

## Quick AppendMode Recommendation

```csharp
// Use with async projections for best performance
opts.Events.AppendMode = EventAppendMode.Quick;
```

Quick mode removes the per-append metadata fetch overhead. Safe to use with async daemon — event sequences are assigned at commit time.

## ISubscription Interface

`ISubscription` is the low-level interface for processing event ranges in the background — used when you need to react to events for external integrations (sync to ElasticSearch, send notifications, publish to external buses, etc.).

```csharp
public class OrderNotificationSubscription : ISubscription
{
    private readonly IEmailSender _emailSender;

    public OrderNotificationSubscription(IEmailSender emailSender)
        => _emailSender = emailSender;

    public async Task<IChangeListener> ProcessEventsAsync(
        EventRange page,            // the batch of events to process
        ISubscriptionController controller,
        IDocumentOperations ops,    // write to Marten inside the same transaction
        CancellationToken ct)
    {
        foreach (var e in page.Events)
        {
            if (e.Data is OrderShipped shipped)
            {
                await _emailSender.SendShippingConfirmationAsync(shipped.OrderId, ct);
            }
        }

        // Return NullChangeListener.Instance if no additional cleanup needed
        return NullChangeListener.Instance;
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
```

### IChangeListener

`IChangeListener` is returned from `ProcessEventsAsync` to receive callbacks on success/failure:

```csharp
public class MyChangeListener : IChangeListener
{
    // Called after the daemon successfully commits the processed batch
    public Task AfterCommitAsync(IDocumentSession session, IChangeSet commit, CancellationToken ct)
        => Task.CompletedTask;

    // Called before the daemon commits the processed batch
    public Task BeforeCommitAsync(IDocumentSession session, IChangeSet commit, CancellationToken ct)
        => Task.CompletedTask;
}
```

## Registering Subscriptions

```csharp
// Register via Add (DI-friendly — supports constructor injection)
opts.Projections.Subscribe(new SubscriptionWrapper<OrderNotificationSubscription>());

// Or implement ISubscriptionSource for DI-resolved subscriptions:
public class OrderNotificationSource : ISubscriptionSource
{
    public ISubscription Build(IServiceProvider services)
        => services.GetRequiredService<OrderNotificationSubscription>();
}

opts.Projections.Subscribe(new OrderNotificationSource());
```

## Filtering Events for Performance

Avoid processing all events when only a subset is needed:

```csharp
public class ShippingSubscription : ISubscription
{
    // ...
}

// Register with event type filter
opts.Projections.Subscribe(new ShippingSubscription(),
    filter => filter
        .IncludeType<OrderShipped>()
        .IncludeType<OrderCancelled>());

// Or filter by stream type
opts.Projections.Subscribe(new ShippingSubscription(),
    filter => filter.IncludeStream<Order>());
```

## ISubscriptionController

Passed to `ProcessEventsAsync` — used to signal errors and control processing:

```csharp
public async Task<IChangeListener> ProcessEventsAsync(
    EventRange page,
    ISubscriptionController controller,
    IDocumentOperations ops,
    CancellationToken ct)
{
    try
    {
        // ... process events ...
    }
    catch (Exception ex)
    {
        // Report error — daemon will back off and retry
        await controller.ReportCriticalFailureAsync(ex);
    }

    return NullChangeListener.Instance;
}
```

## Rewind and Replay

```csharp
// Access daemon
var daemon = await store.BuildProjectionDaemonAsync();

// Rewind a specific projection shard to a sequence
await daemon.RewindAsync("OrderSummaryProjection:All", 0); // back to start

// Or via the store API
await store.Advanced.ResetAllData(); // wipes all projection data + events (test use only)
```

### Projection Shard Names

Shard names follow the pattern `{ProjectionName}:{ShardName}`. For single-shard projections it's `{ProjectionName}:All`.

## Error Handling

```csharp
// Configure daemon error handling
opts.Events.ProcessingOptions.HandleFatalError(ex =>
{
    // log, alert systems
    return DaemonErrors.SkipEvent; // skip and continue
    // or return DaemonErrors.StopProcessing; // stop the daemon
});

// Skip individual event failures without stopping daemon (development)
opts.Events.ProcessingOptions.OnAgentStopped += (sender, args) => { /* log */ };
```

## Daemon Diagnostics

```csharp
// Check projection progress
var stats = await store.Advanced.AllProjectionProgress();
foreach (var stat in stats)
{
    Console.WriteLine($"{stat.ShardName}: sequence {stat.Sequence}");
}

// Wait for a projection to catch up to a sequence (useful in tests)
await daemon.WaitForNonStaleProjectionDataAsync(TimeSpan.FromSeconds(30));
```

## Writing to Marten Inside Subscriptions

The `IDocumentOperations ops` parameter in `ProcessEventsAsync` is inside the daemon's current transaction. You can write Marten documents alongside event processing in one atomic commit:

```csharp
public async Task<IChangeListener> ProcessEventsAsync(
    EventRange page, ISubscriptionController controller,
    IDocumentOperations ops, CancellationToken ct)
{
    foreach (var e in page.Events)
    {
        if (e.Data is OrderShipped shipped)
        {
            ops.Store(new ShippingRecord { OrderId = shipped.OrderId, At = e.Timestamp });
        }
    }

    return NullChangeListener.Instance;
    // Marten commits the ShippingRecord documents with the projection progress — atomic
}
```
