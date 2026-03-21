var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume()
    .WithPgAdmin();

var martenDb = postgres.AddDatabase("marten");

var apiService = builder.AddProject<Projects.DigitalSousChef_Server>("digitalsouschef-server")
    .WithReference(martenDb)
    .WaitFor(martenDb);

builder.AddNpmApp("digitalsouschef-client", "../digitalsouschef.client", "dev")
    .WithReference(apiService)
    .WithEnvironment("BROWSER", "none")
    .WithHttpsEndpoint(env: "DEV_SERVER_PORT")
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

builder.Build().Run();
