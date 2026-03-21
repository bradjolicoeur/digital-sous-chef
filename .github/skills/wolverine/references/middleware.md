# Wolverine Middleware

## How Wolverine Middleware Works

Unlike ASP.NET Core middleware (runtime pipeline), Wolverine middleware is **code-generated and compiled** into the handler at startup. This means:
- Zero runtime overhead for middleware that doesn't apply
- Stack traces point to real code, not middleware chains
- Middleware can be selectively applied by message type

## Conventional Middleware (Recommended)

Create a class with `Before`, `After`, and/or `Finally` methods:

```csharp
public class LoggingMiddleware
{
    private readonly ILogger _logger;

    public LoggingMiddleware(ILogger<LoggingMiddleware> logger)
    {
        _logger = logger;
    }

    // Called BEFORE the handler
    public void Before(Envelope envelope)
    {
        _logger.LogInformation("Handling {MessageType} {Id}", envelope.MessageType, envelope.Id);
    }

    // Called AFTER handler succeeds (not on exception)
    public void After(Envelope envelope)
    {
        _logger.LogInformation("Completed {MessageType} {Id}", envelope.MessageType, envelope.Id);
    }

    // Called AFTER handler regardless of success/failure
    public void Finally(Envelope envelope)
    {
        _logger.LogDebug("Finished processing {Id}", envelope.Id);
    }
}
```

## Static Middleware (Zero Allocation)

Use `static` methods and return values to pass state between stages:

```csharp
public static class StopwatchMiddleware
{
    // Before returns a Stopwatch, which Wolverine threads through to Finally
    public static Stopwatch Before()
    {
        var sw = new Stopwatch();
        sw.Start();
        return sw;
    }

    // Stopwatch from Before is injected here by Wolverine
    public static void Finally(Stopwatch sw, ILogger logger, Envelope envelope)
    {
        sw.Stop();
        logger.LogDebug("{MessageType} handled in {Ms}ms", envelope.MessageType, sw.ElapsedMilliseconds);
    }
}
```

## Stopping Execution with HandlerContinuation

Return `HandlerContinuation.Stop` to abort handler execution:

```csharp
public class AuthorizationMiddleware
{
    public static HandlerContinuation Before(IHttpContextAccessor http, Envelope envelope)
    {
        if (http.HttpContext?.User.IsInRole("admin") == true)
            return HandlerContinuation.Continue;

        return HandlerContinuation.Stop;
    }
}
```

## Async Middleware

```csharp
public class RateLimitMiddleware
{
    private readonly IRateLimiter _limiter;

    public RateLimitMiddleware(IRateLimiter limiter) => _limiter = limiter;

    public async Task<HandlerContinuation> BeforeAsync(Envelope envelope, CancellationToken ct)
    {
        var allowed = await _limiter.AllowAsync(envelope.MessageType, ct);
        return allowed ? HandlerContinuation.Continue : HandlerContinuation.Stop;
    }
}
```

## Registering Middleware

### Global (message handlers)

```csharp
opts.Policies.AddMiddleware<LoggingMiddleware>();
opts.Policies.AddMiddleware(typeof(LoggingMiddleware));
```

### Selective (by predicate)

```csharp
// Only apply to messages in a specific namespace
opts.Policies.AddMiddleware<AuthMiddleware>(chain =>
    chain.MessageType.Namespace?.StartsWith("MyApp.Commands") == true);

// Only apply to messages implementing an interface
opts.Policies.AddMiddleware<TenantMiddleware>(chain =>
    chain.MessageType.IsAssignableTo(typeof(ITenantMessage)));
```

### Global (HTTP endpoints)

```csharp
app.MapWolverineEndpoints(opts =>
{
    opts.AddMiddleware<AuthMiddleware>();
    opts.AddMiddlewareByMessageType<IAuthenticatedRequest>(typeof(UserMiddleware));
});
```

### Per-handler with attribute

```csharp
[Middleware(typeof(RequiresAdminMiddleware))]
public class AdminOrderHandler
{
    public void Handle(DeleteOrder cmd, IDocumentSession session) { ... }
}
```

## Middleware Parameters

Middleware methods can inject the same things as handlers:
- Message (the incoming message type)
- `Envelope` (message metadata)
- `IMessageContext` / `IMessageBus`
- Any IoC service
- CancellationToken
- Objects returned by earlier `Before()` methods (passed through automatically)

## Built-In Middleware

| Middleware | How to Enable |
|-----------|---------------|
| Transactional outbox | `[Transactional]` or `AutoApplyTransactions()` |
| FluentValidation | `opts.UseFluentValidation()` + register validators in IoC |
| Data Annotations validation | `opts.Policies.AddMiddleware<DataAnnotationsValidator>()` |
| Error handling / retry | `opts.Policies.OnException<T>().RetryWithCooldown(...)` |
| OpenTelemetry tracing | Built-in via Wolverine's logging setup |

## FluentValidation Middleware

```bash
dotnet add package WolverineFx.FluentValidation
```

```csharp
// Register Wolverine FluentValidation support
opts.UseFluentValidation();

// Register validators via FluentValidation conventions
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);

// Or apply per-handler
[FluentValidation]
public class CreateOrderHandler
{
    public void Handle(CreateOrder cmd) { ... }
}

// Validator implementation
public class CreateOrderValidator : AbstractValidator<CreateOrder>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.Total).GreaterThan(0);
        RuleFor(x => x.CustomerId).NotEmpty();
    }
}
```
