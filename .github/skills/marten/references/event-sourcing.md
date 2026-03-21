# Marten Event Sourcing Reference

## Event Type Requirements

- `public` C# type (class or record)
- Serializable (System.Text.Json by default; Newtonsoft.Json also supported)
- No base class or interface required
- Prefer `record` types for immutability — records are strongly recommended

```csharp
// Event records
public record OrderPlaced(Guid OrderId, string CustomerId, DateTimeOffset PlacedAt);
public record ItemAdded(Guid OrderId, string ProductId, int Quantity, decimal Price);
public record OrderShipped(Guid OrderId, string TrackingNumber, DateTimeOffset ShippedAt);
public record OrderCancelled(Guid OrderId, string Reason);
```

## Stream Identity

Streams can use `Guid` (default) or `string` keys.

```csharp
// Guid identity (default)
// No configuration needed

// String identity
opts.Events.StreamIdentity = StreamIdentity.AsString;
```

## Global Configuration

```csharp
opts.Events.AddEventType<OrderPlaced>();          // register event type explicitly
opts.Events.AddEventTypes(typeof(OrderPlaced), typeof(ItemAdded)); // bulk register

// Use type-qualified event names (safer for refactoring — avoids type name collisions)
opts.Events.UseArchivedStreamPartitioning = true; // enable archiving
```

## AppendMode (Performance)

| Mode | Description | Recommendation |
|------|-------------|----------------|
| `EventAppendMode.Rich` | Default. Fetches stream metadata, enables all features. | Development, low-volume |
| `EventAppendMode.Quick` | Skips extra metadata fetch. 40-50% faster on appends. | **Production — recommended** |

```csharp
// Set globally
opts.Events.AppendMode = EventAppendMode.Quick;
```

With Quick mode:
- Stream version is not checked on append
- Event sequence is assigned at commit, not pre-computed
- Async projections still work normally

## Starting a Stream

```csharp
// Start with Guid identity (Marten assigns if not provided)
var streamId = Guid.NewGuid();
session.Events.StartStream<Order>(streamId, new OrderPlaced(streamId, customerId, DateTimeOffset.UtcNow));

// Marten auto-generates ID
var id = session.Events.StartStream<Order>(new OrderPlaced(...)).Id;

// Start with string identity
session.Events.StartStream<Order>("order-123", new OrderPlaced(...));

await session.SaveChangesAsync();
```

## Appending to Existing Streams

```csharp
// Append one event
session.Events.Append(streamId, new ItemAdded(streamId, "product-A", 2, 9.99m));

// Append multiple events atomically
session.Events.Append(streamId,
    new ItemAdded(streamId, "product-A", 2, 9.99m),
    new ItemAdded(streamId, "product-B", 1, 19.99m));

// Append with optimistic concurrency — provide expected version
session.Events.Append(streamId, expectedVersion: 5,
    new OrderShipped(streamId, "TRACK-123", DateTimeOffset.UtcNow));

// String-keyed stream
session.Events.Append("order-123", new ItemAdded(...));

await session.SaveChangesAsync();
```

## FetchForWriting — CQRS Write Pattern

`FetchForWriting<T>` is the recommended pattern for command handling. It loads the current aggregate state plus an exclusive write token ensuring no concurrent overwrites.

```csharp
// Full CQRS command handler with FetchForWriting
public static async Task Handle(
    AddItemToOrder cmd,
    IDocumentSession session,
    CancellationToken ct)
{
    // Load aggregate + write lock in one operation
    var stream = await session.Events.FetchForWriting<Order>(cmd.OrderId, ct);

    // stream.Aggregate contains the current projected state (or null if not found)
    var order = stream.Aggregate ?? throw new InvalidOperationException("Order not found");

    // Validate against current state
    if (order.Status == "Cancelled")
        throw new InvalidOperationException("Cannot add items to cancelled order");

    // Append new events
    stream.AppendOne(new ItemAdded(cmd.OrderId, cmd.ProductId, cmd.Quantity, cmd.Price));

    // Or append multiple
    stream.AppendMany(
        new ItemAdded(cmd.OrderId, cmd.ProductId, cmd.Quantity, cmd.Price),
        new InventoryReserved(cmd.ProductId, cmd.Quantity));

    // Persist — the write token prevents concurrent modifications
    await session.SaveChangesAsync(ct);
}
```

### FetchForWriting Concurrency Modes

```csharp
// Default: optimistic concurrency (recommended)
var stream = await session.Events.FetchForWriting<Order>(orderId);

// With specific expected version
var stream = await session.Events.FetchForWriting<Order>(orderId, expectedVersion: 7);
// Throws ConcurrencyException if stream is not at version 7

// Exclusive locking (SELECT FOR UPDATE)
var stream = await session.Events.FetchForWritingWithLinearizedUpdates<Order>(orderId);
```

### FetchLatest — Read-Only Aggregate Loading

```csharp
// Lightweight read — no write lock, no concurrency protection
var order = await session.Events.FetchLatest<Order>(orderId);
// Returns null if stream not found
```

## Reading Events

```csharp
// Load all events for a stream
var events = await session.Events.FetchStreamAsync(streamId);
// Returns IReadOnlyList<IEvent>

// Load up to a specific version
var events = await session.Events.FetchStreamAsync(streamId, version: 5);

// Load from a specific version
var events = await session.Events.FetchStreamAsync(streamId, fromVersion: 3);

// Load by string key
var events = await session.Events.FetchStreamAsync("order-123");

// Query events directly (advanced usage)
var shipped = await session.Events.QueryAllRawEvents()
    .Where(e => e.EventTypeName == "order_shipped")
    .ToListAsync();

// Strongly typed event queries
var shipEvents = await session.Events.QueryRawEventDataOnly<OrderShipped>()
    .Where(e => e.OrderId == orderId)
    .ToListAsync();
```

## IEvent Interface — Event Metadata

Every stored event is wrapped in `IEvent<T>` which provides:

```csharp
public interface IEvent<T> : IEvent
{
    T Data { get; }
}

public interface IEvent
{
    Guid Id { get; }           // unique event identifier
    long Version { get; }      // position within the stream (1-based)
    long Sequence { get; }     // global sequence across all streams
    object Data { get; }       // the event payload
    Type EventType { get; }    // CLR type
    string EventTypeName { get; }
    Guid StreamId { get; }     // stream Guid
    string StreamKey { get; }  // stream string key (if using string identity)
    DateTimeOffset Timestamp { get; }
    string TenantId { get; }
}
```

### Using IEvent<T> in Projections

```csharp
// Access metadata in projection methods
public void Apply(IEvent<OrderShipped> e, Order order)
{
    order.ShippedAt = e.Timestamp;
    order.ShipEventVersion = e.Version;
    order.TrackingNumber = e.Data.TrackingNumber;
}
```

## Stream Metadata

```csharp
// Load stream state (version, timestamps, archived flag)
var state = await session.Events.FetchStreamStateAsync(streamId);
Console.WriteLine($"Version: {state.Version}, Created: {state.Created}");

// Archive a stream (mark as inactive — excluded from daemon processing by default)
await session.Events.ArchiveStreamAsync(streamId);
```

## Event Timestamps

```csharp
// Override event timestamp (useful for migrations)
session.Events.Append(streamId, new ItemAdded(...));
// Timestamp is set by Marten at SaveChangesAsync time

// Manually set timestamp via wrapper
var envelope = new Event<ItemAdded>(new ItemAdded(...))
{
    Timestamp = specificTime
};
session.Events.Append(streamId, envelope);
```

## Wolverine Integration — Command Handler Pattern

```csharp
// With Wolverine + Marten, handlers can return events directly
// Wolverine will append them to the stream automatically

public static IEnumerable<object> Handle(
    AddItemToOrder cmd,
    Order order)  // Marten/Wolverine loads current aggregate state
{
    if (order.Status == "Cancelled")
        throw new InvalidOperationException("Order is cancelled");

    yield return new ItemAdded(cmd.OrderId, cmd.ProductId, cmd.Quantity, cmd.Price);
}

// Or with async and multiple event types
public static async Task<Events> Handle(
    PlaceOrder cmd,
    IDocumentSession session)
{
    var stream = await session.Events.FetchForWriting<Order>(cmd.OrderId);
    // validate...

    return [
        new OrderPlaced(cmd.OrderId, cmd.CustomerId, DateTimeOffset.UtcNow),
        new InventoryReserved(cmd.ProductId, cmd.Quantity)
    ];
}
```
