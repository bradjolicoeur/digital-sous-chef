# Wolverine Transports & Message Routing

## Transport Overview

Wolverine supports both in-process and external messaging transports.

| Transport | Package | Use Case |
|-----------|---------|---------|
| Local (in-process) | `WolverineFx` | In-app async queues |
| TCP | `WolverineFx` | Simple service-to-service |
| RabbitMQ | `WolverineFx.RabbitMQ` | Most common enterprise bus |
| Amazon SQS | `WolverineFx.AmazonSqs` | AWS workloads |
| Azure Service Bus | `WolverineFx.AzureServiceBus` | Azure workloads |
| Kafka | `WolverineFx.Kafka` | High-volume streaming |
| NATS | `WolverineFx.NATS` | Low-latency messaging |
| PostgreSQL | `WolverineFx.Postgresql` | DB-backed queue, no broker needed |
| SQL Server | `WolverineFx.SqlServer` | DB-backed queue for SQL Server |
| Redis | `WolverineFx.Redis` | Redis streams |

## Message Routing Rules

When sending, Wolverine applies routing rules in order:

1. Message is forwarded to another type? Use destination type's routing.
2. Explicit routing rules? Use those **only** (skip other conventions).
3. Local handler exists? Route to local queue by default.
4. Convention routes (Rabbit MQ queue naming by message type, etc.).

## Explicit Routing

```csharp
opts.PublishMessage<CreateOrder>()
    .ToRabbitQueue("orders");          // specific queue

opts.PublishAllMessages()
    .ToRabbitExchange("app-events");   // all messages to an exchange

opts.Publish()
    .MessagesFromNamespace("MyApp.Commands")
    .ToRabbitQueue("commands");

opts.Publish()
    .MessagesImplementing<IExternalEvent>()
    .ToRabbitExchange("events");
```

## Local Queues (In-Process)

```csharp
// Send to local queue — processed in same process
await bus.SendAsync(new ProcessReport(), new DeliveryOptions
{
    Queue = "reports"   // Target a specific local queue
});

// Configure specific local queues
opts.LocalQueue("reports")
    .MaximumParallelMessages(5)
    .UseDurableInbox();         // Make it durable (stored in DB)

// Disable conventional local routing (force explicit routing)
opts.DisableConventionalLocalRouting();
```

## RabbitMQ

```bash
dotnet add package WolverineFx.RabbitMQ
```

```csharp
opts.UseRabbitMq(rabbit =>
{
    rabbit.HostName = "localhost";
    rabbit.UserName = "guest";
    rabbit.Password = "guest";
    rabbit.VirtualHost = "/";
})
.AutoProvision()     // Create queues/exchanges automatically
.AutoPurgeOnStartup(); // Clear queues on startup (useful in development)

// Listen on a queue
opts.ListenToRabbitQueue("orders");

// Publish to a queue
opts.PublishMessage<CreateOrder>().ToRabbitQueue("orders");

// Publish to an exchange
opts.PublishMessage<OrderCreated>().ToRabbitExchange("order-events");

// Dead letter queue
opts.ListenToRabbitQueue("orders")
    .DeadLetterQueue("orders-dead-letters");

// Conventional routing (auto-creates queues named after message types)
opts.UseRabbitMq().UseConventionalRouting();
```

## Amazon SQS

```bash
dotnet add package WolverineFx.AmazonSqs
```

```csharp
opts.UseAmazonSqsTransport(sqs =>
{
    sqs.Credentials = new BasicAWSCredentials(key, secret);
    sqs.RegionEndpoint = RegionEndpoint.USEast1;
})
.AutoProvision()
.AutoPurgeOnStartup();

opts.ListenToSqsQueue("orders");
opts.PublishMessage<OrderCreated>().ToSqsQueue("order-events");

// FIFO queues for ordering guarantees
opts.ListenToSqsQueue("orders.fifo");
opts.PublishMessage<CreateOrder>().ToSqsQueue("orders.fifo")
    .MessageGroupId(msg => msg.CustomerId.ToString());
```

## Azure Service Bus

```bash
dotnet add package WolverineFx.AzureServiceBus
```

```csharp
opts.UseAzureServiceBus(connectionString)
    .AutoProvision();

opts.ListenToAzureServiceBusQueue("orders");
opts.PublishMessage<OrderCreated>().ToAzureServiceBusTopic("order-events");

// Subscriptions for topics
opts.ListenToAzureServiceBusSubscription("order-events", "my-service");
```

## Kafka

```bash
dotnet add package WolverineFx.Kafka
```

```csharp
opts.UseKafka("localhost:9092");

opts.ListenToKafkaTopic("orders");
opts.PublishMessage<OrderCreated>().ToKafkaTopic("order-events");
```

## Listening Endpoint Configuration

```csharp
opts.ListenToRabbitQueue("orders")
    .MaximumParallelMessages(10)          // Parallel consumers
    .CircuitBreaker(cb =>                  // Circuit breaker
    {
        cb.PauseTime = 1.Minutes();
        cb.FailurePercentageThreshold = 10;
    })
    .UseDurableInbox()                     // Store incoming in DB before processing
    .Sequential();                         // Process in order (single consumer)
```

## Delivery Options

```csharp
// Send with metadata
await bus.SendAsync(new CreateOrder(...), new DeliveryOptions
{
    DeliverWithin = 5.Minutes(),           // Expire if not delivered in 5 min
    ScheduledTime = DateTimeOffset.UtcNow.AddHours(1), // Delay delivery
    TenantId = "tenant-abc",
    GroupId = customerId.ToString(),       // For FIFO/partitioning
});

// Reply to sender
await ctx.RespondToSenderAsync(new OrderResult(...)); // Sends back to originator
```

## Broadcasting to Topics

```csharp
// Publish to all subscribers of a topic name
await bus.BroadcastToTopicAsync("order-events", new OrderCreated(orderId));
```

## Error Handling per Transport

```csharp
// Dead letter queue handling
opts.ListenToRabbitQueue("orders")
    .DeadLetterQueue("orders-dead"); // Move failed messages here after exhausting retries

// Circuit breaker per endpoint
opts.ListenToRabbitQueue("payments")
    .CircuitBreaker(cb =>
    {
        cb.PauseTime = 30.Seconds();
        cb.FailurePercentageThreshold = 20; // Trip at 20% failure rate
        cb.TrackingPeriod = 2.Minutes();
    });

// Global retry policies
opts.Policies.OnException<TransientException>()
    .RetryWithCooldown(100.Milliseconds(), 500.Milliseconds(), 2.Seconds());
```

## Diagnostics

```csharp
// Preview routing configuration for a message type
dotnet run -- describe  // CLI command shows all subscriptions

// Programmatically inspect routing
var runtime = host.Services.GetRequiredService<IWolverineRuntime>();
var router = runtime.RoutingFor(typeof(CreateOrder));
foreach (var route in router.Routes)
    Console.WriteLine(route);
```
