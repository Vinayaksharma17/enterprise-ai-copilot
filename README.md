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

## Project Status

**Phase 1 - Foundation**: Complete
- Project scaffolding and monorepo structure
- Docker infrastructure setup
- Basic health checks and connectivity
- Development environment configuration

Future phases will add authentication, document processing, RAG, and chat functionality.
