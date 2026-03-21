# Wolverine.Http — HTTP Endpoint Patterns

## Setup

```csharp
// Program.cs
builder.Services.AddWolverineHttp();

var app = builder.Build();
app.MapWolverineEndpoints(); // Discovers all [WolverineVerb] endpoints
// or with options:
app.MapWolverineEndpoints(opts => {
    opts.AddMiddleware<AuthMiddleware>();
    opts.RequireAuthorization(); // Apply auth to all Wolverine endpoints
});
```

## HTTP Verb Attributes

Use `[WolverineGet]`, `[WolverinePost]`, `[WolverinePut]`, `[WolverineDelete]`, `[WolverinePatch]`:

```csharp
public static class OrderEndpoints
{
    [WolverineGet("/orders/{id}")]
    public static async Task<Order?> GetOrder(Guid id, IQuerySession session)
        => await session.LoadAsync<Order>(id);

    [WolverinePost("/orders")]
    public static (CreationResponse, OrderCreated) CreateOrder(
        CreateOrderRequest req,       // First non-simple param = request body (JSON)
        IDocumentSession session)
    {
        var order = new Order { CustomerId = req.CustomerId };
        session.Store(order);
        // CreationResponse sets 201 + Location header; OrderCreated is cascaded
        return (CreationResponse.For($"/orders/{order.Id}"), new OrderCreated(order.Id));
    }

    [WolverinePut("/orders/{id}")]
    public static async Task<Order> UpdateOrder(Guid id, UpdateOrderRequest req, IDocumentSession session)
    {
        var order = await session.LoadAsync<Order>(id) ?? throw new Exception("Not found");
        order.Update(req);
        session.Store(order);
        return order;
    }

    [WolverineDelete("/orders/{id}")]
    public static async Task<IResult> DeleteOrder(Guid id, IDocumentSession session)
    {
        var order = await session.LoadAsync<Order>(id);
        if (order is null) return Results.NotFound();
        session.Delete(order);
        return Results.NoContent();
    }
}
```

## Parameter Binding (Precedence Order)

| Parameter | Resolution |
|-----------|------------|
| `[FromServices]` attribute | IoC container |
| `IMessageBus` | New Wolverine message bus |
| `HttpContext` / `HttpRequest` / `HttpResponse` | ASP.NET Core context |
| Name matches route segment | Route value |
| `[FromHeader]` attribute | HTTP header |
| Simple type (`string`, `int`, `Guid`, `bool`, etc.) | Query string |
| First complex type | Deserialized request body (JSON) |
| Other complex types | IoC container |

```csharp
[WolverinePost("/orders/{tenantId}")]
public static Task<IResult> Post(
    string tenantId,           // <- route param (matched by name)
    [FromHeader("x-api-key")] string apiKey,  // <- from header
    int page,                  // <- query string (?page=1)
    CreateOrderRequest body,   // <- first complex type = JSON body
    IDocumentSession session,  // <- IoC
    IMessageBus bus)           // <- message bus
{ ... }
```

## Response Types

| Return Type | HTTP Response |
|-------------|---------------|
| `void` / `Task` | 200 OK (empty) |
| Any serializable type | 200 OK + JSON body |
| `IResult` | Delegated to the IResult |
| `(CreationResponse, TMessage)` | 201 Created + cascaded message |
| `(T resource, TMessage)` | 200 OK with resource + cascaded message |
| `string` | 200 OK + plain text |

```csharp
// Return resource AND cascade a message
[WolverinePost("/orders")]
public static (Order, OrderCreated) Post(CreateOrderRequest req, IDocumentSession session)
{
    var order = new Order { ... };
    session.Store(order);
    return (order, new OrderCreated(order.Id)); // 200 + cascade
}

// Use IResult for conditional HTTP responses
[WolverinePost("/orders/{id}/submit")]
public static async Task<IResult> Submit(Guid id, IDocumentSession session, IMessageBus bus)
{
    var order = await session.LoadAsync<Order>(id);
    if (order is null) return Results.NotFound();
    if (order.IsSubmitted) return Results.Conflict();
    await bus.PublishAsync(new SubmitOrder(id));
    return Results.Accepted();
}
```

## Wolverine.Http with Marten

```csharp
// Aggregate handler workflow via HTTP
[WolverinePost("/orders/{orderId}/complete")]
public static (OrderCompleted, Events) Post(
    CompleteOrderRequest req,
    Order order)  // <- auto-loaded from Marten by orderId route param
{
    if (order.IsCompleted) throw new InvalidOperationException("Already completed");
    var evt = new OrderCompleted(order.Id, DateTimeOffset.UtcNow);
    return (evt, Events.AppendTo(order.Id, evt)); // append event to stream
}

// Tag handler class to use a specific Marten store
[MartenStore(typeof(IOrderStore))]
public static class OrderEndpoints { ... }
```

## HTTP Middleware

```csharp
// Apply middleware to HTTP endpoints only
app.MapWolverineEndpoints(opts =>
{
    opts.AddMiddleware<RequiresAuthMiddleware>();
    opts.AddMiddlewareByMessageType<ITenantMessage>(typeof(TenantMiddleware));
});

// Or apply via attribute
[Middleware(typeof(RequiresAuthMiddleware))]
[WolverinePost("/orders")]
public static OrderCreated Post(CreateOrder cmd) { ... }
```

## Problem Details (Validation)

```csharp
// Return ProblemDetails for validation failures
[WolverinePost("/orders")]
public static IResult Post(CreateOrderRequest req)
{
    if (req.Total <= 0)
        return Results.Problem("Total must be positive", statusCode: 400);
    // ...
}

// Use FluentValidation middleware
builder.Services.AddFluentValidation(x => x.RegisterValidatorsFromAssembly(typeof(Program).Assembly));
opts.UseFluentValidation(); // or per-endpoint attribute
```

## Naming Conventions

- Prefer class names ending in `Endpoint` (e.g., `OrderEndpoints`, `CreateOrderEndpoint`)
- This prevents Wolverine from also treating the method as a message handler
- Use `[WolverineHandler]` explicitly if you want a method to be both

## Security

```csharp
// Apply [Authorize] from ASP.NET Core normally
[Authorize]
public static class SecureEndpoints
{
    [WolverineGet("/admin/orders")]
    public static Task<IReadOnlyList<Order>> Get(IQuerySession session) => session.Query<Order>().ToListAsync();
}

// Or require auth for all Wolverine endpoints
app.MapWolverineEndpoints(opts => opts.RequireAuthorization());
```
