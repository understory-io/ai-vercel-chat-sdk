# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **product documentation creation tool** built on top of the Vercel AI Chatbot template. The goal is to help CS teams create high-quality product documentation efficiently by combining AI assistance with collaborative artifact editing. The system integrates with external sources (Notion) for context-rich documentation generation.

**Key Transformation**: This started as a generic AI chatbot but is being specialized for product documentation workflows, particularly for feeding AI support agents like Intercom's Fin.

## Development Commands

```bash
# Development
pnpm dev                    # Start development server with Turbo
pnpm build                  # Run migrations and build for production
pnpm start                  # Start production server

# Database Operations
pnpm db:migrate            # Run database migrations
pnpm db:studio             # Open Drizzle Studio for DB management  
pnpm db:generate           # Generate new migrations
pnpm db:push               # Push schema changes to DB
pnpm db:pull               # Pull schema from DB

# Code Quality
pnpm lint                  # Run Next.js and Biome linters
pnpm lint:fix              # Fix linting issues automatically
pnpm format                # Format code with Biome

# Testing
pnpm test                  # Run Playwright E2E tests
```

## Architecture Overview

### Core Data Flow
1. **Chat Interface** → **AI Tools** → **Artifacts** → **Database/External Services**
2. User interacts via multimodal chat (text + file uploads)
3. AI uses tools to create/update documents, and manage suggestions
4. Documents render as collaborative artifacts alongside chat
5. Final documents can be published back to external systems (Notion)

### Key Architectural Components

#### **Artifact System** (`/artifacts/` and `/components/artifact.tsx`)
- **Purpose**: Real-time collaborative document editing with AI
- **Types**: text, code, image, sheet - each with client/server handlers
- **State Management**: Uses SWR for state management with streaming updates
- **Critical Files**: 
  - `lib/artifacts/server.ts` - Document handlers and saving logic
  - `components/data-stream-handler.tsx` - Manages streaming state transitions
  - `artifacts/*/server.ts` - Type-specific document generation

#### **AI Tools System** (`/lib/ai/tools/`)
- **Current Tools**: create-document, update-document, request-suggestions, get-weather
- **Integration Point**: Added to chat API in `app/(chat)/api/chat/route.ts`
- **Tool Pattern**: Each tool exports a function that returns AI SDK tool definition

#### **Database Layer** (`/lib/db/`)
- **ORM**: Drizzle with PostgreSQL (Neon)
- **Key Tables**: User, Chat, Document (with composite PK), Message_v2, Vote_v2, Suggestion, Stream
- **Schema**: `lib/db/schema.ts` - Note: Document table uses composite primary key (id + createdAt)
- **Queries**: `lib/db/queries.ts` - Database operations with error handling

#### **AI Provider Configuration** (`/lib/ai/providers.ts`)
- **Models**: Uses OpenAI GPT-4o for production, with model-specific assignments
- **Current Setup**: 
  - chat-model: gpt-4o
  - title-model: gpt-4o-mini (consider upgrading for documentation quality)
  - artifact-model: gpt-4o
- **Test Environment**: Uses mock models from `models.test.ts`

### Critical Implementation Details

#### **Document Saving Flow**
- Documents created via `createDocument` tool → processed by artifact handlers → saved via `saveDocument`
- **Foreign Key Constraint**: Document.userId must exist in User table or save fails silently
- **Composite Key**: Documents use (id, createdAt) as primary key for versioning

#### **Streaming State Management**
- Artifacts have two states: 'streaming' and 'idle'
- State transitions managed by `data-finish` events in streaming
- **Issue**: In-chat previews can get stuck in streaming state if `data-finish` not received
- **Fix**: Preview components check `artifact.isVisible` to determine streaming state


## Environment Configuration

### Required Variables
- `DATABASE_URL` and `POSTGRES_URL` - Neon PostgreSQL connection
- `OPENAI_API_KEY` - For AI model access
- `AUTH_SECRET` - NextAuth.js authentication

### Optional (Production)
- `REDIS_URL` - For resumable streaming (currently disabled)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage for file uploads

## Development Notes

### Database Schema Changes
- Always run `pnpm db:generate` after schema changes
- Use `pnpm db:migrate` to apply migrations
- Schema changes may require updating type definitions and queries

### Adding New AI Tools
1. Create tool in `/lib/ai/tools/[tool-name].ts`
2. Export tool function that returns AI SDK tool definition
3. Import and add to tools array in `/app/(chat)/api/chat/route.ts`

### Artifact Development
- Client components in `/artifacts/[type]/client.tsx` handle rendering and interactions
- Server components in `/artifacts/[type]/server.ts` handle AI generation
- Must register new artifact types in `lib/artifacts/server.ts` exports

### Common Debugging
- Check browser console for artifact state issues
- Use `console.log` in `saveDocument` for database debugging  
- Use Drizzle Studio (`pnpm db:studio`) for database inspection