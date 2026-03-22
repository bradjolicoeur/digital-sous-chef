# Digital Sous Chef

A recipe management and meal planning app built with .NET 10 / ASP.NET Core, React 19, Marten (PostgreSQL), Wolverine, and .NET Aspire.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 22+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or OrbStack / Podman)

## Running Locally

Start all services via Aspire:

```bash
cd src/DigitalSousChef
dotnet run --project DigitalSousChef.AppHost
```

The Aspire dashboard will open automatically and show all running services:

| Service | URL |
|---------|-----|
| Aspire Dashboard | `https://localhost:17116` (or printed on startup) |
| API (ASP.NET Core) | proxied via Aspire |
| React frontend | `https://localhost:5173` |
| FusionAuth | `http://localhost:9011` |
| pgAdmin | linked from Aspire dashboard |

## FusionAuth

FusionAuth is the identity provider. It runs as a Docker container and is automatically configured on first boot via [Kickstart](src/DigitalSousChef/DigitalSousChef.AppHost/kickstart/kickstart.json).

### Admin UI

Navigate to `http://localhost:9011/admin` and log in with:

| Field | Value |
|-------|-------|
| Email | `admin@digitalsouschef.local` |
| Password | `password` |

### Dev Application

| Setting | Value |
|---------|-------|
| Application Name | Digital Sous Chef |
| Client ID | `e9fdb985-9173-4e01-9d73-ac2d60d1dc8e` |
| Tenant ID | `d7d09513-a3f5-401c-9685-34ab6c552453` |
| OAuth Grants | `authorization_code`, `refresh_token` |
| PKCE | Required (`Required` policy) |

### Dev Users

The following users are created automatically by Kickstart:

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | `admin@digitalsouschef.local` | `password` | FusionAuth admin + app admin role |
| Regular user | `chef@example.com` | `password` | Registered to the app |

> **Re-running Kickstart:** Kickstart only runs on a completely empty database. If you need to re-provision, delete the Postgres Docker volume and restart:
> ```bash
> # In the Aspire dashboard: stop all, then from Docker:
> docker volume ls  # find the postgres volume
> docker volume rm <volume-name>
> ```

## Project Structure

```
src/DigitalSousChef/
  DigitalSousChef.AppHost/       # Aspire orchestration
    kickstart/kickstart.json     # FusionAuth auto-configuration
  DigitalSousChef.Server/        # ASP.NET Core backend (Wolverine + Marten)
  digitalsouschef.client/        # React 19 + TypeScript + Vite frontend
  DigitalSousChef.ServiceDefaults/
mockup/                          # Design source of truth (Tailwind mockup)
```

## Architecture

- **Backend**: Wolverine handles all commands/queries via `[WolverinePost]` / `[WolverineGet]` HTTP endpoints. No MediatR or raw controllers.
- **Database**: Marten on PostgreSQL for both document storage and event sourcing.
- **Auth**: FusionAuth (OIDC / OAuth 2.0 with PKCE). Backend validates JWTs; frontend uses `@fusionauth/react-sdk`.
- **Orchestration**: .NET Aspire wires up Postgres, FusionAuth, the API, and the frontend with service discovery.

See `.github/copilot-instructions.md` for detailed coding conventions.
