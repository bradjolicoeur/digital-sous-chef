# Marten Document Storage Reference

## Document Requirements

- `public` type
- `Id` property/field named `id`, `Id`, or `ID` (case insensitive)
- Serializable (System.Text.Json by default; Newtonsoft.Json also supported)
- No required base class or interface

## Supported Id Types

| Type | Behavior |
|------|----------|
| `Guid` | Auto-assigned by Marten if empty (`Guid.Empty`) |
| `string` | User must supply; natural keys work well |
| `int` / `long` | HiLo generator — Marten manages sequences |
| `CombGuid` | Sequential Guid — better index performance |
| Strong-typed id (`record struct OrderId(Guid Value)`) | Wraps Guid/string/int/long |

```csharp
// Override id property name/selection
opts.Schema.For<Order>().Identity(x => x.OrderNumber); // use a non-Id property
```

## Sessions

### Recommended Patterns

```csharp
// Inject IDocumentSession (Scoped) for read/write
// Inject IQuerySession (Scoped) for read-only
public class OrderHandler(IDocumentSession session) { }
public class OrderQuery(IQuerySession session) { }

// Open manually
await using var session = store.LightweightSession();
await using var readOnly = store.QuerySession();

// Serializable transaction (for strict isolation)
await using var session = await store.LightweightSerializableSessionAsync();
```

### Session Types Comparison

| Type | Created via | Identity Map | Change Tracking | Best For |
|------|-------------|-------------|-----------------|---------|
| `QuerySession` | `store.QuerySession()` | ❌ | ❌ | Read-only work |
| `LightweightSession` | `store.LightweightSession()` | ❌ | ❌ | **Most write scenarios** |
| `IdentitySession` | `store.IdentitySession()` | ✅ | ❌ | Loading same doc multiple times |
| `DirtyTrackedSession` | `store.DirtyTrackedSession()` | ✅ | ✅ | Auto-detect changes |

## Writing Documents

```csharp
// Upsert (insert or replace)
session.Store(order);
session.Store(order1, order2, order3);

// Mixed types — must specify object
session.Store<object>(user, order, product);
session.StoreObjects(new object[] { user, order });

// Insert only
session.Insert(order); // throws DocumentAlreadyExistsException if exists

// Update only
session.Update(order); // throws NonExistentDocumentException if missing

// Bulk insert (PostgreSQL COPY — fastest for large sets)
await store.BulkInsertAsync(orders, batchSize: 500);

// Commit
await session.SaveChangesAsync(); // wraps in a single DB transaction
```

## Deleting Documents

```csharp
// Delete by document instance
session.Delete(order);

// Delete by id
session.Delete<Order>(orderId);

// Delete by predicate (translated to SQL WHERE)
session.DeleteWhere<Order>(x => x.Status == "Cancelled" && x.CustomerId == customerId);

// Soft delete (if configured)
// Marks as deleted without physically removing — can be queried later
opts.Schema.For<Order>().SoftDeleted();
session.Delete(order);                           // soft-deletes
session.Query<Order>().Where(x => x.IsDeleted()) // query soft-deleted
session.HardDeleteWhere<Order>(x => x.Id == id); // physical removal
```

## LINQ Querying

```csharp
// All documents of a type
var all = await session.Query<Order>().ToListAsync();

// Filtering
var pending = await session.Query<Order>()
    .Where(x => x.Status == "Pending")
    .ToListAsync();

// String operations
var search = await session.Query<Order>()
    .Where(x => x.Description.Contains("important"))
    .ToListAsync();

// Collections (any/all inside JSON arrays)
var tagged = await session.Query<Product>()
    .Where(x => x.Tags.Contains("sale"))
    .ToListAsync();

// Child collections
var hasExpired = await session.Query<Order>()
    .Where(x => x.Items.Any(i => i.ExpiresAt < DateTime.UtcNow))
    .ToListAsync();

// Ordering
var ordered = await session.Query<Order>()
    .OrderByDescending(x => x.CreatedAt)
    .ThenBy(x => x.Status)
    .ToListAsync();

// Paging
var page = await session.Query<Order>()
    .Skip(pageNum * pageSize)
    .Take(pageSize)
    .ToListAsync();

// Count / Any
var count = await session.Query<Order>().CountAsync();
var exists = await session.Query<Order>().AnyAsync(x => x.Status == "Open");

// Select (projections — project to simpler type)
var ids = await session.Query<Order>()
    .Select(x => x.Id)
    .ToListAsync();

var summaries = await session.Query<Order>()
    .Select(x => new OrderSummary { Id = x.Id, Status = x.Status })
    .ToListAsync();
```

## Loading By Id

```csharp
// Single document — null if not found
var order = await session.LoadAsync<Order>(id);

// Multiple documents
var orders = await session.LoadManyAsync<Order>(id1, id2, id3);

// Include related documents in one query
var order = await session.Query<Order>()
    .Include<Customer>(o => o.CustomerId, out var customer)
    .SingleAsync(o => o.Id == orderId);
```

## Compiled Queries (Reusable, Parameterized)

```csharp
// Define once, reuse many times — avoids repeated SQL compilation
public class PendingOrders : ICompiledListQuery<Order>
{
    public string Status { get; init; } = "Pending";
    public Guid CustomerId { get; init; }

    public Expression<Func<IMartenQueryable<Order>, IEnumerable<Order>>> QueryIs()
        => q => q.Where(x => x.Status == Status && x.CustomerId == CustomerId);
}

// Use it
var results = await session.QueryAsync(new PendingOrders { CustomerId = customerId });
```

## Batched Queries

```csharp
// Execute multiple queries in one round-trip
var batch = session.CreateBatchQuery();

var pendingTask = batch.Query<Order>().Where(x => x.Status == "Pending").ToList();
var customerTask = batch.Load<Customer>(customerId);

await batch.Execute();   // one database call

var pending = await pendingTask;
var customer = await customerTask;
```

## Full-Text Search

```csharp
// Configure (requires FullTextIndex on the field)
opts.Schema.For<Article>().FullTextIndex(x => x.Body);

// Query
var results = await session.Query<Article>()
    .Where(x => x.Search("postgresql document"))
    .ToListAsync();
```

## Indexing Configuration

```csharp
opts.Schema.For<Order>()
    // B-tree index on a value
    .Index(x => x.CustomerId)
    // Unique index
    .Index(x => x.OrderNumber, idx => { idx.IsUnique = true; })
    // Composite index
    .Index(new[] { "data ->> 'Status'", "data ->> 'CustomerId'" })
    // GIN index (for Contains/Any queries on arrays)
    .GinIndex(x => x.Tags)
    // Duplicated field — stores value in its own column for faster queries
    .Duplicate(x => x.CustomerId, pgType: "uuid", notNull: true)
    // Foreign key to another Marten document
    .ForeignKey<Customer>(x => x.CustomerId)
    // Full-text search
    .FullTextIndex(x => x.Description);
```

## Optimistic Concurrency

```csharp
// Option 1: Attribute-based (uses Guid version)
[UseOptimisticConcurrency]
public class Order
{
    public Guid Id { get; set; }
    // ...
}

// Option 2: Configuration API
opts.Schema.For<Order>().UseOptimisticConcurrency(true);

// Option 3: Revisioned documents (int version — recommended for new code)
opts.Schema.For<Order>().UseNumericRevisions(true);
// or implement IRevisioned:
public class Order : IRevisioned
{
    public Guid Id { get; set; }
    public int Version { get; set; } // auto-managed by Marten
}

// When a concurrent conflict occurs:
// throws ConcurrencyException — catch and retry or return 409
```

## Metadata Tracking

```csharp
// Enable optional metadata columns
opts.Schema.For<Order>()
    .Metadata(m =>
    {
        m.CorrelationId.Enabled = true;  // string — user-supplied
        m.CausationId.Enabled = true;    // string — user-supplied
        m.Headers.Enabled = true;        // key/value pairs
        m.CreatedAt.Enabled = true;      // timestamp of creation
    });

// Set on session
session.CorrelationId = correlationId;
session.CausationId = causationId;
session.SetHeader("user-id", userId.ToString());
```

## Multi-Tenancy

```csharp
// Conjoined tenancy (shared tables, tenant_id column)
opts.Policies.AllDocumentsAreMultiTenanted();
// or per type:
opts.Schema.For<Order>().MultiTenanted();

// Use with sessions
await using var session = store.LightweightSession(tenantId);
// or inject with ForTenant:
session.ForTenant(tenantId).Store(order);

// Database-per-tenant
opts.MultiTenantedDatabases(x =>
{
    x.AddSingleTenantDatabase(tenant1ConnString, "tenant1");
    x.AddSingleTenantDatabase(tenant2ConnString, "tenant2");
});
```
