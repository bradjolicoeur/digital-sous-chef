using DigitalSousChef.Server.Features.Auth;
using DigitalSousChef.Server.Features.Recipes;
using DigitalSousChef.Server.Features.Services;
using Marten;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Wolverine;
using Wolverine.Http;
using Wolverine.Marten;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Authentication
var fusionAuthIssuer = builder.Configuration["services:fusionauth-app:http:0"]
    ?? builder.Configuration["FusionAuth:Issuer"]
    ?? "http://localhost:53374";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        // Authority points to FusionAuth's Aspire service URL so ASP.NET Core can
        // fetch OIDC discovery metadata and use the issuer FusionAuth reports there.
        // This avoids hardcoding the issuer and survives port changes.
        opts.Authority = fusionAuthIssuer;
        opts.Audience = "e9fdb985-9173-4e01-9d73-ac2d60d1dc8e";
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

app.UseDefaultFiles();
app.MapStaticAssets();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();

// FusionAuth helper routes required by the React SDK
var fusionAuthClientId = "e9fdb985-9173-4e01-9d73-ac2d60d1dc8e";
app.MapFusionAuthHelperRoutes(fusionAuthIssuer, fusionAuthClientId);

app.MapWolverineEndpoints(opts =>
{
    opts.RequireAuthorizeOnAll();
});

app.MapFallbackToFile("/index.html");

await app.RunAsync();
