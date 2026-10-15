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
docker compose up
```

4. Access the application:
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

## AI Provider Configuration

Document ingestion and Q&A require an embedding and chat model provider. Configure the
provider and credentials in `.env` (see `.env.example`):

```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini

EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=sk-...        # falls back to LLM_API_KEY when empty
EMBEDDING_MODEL=text-embedding-3-small
```

Providers are isolated behind interfaces (`integrations/llm`) so they can be swapped.
The backend fails fast at startup if credentials are missing outside of tests.

## Testing

Backend tests run against an in-memory MongoDB and mock the LLM/embedding/vector
providers, so they need no external services:

```bash
cd backend
npm test
```

An optional end-to-end smoke test against real ChromaDB and provider APIs is skipped by
default. Run it with infrastructure up and credentials set:

```bash
cd backend
RUN_SMOKE_TESTS=true CHROMA_URL=http://localhost:8000 LLM_API_KEY=sk-... npm test -- smoke.rag
```
