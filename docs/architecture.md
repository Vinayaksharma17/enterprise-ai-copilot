# Enterprise AI Knowledge & Support Copilot - Architecture

## System Overview

The Enterprise AI Knowledge & Support Copilot is a full-stack application that enables employees to upload organizational documents, ask natural-language questions, and receive AI-generated answers grounded in retrieved document chunks with source citations.

## System Components

| Component | Technology | Responsibility |
|-----------|------------|---------------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS | User interface, API communication, state management |
| Backend | Node.js, Express.js, TypeScript | REST API, business logic, data validation, authentication middleware (future) |
| MongoDB | MongoDB 7.0 | Primary data store for users, documents, conversations, and messages |
| ChromaDB | ChromaDB 0.5.23 | Vector database for document embeddings and similarity search (future RAG) |
| Redis | Redis 7.4 | Caching, rate limiting, and job coordination (future) |

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

## Future Integration Points

### Authentication (Future)
- User registration, login, session management
- Role-based access control (RBAC)
- JWT token validation middleware
- Protected routes

### Document Ingestion (Future)
- File upload (PDF, DOCX, TXT, etc.)
- Document parsing and text extraction
- Chunking strategies
- Metadata extraction and storage

### RAG (Retrieval-Augmented Generation) (Future)
- Embeddings generation using LangChain.js
- Vector storage in ChromaDB
- Semantic search and retrieval
- Context construction for LLM prompts

### Chat & Conversations (Future)
- Conversation management
- Message history
- Streaming responses
- Source citation tracking
- Context window management

### AI Integration (Future)
- Pluggable LLM providers (OpenAI, Gemini, etc.)
- Pluggable embeddings providers
- Prompt templates and engineering
- Response validation and safety

## Security Boundaries

- Server-side secrets (DB credentials, API keys) never exposed to frontend via `NEXT_PUBLIC_*`
- CORS configured to restrict origins
- Non-root users in production Docker images
- Internal network isolates database services from external access
- Environment-based configuration for different deployment stages

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
