var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume()
    .WithPgAdmin();

var martenDb = postgres.AddDatabase("marten");
var fusionAuthDb = postgres.AddDatabase("fusionauth");

var postgresEndpoint = postgres.Resource.PrimaryEndpoint;

var fusionauth = builder.AddContainer("fusionauth-app", "fusionauth/fusionauth-app")
    .WithHttpEndpoint(targetPort: 9011, port: 9011, name: "http")
    .WithEnvironment(ctx =>
    {
        ctx.EnvironmentVariables["DATABASE_URL"] = ReferenceExpression.Create(
            $"jdbc:postgresql://{postgresEndpoint.Property(EndpointProperty.Host)}:{postgresEndpoint.Property(EndpointProperty.Port)}/fusionauth");
        ctx.EnvironmentVariables["DATABASE_ROOT_USERNAME"] = "postgres";
        ctx.EnvironmentVariables["DATABASE_ROOT_PASSWORD"] = postgres.Resource.PasswordParameter;
        ctx.EnvironmentVariables["DATABASE_USERNAME"] = "fusionauth";
        ctx.EnvironmentVariables["DATABASE_PASSWORD"] = postgres.Resource.PasswordParameter;
        ctx.EnvironmentVariables["FUSIONAUTH_APP_MEMORY"] = "512M";
        ctx.EnvironmentVariables["SEARCH_TYPE"] = "database";
        ctx.EnvironmentVariables["FUSIONAUTH_APP_KICKSTART_FILE"] = "/usr/local/fusionauth/kickstart/kickstart.json";
    })
    .WithBindMount("./kickstart", "/usr/local/fusionauth/kickstart", isReadOnly: true)
    .WaitFor(fusionAuthDb);

var apiService = builder.AddProject<Projects.DigitalSousChef_Server>("digitalsouschef-server")
    .WithReference(martenDb)
    .WithReference(fusionauth.GetEndpoint("http"))
    .WaitFor(martenDb)
    .WaitFor(fusionauth);

builder.AddNpmApp("digitalsouschef-client", "../digitalsouschef.client", "dev")
    .WithReference(apiService)
    .WithReference(fusionauth.GetEndpoint("http"))
    .WithEnvironment("BROWSER", "none")
    .WithHttpsEndpoint(port: 56178, env: "DEV_SERVER_PORT")
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

builder.Build().Run();
