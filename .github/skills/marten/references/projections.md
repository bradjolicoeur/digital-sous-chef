# Marten Projections Reference

## Projection Lifecycles

| Lifecycle | When Applied | Consistency | Persisted | Best For |
|-----------|-------------|-------------|-----------|---------|
| `Inline` | Synchronously in same transaction as events | Strong | ✅ | Read models that must always be current |
| `Async` | Background via Async Daemon (eventually) | Eventual | ✅ | High-volume, performance-sensitive projections |
| `Live` | On-demand at query time (recomputed) | Strong | ❌ | Rarely queried aggregates, audit views |

## Self-Aggregating Snapshots (Simplest Pattern)

The document type itself defines how to apply events — no separate projection class needed.

```csharp
public class Order
{
    public Guid Id { get; set; }
    public string Status { get; set; } = "New";
    public List<OrderItem> Items { get; set; } = new();
    public string? CustomerId { get; set; }

    // Called to create the initial document from the first event
    public static Order Create(OrderPlaced e) => new()
    {
        Id = e.OrderId,
        CustomerId = e.CustomerId,
        Status = "Placed"
    };

    // Called for each subsequent event — mutates the document
    public void Apply(ItemAdded e)
    {
        Items.Add(new OrderItem { ProductId = e.ProductId, Quantity = e.Quantity });
    }

    public void Apply(OrderShipped e) => Status = "Shipped";
    public void Apply(OrderCancelled e) => Status = "Cancelled";

    // Return true to delete the document
    public bool ShouldDelete(OrderExpired e) => true;
}

// Register as snapshot
opts.Projections.Snapshot<Order>(SnapshotLifecycle.Inline);
// or
opts.Projections.Snapshot<Order>(SnapshotLifecycle.Async);
```

## SingleStreamProjection (Explicit Class)

Use when the projection class is separate from the document.

```csharp
public class OrderSummaryProjection : SingleStreamProjection<OrderSummary, Guid>
{
    // Create from first meaningful event
    public static OrderSummary Create(OrderPlaced e) => new()
    {
        Id = e.OrderId,
        CustomerId = e.CustomerId,
        Status = "Placed",
        PlacedAt = DateTimeOffset.UtcNow
    };

    // Apply subsequent events — two signatures supported:
    // 1. Mutate in place (void)
    public void Apply(ItemAdded e, OrderSummary summary)
    {
        summary.ItemCount++;
        summary.TotalAmount += e.Price * e.Quantity;
    }

    // 2. Return new document (immutable style)
    public OrderSummary Apply(OrderShipped e, OrderSummary summary)
        => summary with { Status = "Shipped", ShippedAt = e.ShippedAt };

    // Delete document when this event occurs
    public bool ShouldDelete(OrderDeleted e) => true;

    // Delete without condition — always delete on this event type
    // Use constructor registration:
    // DeleteEvent<OrderExpired>();
}

// Register
opts.Projections.Add<OrderSummaryProjection>(ProjectionLifecycle.Async);
```

### Using IEvent<T> in Projection Methods

```csharp
// Access event metadata (timestamp, version, etc.) in Apply methods
public void Apply(IEvent<OrderShipped> e, OrderSummary summary)
{
    summary.Status = "Shipped";
    summary.ShippedAt = e.Timestamp;     // from event envelope
    summary.ShipEventVersion = e.Version;
    summary.TrackingNumber = e.Data.TrackingNumber;  // actual payload
}
```

## MultiStreamProjection (Cross-Stream)

Aggregates events from multiple streams into a single document. Requires routing — telling Marten which document(s) each event affects.

```csharp
public class CustomerOrderSummaryProjection : MultiStreamProjection<CustomerOrderSummary, Guid>
{
    public CustomerOrderSummaryProjection()
    {
        // Route event to one document by returning the target document Id
        Identity<OrderPlaced>(e => e.CustomerId);
        Identity<OrderShipped>(e => e.CustomerId);
        Identity<OrderCancelled>(e => e.CustomerId);

        // Route event to multiple documents (fan-out)
        Identities<ProductOrdered>(e => e.CustomerIds);
    }

    public static CustomerOrderSummary Create(IEvent<OrderPlaced> e) => new()
    {
        Id = e.Data.CustomerId,
        TotalOrders = 1,
        LastOrderAt = e.Timestamp
    };

    public void Apply(OrderPlaced e, CustomerOrderSummary summary)
    {
        summary.TotalOrders++;
        summary.TotalSpend += e.TotalAmount;
    }

    public void Apply(OrderCancelled e, CustomerOrderSummary summary)
        => summary.CancelledOrders++;
}

// Registration
opts.Projections.Add<CustomerOrderSummaryProjection>(ProjectionLifecycle.Async);
```

## EventProjection (Event-to-Document Transform)

Creates or modifies documents directly from events — useful for 1:1 transforms.

```csharp
public class AuditLogProjection : EventProjection
{
    public AuditLogEntry Project(OrderPlaced e)
        => new() { Id = Guid.NewGuid(), Action = "OrderPlaced", OrderId = e.OrderId };

    public AuditLogEntry Project(IEvent<OrderShipped> e)
        => new() { Id = Guid.NewGuid(), Action = "OrderShipped", At = e.Timestamp };

    // Delete documents
    public void Project(AuditLogExpired e, IDocumentOperations ops)
        => ops.DeleteWhere<AuditLogEntry>(x => x.OrderId == e.OrderId);
}

opts.Projections.Add<AuditLogProjection>(ProjectionLifecycle.Async);
```

## Convention Methods Summary

| Method | Signature Options | Purpose |
|--------|------------------|---------|
| `Create` | `static TDoc Create(TEvent e)` | Create doc from first event |
| `Create` | `static TDoc Create(IEvent<TEvent> e)` | Create with metadata access |
| `Apply` | `void Apply(TEvent e, TDoc doc)` | Mutate doc |
| `Apply` | `void Apply(TEvent e)` on doc type | Mutate self (self-aggregate) |
| `Apply` | `TDoc Apply(TEvent e, TDoc doc)` | Return new doc (immutable) |
| `Apply` | `void Apply(IEvent<TEvent> e, TDoc doc)` | Mutate with metadata |
| `ShouldDelete` | `bool ShouldDelete(TEvent e)` | Delete condition |
| `ShouldDelete` | `bool ShouldDelete(TEvent e, TDoc doc)` | Delete with state context |

## Constructor-Based Registration

Some behaviors are registered in the projection constructor rather than via method conventions:

```csharp
public class OrderProjection : SingleStreamProjection<Order, Guid>
{
    public OrderProjection()
    {
        // Always delete on this event type (no ShouldDelete needed)
        DeleteEvent<OrderPermanentlyDeleted>();

        // Inline lambda projection
        ProjectEvent<OrderNoted>((doc, e) => doc.Notes.Add(e.Note));
    }
}
```

## Inline Projections (Same Transaction as Events)

```csharp
// Inline lifecycle means the projection document is updated in the same
// DB transaction that appends the events — no daemon needed, no eventual consistency

opts.Projections.Snapshot<Order>(SnapshotLifecycle.Inline);
opts.Projections.Add<OrderSummaryProjection>(ProjectionLifecycle.Inline);
```

Tradeoffs of Inline:
- Adds latency to event append operations
- Projection failure causes the event append to fail
- Cannot be rewound/replayed on schema changes without reprocessing all events

## Async (Daemon) Projections

```csharp
opts.Projections.Add<OrderSummaryProjection>(ProjectionLifecycle.Async);

// Enable daemon
builder.Services.AddMarten(opts => { ... })
    .AddAsyncDaemon(DaemonMode.Solo);    // single server
    // or
    .AddAsyncDaemon(DaemonMode.HotCold); // multi-server with leader election
```

Async projections run in background — see [async-daemon.md](./async-daemon.md) for details.

## Live Projections (On-Demand, Not Persisted)

```csharp
opts.Projections.Add<OrderSummaryProjection>(ProjectionLifecycle.Live);

// Query live (recomputes every time — no stored document)
var summary = await session.Events.AggregateStreamAsync<OrderSummary>(streamId);
```

## Registering Multiple Projections

```csharp
builder.Services.AddMarten(opts =>
{
    opts.Connection(connectionString);

    // Self-aggregating snapshots
    opts.Projections.Snapshot<Order>(SnapshotLifecycle.Async);

    // Explicit projection classes
    opts.Projections.Add<CustomerOrderSummaryProjection>(ProjectionLifecycle.Async);
    opts.Projections.Add<AuditLogProjection>(ProjectionLifecycle.Async);

    // Inline for mission-critical read models
    opts.Projections.Add<InventoryProjection>(ProjectionLifecycle.Inline);
});
```

## Flat Table Projections

For projecting events into relational/tabular read models (not JSON documents):

```csharp
public class OrderFlatTable : FlatTableProjection
{
    public OrderFlatTable() : base("order_flat", SchemaNameSource.EventSchema)
    {
        Table.AddColumn<Guid>("id").AsPrimaryKey();
        Table.AddColumn<string>("customer_id").AllowNulls();
        Table.AddColumn<string>("status").AllowNulls();
        Table.AddColumn<DateTimeOffset>("placed_at").AllowNulls();

        Project<OrderPlaced>(map =>
        {
            map.Map(e => e.OrderId, "id");
            map.Map(e => e.CustomerId, "customer_id");
            map.Set("status", "Placed");
            map.Map(e => e.PlacedAt, "placed_at");
        });

        Project<OrderShipped>(map =>
        {
            map.Map(e => e.OrderId, "id");
            map.Set("status", "Shipped");
        });
    }
}

opts.Projections.Add<OrderFlatTable>(ProjectionLifecycle.Async);
```

## Rewinding / Rebuilding Projections

```csharp
// Rebuild all async projections from scratch
await store.Advanced.RebuildProjectionAsync<OrderSummaryProjection>(ct);

// Or use the CLI
// dotnet run -- projections --rebuild
```
