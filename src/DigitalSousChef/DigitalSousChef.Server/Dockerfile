# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS with-node
RUN apt-get update
RUN apt-get install curl
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash
RUN apt-get -y install nodejs


FROM with-node AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["DigitalSousChef.Server/DigitalSousChef.Server.csproj", "DigitalSousChef.Server/"]
COPY ["digitalsouschef.client/digitalsouschef.client.esproj", "digitalsouschef.client/"]
RUN dotnet restore "./DigitalSousChef.Server/DigitalSousChef.Server.csproj"
COPY . .
WORKDIR "/src/DigitalSousChef.Server"
RUN dotnet build "./DigitalSousChef.Server.csproj" -c $BUILD_CONFIGURATION -o /app/build

# This stage is used to publish the service project to be copied to the final stage
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./DigitalSousChef.Server.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# This stage is used in production or when running from VS in regular mode (Default when not using the Debug configuration)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Install dependencies required by Playwright (Chromium)
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
        libdrm2 libdbus-1-3 libxcb1 libxkbcommon0 libx11-6 libx11-xcb1 libxcb-dri3-0 \
        libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
        libcairo2 libasound2 libxshmfence1 libexpat1 && \
    rm -rf /var/lib/apt/lists/*
USER $APP_UID

ENTRYPOINT ["dotnet", "DigitalSousChef.Server.dll"]
