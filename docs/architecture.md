# Enterprise AI Knowledge & Support Copilot - Architecture

## System Overview

The Enterprise AI Knowledge & Support Copilot is a full-stack application that enables employees to upload organizational documents, ask natural-language questions, and receive AI-generated answers grounded in retrieved document chunks with source citations.

## System Components

| Component | Technology | Responsibility |
|-----------|------------|---------------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS | User interface, API communication, state management |
| Backend | Node.js, Express.js, TypeScript | REST API, business logic, data validation, authentication & authorization middleware, RAG orchestration |
| MongoDB | MongoDB 7.0 | Primary data store for users, documents, document chunks, conversations, and messages |
| ChromaDB | ChromaDB 0.5.23 | Vector database for document embeddings and similarity search (RAG) |
| Redis | Redis 7.4 | Caching, rate limiting, and job coordination (reserved for future phases) |

## Service-to-Service Communication

All services communicate through an internal Docker network (`enterprise-network`). Service names are used as hostnames:

- Frontend → Backend: `http://backend:5000` (internal) or `http://localhost:5000` (external browser)
- Backend → MongoDB: `mongodb://mongodb:27017`
- Backend → Redis: `redis://redis:6379`
- Backend → ChromaDB: `http://chromadb:8000`

**Important:** Never use `localhost` for inter-container communication. Only external clients (browsers) use `localhost` to reach exposed ports.

## Container Networking

- Docker network: `enterprise-network` (bridge driver)
- All services attached to the same network for secure internal communication
- Database and infrastructure ports are exposed only for development/debugging; in production, consider restricting exposure
- Frontend and backend ports are exposed to allow browser access

## Data Persistence

Named volumes ensure data survives container recreation:

- `mongodb_data`: MongoDB database files
- `chromadb_data`: ChromaDB vector storage
- `redis_data`: Redis persistence
- `uploads_data`: Uploaded source documents

## Implemented Features

### Authentication & Authorization
- JWT-based authentication (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`)
- Role-based access control: `admin` and `employee`
- Every request passes through `authenticate` (verifies JWT, loads a trusted user profile
  with role and department) then `authorize` (role gate) middleware
- Passwords hashed with bcrypt; tokens are short-lived and signed with `JWT_SECRET`

### Document Ingestion
- Admin-only upload (`POST /documents/upload`, multipart) of PDF and TXT files
- Content-type validation by extension plus magic bytes; size limited by `MAX_FILE_SIZE_BYTES`
- Duplicate detection by SHA-256 content hash (unique index) → `409 Conflict`
- Text extraction (page-aware for PDFs) → chunking via `RecursiveCharacterTextSplitter`
  with overlap → embeddings → vectors upserted to ChromaDB → chunk records persisted in MongoDB
- Processing is synchronous; the document record carries a `status`
  (`uploaded` → `processing` → `processed` | `failed`). On failure, vectors and chunks are
  cleaned up and a sanitized `processingError` is stored

### RAG Question Answering
- `POST /chat` accepts a question and optional `conversationId`
- Pipeline: load history (bounded) → embed question → resolve the set of authorized
  document IDs → vector search filtered to those IDs → build a grounded prompt → generate
  answer → re-validate retrieved sources against accessible documents → persist messages
- If no relevant context is retrieved, a fixed "not found in the knowledge base" answer is
  returned with no sources (no hallucination)
- Answers return source citations: document id/name, chunk id, page number, section title, excerpt

### Data Models (MongoDB)
- `User`: identity, role, department, active flag
- `Document`: metadata, `fileHash`, `status`, `accessLevel`, `allowedDepartments`, `chunkCount`
- `DocumentChunk`: `documentId`, `chunkIndex` (unique with document), `chunkId` (vector id), text, page
- `Conversation`: owner, title
- `Message`: `conversationId`, role, content, embedded `sources`

## Access Control Model

Documents carry an `accessLevel`:

- `public`: visible to all authenticated users
- `restricted`: visible to admins and users whose department is in `allowedDepartments`

Retrieval authorization is enforced **server-side at the vector store** by computing the
set of accessible document IDs in MongoDB and passing a filter
(`where: { documentId: { $in: [...] } }`) to ChromaDB. This avoids fetching documents the
user cannot see and filtering them later. Retrieved sources are additionally re-validated
against the database before being returned. This design also works around ChromaDB 0.5.x's
lack of array metadata support for department lists.

## AI Provider Abstraction

LLM, embeddings, and vector store access are isolated behind interfaces
(`backend/src/integrations`):

- `llm.interface.ts`: `ChatProvider`, `EmbeddingsProvider`, `VectorStore` contracts
- `llm.service.ts` / `embeddings.service.ts`: OpenAI implementations (provider selectable
  via `LLM_PROVIDER` / `EMBEDDING_PROVIDER`), with deterministic in-memory fakes for tests
- `vector-store/`: a lightweight fetch-based ChromaDB v1 REST client (avoiding native
  ONNX/transformers dependencies) plus a `VectorStore` service wrapper

This keeps the domain code independent of any single vendor and makes the whole pipeline
testable without external services.

## Security Boundaries

- Server-side secrets (DB credentials, provider API keys) never exposed to frontend via `NEXT_PUBLIC_*`
- CORS configured to restrict origins
- Non-root users in production Docker images
- Internal network isolates database services from external access
- Environment-based configuration for different deployment stages
- Config validation fails fast at startup when required variables (including provider
  credentials) are missing outside of tests
- Uploaded files are content-validated and size-limited; processing errors are sanitized
  before being persisted or returned
- Retrieval and citation generation are scoped to the requesting user's authorized documents

## Development vs Production Topology

### Development
- Hot reload for frontend and backend (bind mounts)
- All services exposed for debugging
- Development-optimized Docker targets
- Verbose error messages

### Production
- Optimized multi-stage builds
- Non-root users
- Standalone Next.js output
- Compiled TypeScript for backend
- Restricted port exposure (recommended)
