# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Insights Collective is a full-stack educational platform built with React, TypeScript, and Supabase. It provides course management, AI-powered career assistance, portfolio building, and interactive learning experiences for students and instructors.

## Development Commands

### Installation
```bash
npm install              # Install all dependencies
npm install vite --save-dev  # Install Vite if needed
```

### Development
```bash
npm run dev              # Start development server on http://localhost:8080
npm run build            # Production build with Vite
npm run build:dev        # Development build with Vite
npm run preview          # Preview production build locally
npm run lint             # Run ESLint for code quality checks
```

### Testing
```bash
# Run all tests
npm run test             # Run tests in watch mode
npm run test:ui          # Run tests with Vitest UI
npm run test:coverage    # Run tests with coverage report

# Run specific test file
npm run test src/components/auth/__tests__/Login.test.tsx

# Run tests matching pattern
npm run test -- --grep "authentication"

# Run tests in CI mode (no watch)
npm run test -- --run
```

### Supabase Local Development
```bash
supabase start           # Start local Supabase instance
supabase db push         # Push migrations to local database
supabase db reset        # Reset database with migrations
supabase migration new <name>  # Create new migration
supabase functions serve <name> # Test Edge Functions locally
supabase link --project-ref siuqvhscuiycvdrtiqsh
```

## Architecture

### Tech Stack

**Frontend**
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: TailwindCSS with custom animations
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Routing**: React Router v6
- **State Management**: React Context API + TanStack Query (React Query)

**Backend**
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth (supports Google, GitHub, Twitter)
- **Edge Functions**: Deno runtime for serverless functions
- **Storage**: Supabase Storage for file uploads

**AI Integration**
- Together AI API for assistant responses
- Streaming support for real-time AI responses
- Multiple specialized assistants (career, resume, interview prep)

### Application Architecture

#### Provider Hierarchy
```
QueryClientProvider (TanStack Query - Server state)
└── Router (React Router v6)
    └── AuthProvider (Authentication state)
        └── PageVisibilityProvider (Access control)
            └── OnboardingProvider (User onboarding)
                └── Application Routes
```

#### Directory Structure
```
src/
├── components/          # React components (feature-based organization)
│   ├── ui/             # shadcn/ui components (Button, Dialog, etc.)
│   ├── admin/          # Admin-specific components
│   ├── assistants/     # AI assistant chat components
│   ├── course/         # Course management components
│   ├── events/         # Event system components
│   ├── portfolio/      # Portfolio builder components
│   └── resume/         # Resume analysis components
├── contexts/           # React Context providers
├── hooks/              # Custom React hooks
├── services/           # API service layer (Supabase integration)
├── types/              # TypeScript type definitions
├── lib/                # Utility functions and helpers
├── data/               # Static data and configurations
└── pages/              # Top-level route components

supabase/
├── functions/          # Edge Functions (Deno)
└── migrations/         # Database migrations (SQL)
```

### Key Architectural Patterns

#### 1. Feature-Based Component Organization
- Components grouped by domain/feature in `/components/`
- Each feature may have sub-directories: `modals/`, `forms/`, `hooks/`, `__tests__/`
- Shared UI primitives in `/components/ui/` (shadcn/ui)

#### 2. Service Layer Pattern
- All Supabase queries abstracted in `/services/` directory
- Services handle error handling, data transformation, and type safety
- Examples: `blogService.ts`, `conversationService.ts`, `quizService.ts`, `eventService.ts`
- Pattern: Services export typed functions for CRUD operations

#### 3. Custom Hooks for Business Logic
- Hooks in `/hooks/` encapsulate feature-specific logic
- Use TanStack Query (`useQuery`, `useMutation`) for server state
- Pattern: `use[Feature]` returns `{ data, isLoading, error, mutate }`
- Examples: `useEvents`, `useCourseData`, `useEventRegistrations`

#### 4. Type Safety with TypeScript
- Supabase types auto-generated from database schema
- Custom types in `/types/` directory
- Note: TypeScript configured with relaxed rules (no strict null checks, implicit any allowed)

### Core Application Flows

#### 1. Authentication Flow
- **Provider**: Supabase Auth with session persistence (localStorage)
- **Roles**: `user` (default), `instructor`, `admin`
- **Social Auth**: Google, GitHub, Twitter OAuth
- **Protected Routes**: Redirect to login → return to intended destination
- **Profile Creation**: Automatic profile record on signup via database trigger

#### 2. Course System
- **Hierarchy**: Courses → Modules → Lessons → Content Items
- **Content Types**: Text blocks, video embeds, quizzes, assignments, resources
- **Permissions**: Instructors can create/edit courses, students can enroll
- **Progress Tracking**: Lesson completion, quiz scores, assignment submissions
- **Enrollment**: Students enroll in courses, track progress per course

#### 3. AI Assistant System
- **Assistants**: Career advisor, resume analyzer, interview prep, skills assessor
- **Configuration**: Defined in `/data/assistantData.ts`
- **Chat Interface**: Real-time streaming responses via Edge Functions
- **Persistence**: Message history stored in Supabase
- **Structured Parsing**: Extract career reports and action items from AI responses
- **Integration**: Together AI API via Supabase Edge Functions

#### 4. Portfolio System
- **Customization**: Drag-and-drop builder with multiple layout templates
- **Templates**: Classic, Grid, Hero, Minimal, Bold
- **Public Access**: Portfolio pages viewable without authentication
- **URL Structure**: `/portfolio/[username]` for public viewing
- **Content**: Projects, skills, education, experience, custom sections

#### 5. Event System
- **Types**: Workshops, webinars, networking, career fairs
- **Registration**: Event signup with capacity limits
- **Filtering**: By category, date range, registration status
- **Management**: Admin/instructor creation and management

### Important Contexts

#### AuthContext (`src/contexts/AuthContext.tsx`)
- Current user session and profile
- User roles: `user`, `instructor`, `admin`
- Login, logout, signup functionality
- Session persistence and restoration

#### PageVisibilityContext (`src/contexts/PageVisibilityContext.tsx`)
- Page-level access control
- User presence tracking (online/offline status)
- Real-time updates for collaborative features

#### OnboardingContext (`src/contexts/OnboardingContext.tsx`)
- First-time user guidance
- Interactive feature tours
- Onboarding step completion tracking

### Supabase Edge Functions

Located in `/supabase/functions/`:

- **`assistant-ai`**: Main AI assistant chat handler with streaming
- **`resume-analyzer`**: Analyzes resume content and provides scoring
- **`together-ai`**: Direct integration with Together AI API
- **`generate-career-action-plan`**: Creates structured career guidance
- **`openai-image-analysis`**: Image analysis using OpenAI Vision API

### Database Schema Highlights

**Key Tables**:
- `profiles`: User profiles linked to auth.users
- `courses`, `modules`, `lessons`, `content_items`: Course hierarchy
- `enrollments`, `lesson_progress`: Student progress tracking
- `quizzes`, `quiz_submissions`: Assessment system
- `conversations`, `messages`: AI assistant chat history
- `portfolios`, `portfolio_sections`: Portfolio builder data
- `events`, `event_registrations`: Event management
- `blog_posts`, `comments`: Blog system

**Row Level Security (RLS)**:
- All tables have RLS policies enabled
- Policies enforce role-based access (user, instructor, admin)
- Helper functions: `get_user_role()`, `is_instructor()`, `is_admin()`

### Path Aliases

The project uses `@/` as an alias for `./src/`:
```typescript
import { Button } from "@/components/ui/button"
// Resolves to: ./src/components/ui/button
```

### Key Dependencies

**UI & Styling**
- `shadcn/ui`: Radix UI component library
- `tailwindcss`: Utility-first CSS framework
- `lucide-react`: Icon library
- `framer-motion`: Animation library

**Forms & Validation**
- `react-hook-form`: Form state management
- `zod`: Schema validation
- `@hookform/resolvers`: Form validation integration

**Rich Content**
- `@tiptap/react`: Rich text editor
- `@monaco-editor/react`: Code editor
- `react-markdown`: Markdown rendering
- `react-pdf`: PDF viewing

**Data & State**
- `@tanstack/react-query`: Server state management
- `@supabase/supabase-js`: Supabase client
- `date-fns`: Date manipulation
- `lodash`: Utility functions

**Drag & Drop**
- `@dnd-kit/core`: Drag and drop utilities
- `@hello-pangea/dnd`: Drag and drop components

**Testing**
- `vitest`: Test framework
- `@testing-library/react`: Component testing
- `@testing-library/user-event`: User interaction testing
- `jsdom`: DOM implementation for testing
- `msw`: API mocking

### Testing Architecture

#### Test Organization
- Tests colocated in `__tests__/` directories next to source files
- Test utilities and setup in `/src/test/`
- Custom render function with all providers in `/src/test/test-utils.tsx`
- Supabase mocks in `/src/test/supabase-mock.ts`

#### Test Stack
- **Framework**: Vitest (Vite-native, fast)
- **React Testing**: @testing-library/react
- **Mocking**: Vitest `vi.mock()` + Mock Service Worker (MSW)
- **Coverage**: Vitest with v8 provider

#### Test Patterns
1. **Component Tests**:
   - Use custom `render()` with QueryClientProvider + AuthProvider
   - Test user interactions with `@testing-library/user-event`
   - Assert on rendered output and state changes

2. **Hook Tests**:
   - Use `renderHook()` with proper wrapper (QueryClientProvider)
   - Test data fetching, mutations, and state updates
   - Mock Supabase responses

3. **Service Tests**:
   - Mock Supabase client methods
   - Test error handling and data transformation
   - Verify correct query parameters

4. **Integration Tests**:
   - Test full user flows (e.g., login → dashboard → course enrollment)
   - Use MSW to mock API responses
   - Test RLS policy enforcement

#### Running Tests
```bash
# Watch mode (default)
npm run test

# With UI
npm run test:ui

# Coverage report
npm run test:coverage

# Specific file
npm run test src/hooks/__tests__/useAuth.test.tsx

# Pattern matching
npm run test -- --grep "authentication"

# CI mode (no watch)
npm run test -- --run
```

### Development Notes

1. **Lovable.dev Integration**: Project created with Lovable (AI-assisted platform)
2. **Component Tagging**: Enabled in dev mode for Lovable integration
3. **ESLint Configuration**: Relaxed rules (unused vars allowed as warnings)
4. **Environment Variables**: Requires Supabase credentials in `.env.local`
5. **Hot Module Replacement**: Enabled via Vite for fast refresh
6. **TypeScript**: Configured with `"strict": false` for faster development

### Common Issues & Solutions

#### Build Issues
- **Vite not found**: Run `npm install vite --save-dev`
- **TypeScript errors**: Check `tsconfig.json` and ensure types are installed
- **Import path errors**: Verify `@/` alias is configured in `vite.config.ts`

#### Supabase Issues
- **Auth errors**: Check `.env.local` for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **RLS policy errors**: Review policies in Supabase dashboard or migrations
- **Function errors**: Test locally with `supabase functions serve <name>`

#### Testing Issues
- **Provider errors**: Ensure components wrapped with `render()` from test-utils
- **Supabase mock errors**: Verify mocks in `/src/test/supabase-mock.ts`
- **Timeout errors**: Increase timeout or use `vi.setConfig({ testTimeout: 10000 })`

### Performance Considerations

- **Code Splitting**: Use React.lazy() for route-based splitting
- **Query Optimization**: Use TanStack Query's staleTime and cacheTime
- **Image Optimization**: Compress images before upload
- **Bundle Size**: Monitor with `npm run build` and analyze bundle
- **Database Queries**: Use indexes on frequently queried columns
- **Edge Function Performance**: Keep functions lightweight, use caching

## Git Commit Guidelines

- **NO Claude branding**: Do not add Claude Code branding, co-author tags, or generated-by comments to commit messages
- Keep commit messages concise and focused on the actual changes
- Follow conventional commit format when appropriate (e.g., `feat:`, `fix:`, `refactor:`)
- Use present tense ("add feature" not "added feature")
- Reference issue numbers when applicable (e.g., "fix: resolve login bug (#123)")
