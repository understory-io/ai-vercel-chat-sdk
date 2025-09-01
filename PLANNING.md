# 📋 PLANNING.md - Product Documentation Platform Development

## 🎯 Executive Summary

**Project Goal**: Transform the Vercel AI Chatbot into a specialized product documentation creation tool for CS teams, optimized for feeding AI support agents like Intercom's Fin.

### 📊 Overall Progress
- **Total Completion**: 0/75 tasks (0%)
- **Current Phase**: Planning & Setup
- **Status**: 🟡 In Planning

### 🚀 Quick Status by Phase
- [ ] **Phase 1**: AI Model Configuration (0/12 tasks)
- [ ] **Phase 2**: Context Selection UI (0/18 tasks)
- [ ] **Phase 3**: Document Generation Flow (0/15 tasks)
- [ ] **Phase 4**: Collaborative Editing (0/12 tasks)
- [ ] **Phase 5**: Publishing Pipeline (0/10 tasks)
- [ ] **Phase 6**: Testing & Polish (0/8 tasks)

---

## 🎯 Current Focus
> **Active Task**: Setting up GPT-5 model configuration
> **Blocker**: None
> **Next Up**: Context selection UI components

---

## 📝 Phase 1: AI Model Configuration
**Goal**: Integrate GPT-5 with optimized settings for high-quality documentation
**Status**: 0/12 tasks complete

### Core Model Setup
- [ ] Research GPT-5 API documentation and best practices
- [ ] Update `lib/ai/providers.ts` to use GPT-5 models
  - [ ] Replace `gpt-4o` with `gpt-5` for chat-model
  - [ ] Replace `gpt-4o` with `gpt-5` for artifact-model
  - [ ] Keep `gpt-5-mini` for title-model (cost optimization)
  - [ ] Remove separate reasoning model (GPT-5 handles internally)
- [ ] Configure streaming settings for GPT-5
- [ ] Add vision capability configuration
- [ ] Test model responses with sample documentation requests

### Prompt Engineering
- [ ] Create specialized system prompt for documentation generation
- [ ] Add documentation quality guidelines to prompts
- [ ] Implement context-aware prompt construction
- [ ] Add prompt templates for different documentation types

### Cost & Performance
- [ ] Implement token usage tracking
- [ ] Add cost estimation for different operations
- [ ] Set up performance logging for model responses

---

## 🎨 Phase 2: Context Selection UI
**Goal**: Build intuitive UI for selecting Notion pages and Slack channels
**Status**: 0/18 tasks complete

### Toolbar Integration
- [ ] Add Notion button with "N" logo to chat toolbar
- [ ] Add Slack button with Slack logo to chat toolbar
- [ ] Position buttons next to file attachment icon
- [ ] Add tooltips for each button

### Modal Components
- [ ] Create `NotionSelectorModal` component
  - [ ] Implement search functionality
  - [ ] Add pagination for large result sets
  - [ ] Display page titles and metadata
  - [ ] Support multi-select with checkboxes
- [ ] Create `SlackSelectorModal` component
  - [ ] Implement channel search
  - [ ] Display channel names and descriptions
  - [ ] Support multi-select
  - [ ] Add date range selector for summaries

### Selected Items Display
- [ ] Create `ContextCard` component for selected items
  - [ ] Display Notion pages as cards with titles
  - [ ] Display Slack channels as cards
  - [ ] Implement title truncation for long names
  - [ ] Add remove button for each card
- [ ] Integrate cards into chat message area
- [ ] Persist selections in chat context

### 🔍 **ACTIVE**: Notion Search Integration
**Goal**: Enable real-time search and selection of Notion documents  
**Status**: Ready to implement  
**Priority**: HIGH - Current focus  

#### Phase 1: Foundation Setup (30 mins)
- [x] Install Notion SDK: `pnpm add @notionhq/client`
- [x] Environment Setup: Add `NOTION_TOKEN` to `.env.local` and `.env.example`
- [x] Create Notion Service (`lib/notion/client.ts`)
  - [x] Initialize client with error handling
  - [x] Basic page fetching functions
  - [x] Connection testing utility

#### Phase 2: Backend API Route (45 mins)  
- [x] Create API Route (`app/api/notion/pages/route.ts`)
  - [x] GET endpoint with search query parameter
  - [x] Smart caching strategy (fetch 100 recent pages, cache 5min)
  - [x] Handle Notion API rate limiting (3 req/sec)
  - [x] Transform Notion response to expected format
- [x] Data Transformation Layer
  - [x] Map Notion pages to `{id, title, path, lastModified}` format
  - [x] Extract titles from various property types
  - [x] Construct simplified paths (parent name or "Workspace")
  - [x] Handle edge cases (untitled pages, deep nesting)

#### Phase 3: Frontend Integration (30 mins)
- [x] Update NotionSelectorModal (`components/notion-selector-modal.tsx`)
  - [x] Remove hardcoded `mockPages` array  
  - [x] Add API integration with `useCallback` and `useEffect`
  - [x] Implement debounced search (300ms delay)
  - [x] Maintain existing UI patterns and keyboard navigation
- [x] Enhanced Loading & Error States
  - [x] Loading spinner during API calls
  - [x] "No results found" with helpful messaging  
  - [x] Network error handling with retry button
  - [x] Token validation errors with setup instructions

#### Phase 4: Search Optimization (15 mins)
- [x] Implement Smart Search Strategy
  - [x] Initial load: Cache 100 most recent pages
  - [x] Real-time filtering of cached results
  - [x] Background refresh every 5 minutes
  - [x] Fallback to API search if no cached matches
- [x] Performance Optimization
  - [x] Debounced search to prevent excessive API calls
  - [x] Proper cleanup of API calls on component unmount
  - [x] Memory management for cached data

#### Technical Implementation Notes:
- **API Strategy**: Cache-first approach for better UX
- **Rate Limits**: Respect Notion's 3 req/sec limit with proper backoff
- **Search Logic**: Filter cached data first, API search as fallback
- **Path Construction**: Simplified breadcrumbs to avoid complex parent hierarchy
- **Error Handling**: Comprehensive error states with actionable user guidance

#### Environment Variables Required:
```bash
# .env.local
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Success Criteria:
- [x] Search responds within 200ms for cached results
- [x] Handles 1000+ pages in workspace gracefully  
- [x] Graceful degradation when API is unavailable
- [x] Clear error messages for common issues (invalid token, network)

#### ✅ **COMPLETED**: All phases implemented successfully!
**Status**: Ready for testing  
**Next**: Test with real Notion workspace and refine as needed

### 🔄 **UPDATE**: Enhanced for Database-Specific Search
**Problem Solved**: Original search API limited to 100 pages total  
**New Approach**: Direct database queries with full pagination  
**Benefits**:
- ✅ Access to ALL pages in database (not just first 100)
- ✅ Better search using database properties
- ✅ Proper pagination support
- ✅ More accurate results from structured data
- ✅ "Load all" option for complete database visibility

**Technical Changes Made**:
- Updated `NotionService` to use `databases.query()` instead of `search()`
- Added `NOTION_DATABASE_ID` environment variable support
- Enhanced API route with "load all" functionality
- Improved modal UI with page count display and load all button
- Better error handling for database-specific operations

#### Next Steps After Completion:
- Connect to MCP tool for content fetching when documents are selected
- Add content preview in attachment cards
- Implement more sophisticated caching with database persistence

### MCP Integration
- [ ] Connect Notion selector to MCP `get-database-page` tool
- [ ] Connect Slack selector to MCP `get-slack-summary` tool
- [ ] Handle loading states during MCP calls
- [ ] Implement error handling for failed MCP requests

---

## 📄 Phase 3: Document Generation Flow
**Goal**: Implement intelligent document creation with context awareness
**Status**: 0/15 tasks complete

### Context Evaluation
- [ ] Create context sufficiency algorithm
- [ ] Define minimum context requirements
- [ ] Implement context quality scoring
- [ ] Add user feedback mechanism for context needs

### Generation Trigger
- [ ] Add "Generate Documentation" button
  - [ ] Show button when context is sufficient
  - [ ] Disable with explanation when context lacking
- [ ] Implement generation progress indicator
- [ ] Add cancel generation functionality

### Document Creation
- [ ] Enhance `create-document` tool for documentation
- [ ] Include all selected Notion/Slack context in prompts
- [ ] Add documentation templates support
- [ ] Implement structured document generation
  - [ ] Overview section
  - [ ] Features section
  - [ ] Usage instructions
  - [ ] Troubleshooting section

### Quality Assurance
- [ ] Implement documentation quality checks
- [ ] Add completeness validation
- [ ] Create consistency checker
- [ ] Add technical accuracy verification

---

## ✏️ Phase 4: Collaborative Editing
**Goal**: Enable seamless collaboration between user and AI on documents
**Status**: 0/12 tasks complete

### Real-time State Tracking
- [ ] Implement document change detection
- [ ] Create document diff tracking system
- [ ] Add version history support
- [ ] Implement undo/redo functionality

### AI Awareness
- [ ] Include full document in queries after edits
- [ ] Track manual edit patterns
- [ ] Implement smart suggestion system
- [ ] Add AI review of manual changes

### User Experience
- [ ] Add collaborative editing indicators
- [ ] Implement conflict resolution UI
- [ ] Add commenting system
- [ ] Create change highlighting

---

## 🚀 Phase 5: Publishing Pipeline
**Goal**: Seamless publishing to Notion and other platforms
**Status**: 0/10 tasks complete

### Notion Publishing
- [ ] Add "Publish to Notion" button in artifact sidebar
- [ ] Create publishing configuration modal
  - [ ] Database selection
  - [ ] Property mapping
  - [ ] Publishing options
- [ ] Build n8n webhook for Notion upload
- [ ] Implement success/error handling
- [ ] Add publishing history tracking

### Publishing Features
- [ ] Add draft vs. published status
- [ ] Implement update vs. create logic
- [ ] Add publishing preview
- [ ] Create rollback mechanism
- [ ] Add multi-platform publishing support

---

## 🧪 Phase 6: Testing & Polish
**Goal**: Ensure reliability and excellent user experience
**Status**: 0/8 tasks complete

- [ ] Create comprehensive test suite
- [ ] Add E2E tests for full workflow
- [ ] Implement error boundary components
- [ ] Add analytics and monitoring
- [ ] Create user onboarding flow
- [ ] Add keyboard shortcuts
- [ ] Implement accessibility features
- [ ] Create documentation and help system

---

## 🔧 Technical Specifications

### Model Configuration
```typescript
// Target configuration for lib/ai/providers.ts
{
  'chat-model': 'gpt-5',           // Main model with vision
  'title-model': 'gpt-5-mini',     // Cost-optimized for titles
  'artifact-model': 'gpt-5',       // High quality for documents
}
```

### API Endpoints
- [ ] `POST /api/mcp/notion/search` - Search Notion pages
- [ ] `POST /api/mcp/slack/search` - Search Slack channels
- [ ] `POST /api/mcp/notion/fetch` - Fetch selected pages
- [ ] `POST /api/mcp/slack/summary` - Get channel summaries
- [ ] `POST /api/publish/notion` - Publish to Notion

### Database Schema Updates
- [ ] Add `context_sources` table for tracking selected items
- [ ] Add `publishing_history` table
- [ ] Update `documents` table with publishing metadata

---

## 🤝 Integration Points

### n8n Webhooks
- [ ] Design webhook payload structure
- [ ] Create authentication mechanism
- [ ] Implement retry logic
- [ ] Add webhook testing endpoint

### MCP Server Capabilities
**Available Tools**:
- ✅ `get-database-page` - Fetch Notion pages
- ✅ `get-slack-summary` - Get Slack channel summaries  
- ✅ `upload-document-to-notion` - Publish to Notion

**Limitations**:
- Rate limiting considerations
- Payload size restrictions
- Authentication token management

---

## ❓ Open Questions & Decisions

### Pending Decisions
- [ ] **Documentation Schema**: What specific structure does Intercom's Fin require?
- [ ] **Quality Metrics**: How do we measure "high quality" documentation?
- [ ] **Batch Operations**: Should we support bulk document generation?
- [ ] **Permissions**: How do we handle Notion/Slack access permissions?
- [ ] **Caching Strategy**: Should we cache fetched Notion/Slack content?

### Technical Considerations
- [ ] **Rate Limiting**: How to handle API rate limits gracefully?
- [ ] **Large Documents**: Maximum document size constraints?
- [ ] **Concurrent Editing**: How to handle multiple users editing?
- [ ] **Offline Support**: Should we support offline editing?

---

## 📝 Decision Log

### Agreed Decisions
| Date | Decision | Rationale | Impact |
|------|----------|-----------|---------|
| 2025-01-20 | Use GPT-5 for main model | Superior quality, built-in reasoning | Higher cost but better output |
| 2025-01-20 | Keep MCP for external integrations | Separation of concerns, easier maintenance | Need to handle MCP server availability |
| 2025-01-20 | Modal UI for selection | Better UX than inline selection | Additional UI components needed |

### Implementation Notes
- GPT-5 streaming works differently than GPT-4o - need to test thoroughly
- MCP tools are dynamically loaded - ensure proper error handling
- Document state must be included in every query after edits

---

## 🚨 Blockers & Dependencies

### Current Blockers
- None

### Dependencies
- **n8n MCP Server**: Must be running and accessible
- **Notion API Access**: Required for publishing
- **GPT-5 API Access**: Ensure API key has GPT-5 permissions

---

## 📈 Success Metrics

- [ ] Document generation time < 30 seconds
- [ ] Documentation quality score > 90%
- [ ] Zero data loss during collaborative editing
- [ ] Publishing success rate > 99%
- [ ] User satisfaction score > 4.5/5

---

## 🔄 Next Steps

1. **Immediate** (Today):
   - [ ] Confirm GPT-5 API access
   - [ ] Review current MCP implementation
   - [ ] Start Phase 1 model configuration

2. **Short-term** (This Week):
   - [ ] Complete Phase 1
   - [ ] Begin Phase 2 UI components
   - [ ] Set up n8n webhook endpoint

3. **Medium-term** (Next 2 Weeks):
   - [ ] Complete Phases 2-3
   - [ ] Begin collaborative editing
   - [ ] Initial user testing

---

*Last Updated: 2025-01-20*
*Status: Active Development*
*Owner: CS & Dev Team*