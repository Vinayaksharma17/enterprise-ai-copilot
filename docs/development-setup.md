# Development Setup Guide

## Prerequisites

Before starting, ensure you have the following installed:

- [Docker](https://docs.docker.com/get-docker/) (version 20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0+)
- [Git](https://git-scm.com/)

## Environment Configuration

1. Clone the repository:
```bash
git clone <repository-url>
cd enterprise-ai-copilot
```

2. Copy the environment example file:
```bash
cp .env.example .env
```

3. Review and update the `.env` file if needed. The defaults are configured for local development.

**Note:** Never commit the `.env` file. It contains sensitive configuration.

## Starting the Project

### Start all services (with logs visible)
```bash
npm run dev
# or
docker compose up
```

### Start in detached mode (background)
```bash
npm run dev:detached
# or
docker compose up -d
```

### Build and start (after dependency changes)
```bash
npm run dev:build
# or
docker compose up --build
```

## Accessing the Application

Once all services are running:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api/v1
- **Health Check**: http://localhost:5000/api/v1/health
- **Readiness Check**: http://localhost:5000/api/v1/health/ready

## Viewing Logs

### View all service logs
```bash
npm run dev:logs
# or
docker compose logs -f
```

### View logs for a specific service
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb
```

## Rebuilding Individual Services

```bash
docker compose build backend
docker compose build frontend
```

## Stopping Services

### Stop without deleting data
```bash
npm run stop
# or
docker compose down
```

### Stop and remove all data (reset environment)
```bash
npm run stop:clean
# or
docker compose down -v
```

**Warning:** Using `down -v` will delete all persistent data (MongoDB, ChromaDB, Redis). Only use this for a complete reset.

## Resetting the Development Environment

1. Stop and clean volumes:
```bash
docker compose down -v
```

2. Remove node_modules if needed (they're in containers):
```bash
docker compose build --no-cache
```

3. Start fresh:
```bash
docker compose up
```

## Troubleshooting

### Port Conflicts

If you see port conflicts, check if another service is using the ports. Update the port values in your `.env` file:

```env
FRONTEND_PORT=3001
BACKEND_PORT=5001
MONGODB_PORT=27018
CHROMA_PORT=8001
REDIS_PORT=6380
```

### Failed Health Checks

- **MongoDB failing**: Wait up to 40 seconds for initialization. Check logs: `docker compose logs mongodb`
- **Redis failing**: Usually starts quickly. Check: `docker compose logs redis`
- **ChromaDB failing**: May take time on first start. Check: `docker compose logs chromadb`

### Hot Reload Not Working

- Ensure volumes are mounted correctly (check docker-compose.yml)
- For frontend, the `.next` cache is mounted separately to avoid conflicts
- Restart the service if needed: `docker compose restart frontend` or `docker compose up --build`

### Container Build Issues

Clear Docker cache and rebuild:
```bash
docker compose build --no-cache
```

## Verifying the Setup

1. All containers running: `docker compose ps`
2. Backend healthy: curl http://localhost:5000/api/v1/health
3. Frontend accessible: open http://localhost:3000 in browser
4. Check connectivity indicator on frontend shows "Connected"
