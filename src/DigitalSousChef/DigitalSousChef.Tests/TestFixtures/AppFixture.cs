using Alba;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalSousChef.Tests.TestFixtures;

/// <summary>
/// Shared Alba host for the integration test suite.
/// Spins up the full ASP.NET Core pipeline with a fake auth handler and
/// a test-specific Marten connection string.
///
/// Requires a running PostgreSQL instance. Set MARTEN_CONNECTION_STRING
/// or ConnectionStrings__marten in the environment to point at your test DB.
/// When Aspire is running, ConnectionStrings__marten is typically injected
/// automatically for the server process — for standalone test runs you must
/// supply it manually.
/// </summary>
public class AppFixture : IAsyncLifetime
{
    public const string TestUserId = TestAuthHandler.TestUserId;

    public IAlbaHost Host { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        var connStr = Environment.GetEnvironmentVariable("MARTEN_CONNECTION_STRING")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__marten")
            ?? "Host=localhost;Port=5432;Database=souschef_test;Username=postgres;Password=postgres";

        Host = await AlbaHost.For<Program>(b =>
        {
            b.UseSetting("ConnectionStrings:marten", connStr);

            b.ConfigureServices(services =>
            {
                // Replace JWT auth with a test scheme that always authenticates
                // as TestUserId so handlers can resolve the user without FusionAuth.
                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                    options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.SchemeName, _ => { });
            });
        });
    }

    public async Task DisposeAsync() => await Host.DisposeAsync();
}

[CollectionDefinition("integration")]
public class IntegrationCollection : ICollectionFixture<AppFixture>;
