var builder = DistributedApplication.CreateBuilder(args);

var apiService = builder.AddProject<Projects.DigitalSousChef_Server>("digitalsouschef-server");

builder.AddNpmApp("digitalsouschef-client", "../digitalsouschef.client", "dev")
    .WithReference(apiService)
    .WithEnvironment("BROWSER", "none")
    .WithHttpsEndpoint(env: "DEV_SERVER_PORT")
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

builder.Build().Run();
