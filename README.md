# Enterprise AI Knowledge & Support Copilot

An enterprise-grade AI knowledge assistant that enables employees to upload organizational documents, ask natural-language questions, and receive AI-generated answers grounded in retrieved document chunks with source citations.

## Project Purpose

This application serves as an internal knowledge base and support copilot, helping employees quickly find accurate information from company documents while maintaining proper source attribution.

## Architecture

This is a full-stack monorepo with the following architecture:

- **Frontend**: Next.js 15 (App Router) with TypeScript and Tailwind CSS
- **Backend**: Node.js with Express.js and TypeScript (REST API)
- **MongoDB**: Primary database for users, documents, conversations, and messages
- **ChromaDB**: Vector database for document embeddings and similarity search (RAG)
- **Redis**: Caching, rate limiting, and job coordination

All services are containerized using Docker and orchestrated with Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)
- [Git](https://git-scm.com/)

## Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd enterprise-ai-copilot
```

2. Configure environment variables:
```bash
cp .env.example .env
```

3. Start the development environment:
```bash
docker compose up -d
```

4. Download the local models (one-time; they persist in a Docker volume):
```powershell
docker exec -it enterprise-ai-copilot-ollama ollama pull qwen2.5:3b
docker exec -it enterprise-ai-copilot-ollama ollama pull nomic-embed-text
docker exec -it enterprise-ai-copilot-ollama ollama list
```
On macOS/Linux use the same commands (the `docker exec` syntax is identical).

5. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api/v1

## Documentation

- [Architecture](docs/architecture.md) - Detailed system architecture and design decisions
- [Development Setup](docs/development-setup.md) - Comprehensive setup and troubleshooting guide

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all services with logs |
| `npm run dev:detached` | Start services in background |
| `npm run dev:build` | Build and start services |
| `npm run stop` | Stop all services (preserves data) |
| `npm run stop:clean` | Stop all services and remove volumes (reset) |
| `npm run build` | Build all Docker images |

## Technology Stack

### Frontend
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS

### Backend
- Node.js with Express.js
- TypeScript
- Mongoose (MongoDB ODM)

### Infrastructure
- Docker & Docker Compose
- MongoDB 7.0
- ChromaDB 0.5.23
- Redis 7.4
- Ollama `0.5.7` (local LLM + embedding runtime)

## Features

- **Authentication & RBAC**: JWT authentication with admin/employee roles, department-based scoping, profile management.
- **Document ingestion**: Admins upload PDF/TXT documents which are parsed, chunked, embedded, and stored in ChromaDB. Duplicate files are detected by content hash; failures are recorded with a safe reason.
- **Grounded Q&A (RAG)**: Employees ask natural-language questions and receive answers grounded strictly in retrieved document chunks, with source citations (document name, page, excerpt).
- **Access-controlled retrieval**: Retrieval is scoped to documents the requesting user is allowed to see (public, department, or admin-only), enforced server-side through a vector-store filter.
- **Conversations**: Chat history is persisted per user with conversation ownership enforcement.
- **Web UI**: Knowledge Base (upload/list/delete) and Chat (citations) pages.

## Project Status

**Phase 1 - Foundation**: Complete
- Project scaffolding and monorepo structure
- Docker infrastructure setup
- Basic health checks and connectivity
- Development environment configuration

**Phase 2 - Core Features**: Complete
- JWT authentication (register, login, me) and RBAC
- Role- and department-based access control
- User profile management

**Phase 3 - RAG & AI Integration**: Complete
- Document ingestion and processing pipeline (PDF/TXT → chunks → embeddings → ChromaDB)
- Authorization-scoped vector search
- RAG question answering with citations and conversation history
- Knowledge Base and Chat user interfaces

**Next**: Phase 4 - Multi-agent workflows, analytics, security hardening, and production deployment.

## API Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/v1/auth/register` | Public | Register a new user |
| `POST` | `/api/v1/auth/login` | Public | Authenticate and receive a JWT |
| `GET` | `/api/v1/auth/me` | Authenticated | Current user profile |
| `GET` | `/api/v1/documents` | Authenticated | List accessible documents |
| `GET` | `/api/v1/documents/:id` | Authenticated | Get an accessible document |
| `POST` | `/api/v1/documents/upload` | Admin | Upload and index a document |
| `DELETE` | `/api/v1/documents/:id` | Admin | Delete a document and its vectors |
| `POST` | `/api/v1/chat` | Authenticated | Ask a question, get a cited answer |
| `GET` | `/api/v1/health` | Public | Service health |

Full interactive API docs (Swagger UI) are served at `/api/v1/docs`.

## Local AI with Ollama

The default configuration runs both the chat model and the embedding model locally
on Ollama — no cloud account or API keys required.

| Role | Model | Purpose |
|------|-------|---------|
| Chat | `qwen2.5:3b` | Answer generation (small, CPU-friendly) |
| Embeddings | `nomic-embed-text` | Document + query embeddings (768 dimensions) |

### How it is wired

- The `ollama` service runs the official `ollama/ollama:0.5.7` image on the internal
  Docker network and is reachable by the backend at `http://ollama:11434`. It is **not**
  exposed to the host by default; uncomment the loopback (`127.0.0.1`) port binding in
  `docker-compose.yml` only for local diagnostics.
- Downloaded models persist in the `ollama_data` volume, so they survive container
  recreation. Models are **not** pulled automatically on startup.
- Provider selection is configuration-driven (`LLM_PROVIDER`, `EMBEDDING_PROVIDER`).
  Only the selected provider is ever constructed, so choosing Ollama guarantees no cloud
  client or cloud credential is used.

### Configuration (`.env`)

```env
LLM_PROVIDER=ollama
LLM_MODEL=qwen2.5:3b

EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text

OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_TIMEOUT_MS=120000
OLLAMA_MAX_CONCURRENCY=2
OLLAMA_MAX_QUEUE=16
OLLAMA_RETRIES=2
OLLAMA_KEEP_ALIVE=5m
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_PREDICT=512
```

- `OLLAMA_KEEP_ALIVE` controls how long a model stays loaded (RAM) between requests.
- `OLLAMA_MAX_CONCURRENCY` bounds simultaneous model calls; extra requests wait in a
  bounded queue and overflow returns a clear `503 Service Unavailable`.
- `OLLAMA_RETRIES` retries transient failures (container restarting, model loading).

### Managing models

```powershell
# Pull the models (one time)
docker exec -it enterprise-ai-copilot-ollama ollama pull qwen2.5:3b
docker exec -it enterprise-ai-copilot-ollama ollama pull nomic-embed-text

# Verify they are installed
docker exec -it enterprise-ai-copilot-ollama ollama list

# Inspect running containers and live resource usage
docker compose ps
docker stats
```

An interrupted `ollama pull` leaves a partial layer; re-run the pull command to resume.
If a model is missing at request time the backend returns a safe error rather than
downloading it on demand.

### Switching to a cloud provider (optional)

Set `LLM_PROVIDER=openai` / `EMBEDDING_PROVIDER=openai` and provide `LLM_API_KEY` /
`EMBEDDING_API_KEY`. Cloud credentials are only required for the cloud providers.

### Changing the embedding model (safe migration)

Vectors produced by different embedding models are not comparable, so the active ChromaDB
collection name is derived from the embedding provider and model
(`documents__ollama-nomic-embed-text`). Switching embedding models therefore writes to a
separate collection and can never mix incompatible vectors:

```bash
# Re-embeds every stored document into the collection for the current embedding model.
cd backend
npm run reindex
```

Existing collections are never deleted automatically.

## Testing

Backend tests run against an in-memory MongoDB and mock the LLM/embedding/vector
providers, so they need no external services and no cloud credentials:

```bash
cd backend
npm test
```

An optional end-to-end test against a real local Ollama runtime and ChromaDB is skipped by
default. Run it with the services up and models pulled:

```bash
cd backend
RUN_OLLAMA_TESTS=true \
  LLM_PROVIDER=ollama EMBEDDING_PROVIDER=ollama \
  OLLAMA_BASE_URL=http://localhost:11434 CHROMA_URL=http://localhost:8000 \
  npm test -- ollama.rag
```
