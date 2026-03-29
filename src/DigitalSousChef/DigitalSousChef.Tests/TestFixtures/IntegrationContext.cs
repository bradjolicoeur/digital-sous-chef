using Alba;
using Marten;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalSousChef.Tests.TestFixtures;

/// <summary>
/// Base class for integration tests. Clears all Marten data before each test
/// to guarantee full isolation between test runs.
/// </summary>
public abstract class IntegrationContext : IAsyncLifetime
{
    protected readonly AppFixture Fixture;
    protected IAlbaHost Host => Fixture.Host;
    protected IDocumentStore Store => Host.Services.GetRequiredService<IDocumentStore>();

    protected IntegrationContext(AppFixture fixture) => Fixture = fixture;

    public async Task InitializeAsync()
    {
        await Store.Advanced.ResetAllData();
    }

    public Task DisposeAsync() => Task.CompletedTask;
}
