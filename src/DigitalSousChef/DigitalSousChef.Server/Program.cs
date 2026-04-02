using DigitalSousChef.Server.Features.Auth;
using DigitalSousChef.Server.Features.Recipes;
using DigitalSousChef.Server.Features.Services;
using Marten;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Wolverine;
using Wolverine.Http;
using Wolverine.Marten;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Configure forwarded headers for Cloud Run (TLS termination at the load balancer)
builder.Services.Configure<ForwardedHeadersOptions>(opts =>
{
    opts.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    opts.KnownNetworks.Clear();
    opts.KnownProxies.Clear();
});

// Authentication
var fusionAuthIssuer = builder.Configuration["services:fusionauth-app:http:0"]
    ?? builder.Configuration["FusionAuth:Issuer"]
    ?? "http://localhost:53374";

var fusionAuthClientId = builder.Configuration["FusionAuth:ClientId"]
    ?? "e9fdb985-9173-4e01-9d73-ac2d60d1dc8e";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        // Authority points to FusionAuth's Aspire service URL so ASP.NET Core can
        // fetch OIDC discovery metadata and use the issuer FusionAuth reports there.
        // This avoids hardcoding the issuer and survives port changes.
        opts.Authority = fusionAuthIssuer;
        opts.Audience = fusionAuthClientId;
        opts.RequireHttpsMetadata = false; // dev only — FusionAuth on HTTP
        // Read access token from the app.at cookie (set by the FusionAuth helper routes)
        opts.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                if (string.IsNullOrEmpty(ctx.Token))
                {
                    var cookieToken = ctx.Request.Cookies["app.at"];
                    if (!string.IsNullOrEmpty(cookieToken))
                        ctx.Token = cookieToken;
                }
                return Task.CompletedTask;
            },
            OnAuthenticationFailed = ctx =>
            {
                var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                logger.LogError(ctx.Exception,
                    "JWT authentication failed. Token present: {HasToken}, Authority: {Authority}, Exception: {Message}",
                    !string.IsNullOrEmpty(ctx.Request.Cookies["app.at"]),
                    fusionAuthIssuer,
                    ctx.Exception.Message);
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();

// Wolverine
builder.Host.UseWolverine(opts =>
{
    opts.Policies.AutoApplyTransactions();
    opts.Policies.UseDurableLocalQueues();
});
builder.Services.AddWolverineHttp();

// PostgreSQL data source (Aspire component)
builder.AddNpgsqlDataSource("marten");

// Marten
builder.Services.AddMarten(opts =>
{
    opts.DatabaseSchemaName = "souschef";
    opts.Schema.For<Recipe>()
        .FullTextIndex(x => x.Title, x => x.Description, x => x.Category);
})
.UseLightweightSessions()
.UseNpgsqlDataSource()
.IntegrateWithWolverine();

// App services
builder.Services.AddHttpClient();
builder.Services.AddSingleton<IAIRecipeExtractor, PlaywrightRecipeExtractor>();
builder.Services.AddSingleton<IIngredientCategoriser, IngredientCategoriser>();

builder.Services.AddOpenApi();

// Serialize C# enums as strings in HTTP responses so the frontend receives
// "Medium" instead of 1, "Easy" instead of 0, etc.
builder.Services.ConfigureHttpJsonOptions(opts =>
    opts.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

var app = builder.Build();

app.MapDefaultEndpoints();

// Trust forwarded headers from Cloud Run's load balancer
app.UseForwardedHeaders();

app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();

// FusionAuth helper routes required by the React SDK
app.MapFusionAuthHelperRoutes(fusionAuthIssuer, fusionAuthClientId);

app.MapWolverineEndpoints(opts =>
{
    opts.RequireAuthorizeOnAll();
});

app.MapFallbackToFile("/index.html");

await app.RunAsync();

// Exposes the compiler-generated Program class to the test project via AlbaHost.For<Program>().
public partial class Program { }
