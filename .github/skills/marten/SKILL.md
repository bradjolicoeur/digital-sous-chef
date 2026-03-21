---
name: marten
description: "Use when building with Marten (MartenDB) for PostgreSQL document storage, event sourcing, or event store functionality in .NET. Covers: AddMarten, IDocumentSession, IQuerySession, IDocumentStore, Store/Load/Query, LINQ queries, event appending, FetchForWriting, event streams, projections (SingleStreamProjection, MultiStreamProjection, EventProjection), projection lifecycles (Inline/Async/Live), async daemon, ISubscription, sagas, multi-tenancy, schema migrations, optimistic concurrency, Wolverine integration."
---

# Marten (MartenDB) Skill

Marten is a .NET library that turns PostgreSQL into both a **document database** and a full **event store**.
It requires no extra infrastructure — just PostgreSQL.

**Full docs**: https://martendb.io/llms-full.txt

## Setup

```bash
dotnet add package Marten
```

```csharp
// Program.cs — minimal setup
builder.Services.AddMarten(opts =>
{
    opts.Connection(builder.Configuration.GetConnectionString("Marten")!);
    opts.DatabaseSchemaName = "myapp"; // optional, default = "public"
})
.UseLightweightSessions()   // Recommended for new projects
.UseNpgsqlDataSource();     // Use if registering NpgsqlDataSource (Aspire, etc.)
```

`AddMarten()` registers:
- `IDocumentStore` — **Singleton** — root service, rarely injected directly
- `IDocumentSession` — **Scoped** — read/write session
- `IQuerySession` — **Scoped** — read-only session

## Sessions At A Glance

| Session | Use | Identity Map | Dirty Check |
|---------|-----|-------------|------------|
| `IQuerySession` | Read only — inject for queries | No | No |
| `IDocumentSession` (Lightweight) | Read/write — **recommended** | No | No |
| `IdentitySession` | Read/write + identity map | Yes | No |
| `DirtyTrackedSession` | Read/write + auto change tracking | Yes | Yes |

```csharp
// Inject directly — Scoped lifetime
public class OrderService(IDocumentSession session, IQuerySession queries) { }

// Or open manually from the store
await using var session = store.LightweightSession();
await using var readOnly = store.QuerySession();
// Always call SaveChangesAsync() to commit writes
await session.SaveChangesAsync();
```

## Document Storage

```csharp
// Document requirements: public type with Id property (Guid, string, int, long, or strong-typed id)
public class Order
{
    public Guid Id { get; set; }     // Auto-assigned by Marten if empty
    public string Status { get; set; } = "Pending";
}

// Store (upsert — insert or replace)
session.Store(order);
session.Store(order1, order2, order3);  // batch
session.Store<object>(mixedDocuments); // mixed types

// Insert only (throws DocumentAlreadyExistsException if exists)
session.Insert(order);

// Update only (throws NonExistentDocumentException if missing)
session.Update(order);

// Delete
session.Delete(order);
session.Delete<Order>(id);
session.DeleteWhere<Order>(x => x.Status == "Cancelled");

// Always commit with SaveChangesAsync
await session.SaveChangesAsync();
```

## Loading Documents

```csharp
// Load by id — returns null if not found
var order = await session.LoadAsync<Order>(id);

// Load many by id
var orders = await session.LoadManyAsync<Order>(id1, id2, id3);

// Query with LINQ
var pending = await session.Query<Order>()
    .Where(x => x.Status == "Pending")
    .OrderBy(x => x.CreatedAt)
    .ToListAsync();

// Single result
var order = await session.Query<Order>()
    .SingleAsync(x => x.Id == id);

var orderOrNull = await session.Query<Order>()
    .SingleOrDefaultAsync(x => x.Id == id);

// Count, Any
var count = await session.Query<Order>().CountAsync();
var exists = await session.Query<Order>().AnyAsync(x => x.Status == "Pending");

// Paging
var page = await session.Query<Order>()
    .Skip(20).Take(10)
    .ToListAsync();
```

## Event Sourcing

```csharp
// Events = plain C# types (records recommended)
public record OrderCreated(Guid OrderId, string[] Items);
public record ItemShipped(string ItemName, DateTimeOffset ShippedAt);
public record OrderCompleted(DateTimeOffset CompletedAt);

// Start a new stream
var streamId = Guid.NewGuid();
session.Events.StartStream<Order>(streamId, new OrderCreated(streamId, ["item1"]));

// Append to existing stream
session.Events.Append(streamId, new ItemShipped("item1", DateTimeOffset.UtcNow));

// Both require SaveChangesAsync to persist
await session.SaveChangesAsync();
```

## FetchForWriting (CQRS Command Handler Pattern)

The recommended API for CQRS-style writes. Loads the aggregate state and a write token for optimistic concurrency:

```csharp
public async Task Handle(MarkItemReady cmd, IDocumentSession session)
{
    // Loads the current aggregate state AND a write token
    var stream = await session.Events.FetchForWriting<Order>(cmd.OrderId);
    var order = stream.Aggregate; // current projected state

    if (!order.Items.Contains(cmd.ItemName))
        throw new InvalidOperationException("Item not found");

    stream.AppendOne(new ItemReady(cmd.ItemName));

    if (order.IsCompleteAfterMarking(cmd.ItemName))
        stream.AppendOne(new OrderCompleted(DateTimeOffset.UtcNow));

    await session.SaveChangesAsync(); // commits with optimistic lock
}
```

## Projections Overview

Projections build "read models" from event data. Three lifecycles:

| Lifecycle | When updated | Use case |
|-----------|-------------|---------|
| `Inline` | During `SaveChangesAsync()` — strongly consistent | Write models, small streams |
| `Async` | Background via Async Daemon — eventually consistent | Large read models, cross-stream |
| `Live` | On-demand, not persisted — computed from events each time | Short streams, admin views |

## Single Stream Projections (Aggregate)

```csharp
// Option 1: Self-aggregating document (conventional methods on the document type)
public record QuestParty(Guid Id, List<string> Members)
{
    public static QuestParty Create(QuestStarted e) => new(e.QuestId, []);

    public static QuestParty Apply(MembersJoined e, QuestParty party)
        => party with { Members = [..party.Members, ..e.Members] };

    public static QuestParty Apply(MembersDeparted e, QuestParty party)
        => party with { Members = party.Members.Except(e.Members).ToList() };
}

// Register as snapshot
opts.Projections.Snapshot<QuestParty>(SnapshotLifecycle.Inline);  // or .Async
opts.Projections.LiveStreamAggregation<QuestParty>();              // Live only

// Option 2: Separate projection class
public class OrderProjection : SingleStreamProjection<Order, Guid>
{
    public Order Create(IEvent<OrderCreated> e) => new() { Id = e.StreamId };

    public void Apply(ItemShipped e, Order order) => order.ShippedItems.Add(e.ItemName);

    public void Apply(OrderCompleted e, Order order) => order.Status = "Completed";

    // Delete the projected document when this event occurs
    public bool ShouldDelete(OrderCancelled e) => true;
}

// Register
opts.Projections.Add<OrderProjection>(ProjectionLifecycle.Inline);
```

## Multi-Stream Projections

```csharp
public class CustomerOrderSummaryProjection : MultiStreamProjection<CustomerOrderSummary, Guid>
{
    public CustomerOrderSummaryProjection()
    {
        // Route events to aggregate documents by identity
        Identity<OrderCreated>(e => e.CustomerId);
        Identity<OrderCompleted>(e => e.CustomerId);
        // One event can apply to multiple aggregates
        Identities<OrderShared>(e => e.SharedWithCustomerIds);
    }

    public CustomerOrderSummary Create(OrderCreated e) => new() { Id = e.CustomerId };
    public void Apply(OrderCreated e, CustomerOrderSummary doc) => doc.TotalOrders++;
    public void Apply(OrderCompleted e, CustomerOrderSummary doc) => doc.CompletedOrders++;
}

// Multi-stream projections default to Async lifecycle
opts.Projections.Add<CustomerOrderSummaryProjection>(ProjectionLifecycle.Async);
```

See [projections reference](./references/projections.md) for full patterns.

## Async Daemon Setup

Required for `ProjectionLifecycle.Async` projections:

```csharp
builder.Services.AddMarten(opts =>
{
    opts.Connection(connectionString);
    opts.Projections.Add<CustomerOrderSummaryProjection>(ProjectionLifecycle.Async);
})
.AddAsyncDaemon(DaemonMode.Solo);    // Single node
// or
.AddAsyncDaemon(DaemonMode.HotCold); // Multi-node with leader election
```

## Schema & Migrations

```csharp
// Auto-create in development (default)
opts.AutoCreateSchemaObjects = AutoCreate.All;          // create & update (can drop)
opts.AutoCreateSchemaObjects = AutoCreate.CreateOrUpdate; // never drops
opts.AutoCreateSchemaObjects = AutoCreate.None;          // production — explicit migrations

// Apply migrations on startup
builder.Services.AddMarten(...).ApplyAllDatabaseChangesOnStartup();

// CLI — export migration SQL
// dotnet run -- db-patch migration.sql
// dotnet run -- db-apply
```

## Indexing

```csharp
// Configure indexing in AddMarten
opts.Schema.For<Order>()
    .Index(x => x.CustomerId)                    // simple index
    .Index(x => x.Status, idx => idx.IsUnique = true) // unique index
    .GinIndex(x => x.Tags)                       // GIN for arrays/JSONB search
    .FullTextIndex(x => x.Description)           // full-text search
    .ForeignKey<Customer>(x => x.CustomerId);    // foreign key
    .Duplicate(x => x.CustomerId)                // duplicated field (faster queries)
```

## Common Packages

| Package | Purpose |
|---------|---------|
| `Marten` | Core — document DB + event store |
| `WolverineFx.Marten` | Wolverine integration (outbox, aggregate handlers) |
| `Alba` | Integration testing support |

## References

- [Document Storage](./references/documents.md) — sessions, LINQ querying, indexing, identity, concurrency
- [Event Sourcing](./references/event-sourcing.md) — streams, appending, FetchForWriting, event metadata
- [Projections](./references/projections.md) — all projection types, lifecycles, conventions
- [Async Daemon & Subscriptions](./references/async-daemon.md) — daemon modes, ISubscription
- [Testing](./references/testing.md) — integration testing with Alba and xUnit
