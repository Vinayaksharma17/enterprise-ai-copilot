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

### AI Provider Configuration

The default configuration runs locally on Ollama and needs **no API keys**:

```env
LLM_PROVIDER=ollama
LLM_MODEL=qwen2.5:3b

EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text

OLLAMA_BASE_URL=http://ollama:11434
```

After the stack is up, download the models once (they persist in the `ollama_data` volume):

```powershell
docker exec -it enterprise-ai-copilot-ollama ollama pull qwen2.5:3b
docker exec -it enterprise-ai-copilot-ollama ollama pull nomic-embed-text
docker exec -it enterprise-ai-copilot-ollama ollama list
```

**Cloud providers (optional):** set `LLM_PROVIDER=openai` / `EMBEDDING_PROVIDER=openai` and
provide `LLM_API_KEY` / `EMBEDDING_API_KEY`. The backend refuses to start outside of tests
when a *selected* cloud provider is missing its credentials; Ollama requires none.

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

### Ollama / Local Model Issues

- **Chat or upload returns `503`**: the model is still loading, Ollama is restarting, or the
  request queue is saturated. Check `docker compose logs -f ollama`. The backend retries
  transient failures and returns a safe error otherwise.
- **Model not found**: pull it — `docker exec -it enterprise-ai-copilot-ollama ollama pull qwen2.5:3b`.
  Models are never downloaded automatically at request time.
- **Slow inference**: local CPU inference is expected to be slow on first use (model load +
  generation). Measure before changing anything:
  ```powershell
  docker stats
  docker compose logs -f ollama
  ```
  Prefer smaller models, keep `OLLAMA_KEEP_ALIVE` non-zero to avoid reloading, and lower
  `OLLAMA_MAX_CONCURRENCY` if the machine is memory-constrained.

### Inspecting Resource Usage

```powershell
docker stats                              # live CPU / memory per container
docker compose ps                         # container status
docker exec -it enterprise-ai-copilot-ollama ollama ps   # loaded models + memory
```

## Verifying the Setup

1. All containers running: `docker compose ps`
2. Backend healthy: curl http://localhost:5000/api/v1/health
3. Models downloaded: `docker exec -it enterprise-ai-copilot-ollama ollama list`
4. Frontend accessible: open http://localhost:3000 in browser
5. Check connectivity indicator on frontend shows "Connected"
