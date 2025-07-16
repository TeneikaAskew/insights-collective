# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands
```bash
npm install # Install dependencies (including Vite)
npm install vite --save-dev # If you still get the error, install Vite directly:


**Development**
```bash
npm run dev       # Start development server on http://localhost:8080
npm run build     # Production build with Vite
npm run build:dev # Development build with Vite
npm run preview   # Preview production build locally
npm run lint      # Run ESLint for code quality checks
```

**Testing**
```bash
npm run test          # Run all tests in watch mode
npm run test:ui       # Run tests with Vitest UI
npm run test:coverage # Run tests with coverage report
```

**Supabase Local Development** (if needed)
```bash
supabase start    # Start local Supabase instance
supabase db push  # Push migrations to local database
supabase functions serve [function-name] # Test Edge Functions locally
```

## High-Level Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, TailwindCSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Edge Functions with Deno)
- **State Management**: React Context API + TanStack Query (React Query)
- **Routing**: React Router v6
- **AI Integration**: Together AI API for assistant responses

### Application Structure

**Provider Hierarchy**
```
QueryClientProvider (TanStack Query)
└── Router (React Router)
    └── AuthProvider (Authentication state)
        └── PageVisibilityProvider (Access control)
            └── OnboardingProvider (User onboarding)
                └── Application Routes
```

### Key Architectural Patterns

1. **Feature-Based Component Organization**
   - Components grouped by domain: `/components/course/`, `/components/portfolio/`, `/components/admin/`
   - Shared UI components in `/components/ui/` (shadcn/ui)
   - Each feature may have its own types, utils, and sub-components

2. **Service Layer Pattern**
   - API calls abstracted in `/services/` directory
   - Services handle Supabase queries, error handling, and data transformation
   - Example: `blogService.ts`, `conversationService.ts`, `quizService.ts`

3. **Custom Hooks for Business Logic**
   - Extensive hook usage in `/hooks/` for encapsulating feature logic
   - Hooks use React Query for server state management
   - Pattern: `use[Feature]` returns data, loading states, and mutations

4. **Type Safety**
   - TypeScript throughout with generated Supabase types
   - Types organized in `/types/` directory
   - Note: TypeScript is configured with relaxed rules (no strict null checks, implicit any allowed)

### Core Application Flows

1. **Authentication Flow**
   - Supabase Auth with session persistence in localStorage
   - Role-based access: user, instructor, admin
   - Social auth support (Google, GitHub, Twitter)
   - Protected routes redirect to login, then back to intended destination

2. **Course System**
   - Hierarchical structure: Courses → Modules → Lessons
   - Instructor permissions for course management
   - Student enrollment and progress tracking
   - Content blocks system for flexible lesson content

3. **AI Assistant System**
   - Multiple specialized assistants defined in `/data/assistantData.ts`
   - Chat interface with message history persistence
   - Structured response parsing for career reports
   - Integration through Supabase Edge Functions

4. **Portfolio System**
   - Custom portfolio pages with unique URLs
   - Multiple layout templates (Classic, Grid, Hero, etc.)
   - Public viewing without authentication
   - Project showcase and skill tracking

### Important Contexts

- **AuthContext**: User session, roles, login/logout functionality
- **OnboardingContext**: First-time user guidance and tours
- **PageVisibilityContext**: Page-level access control and user presence tracking

### Supabase Edge Functions

Key functions in `/supabase/functions/`:
- `assistant-ai`: Handles AI assistant chat interactions
- `resume-analyzer`: Analyzes and scores resume content
- `together-ai`: Integration with Together AI API
- `generate-career-action-plan`: Creates structured career guidance

### Path Aliases

The project uses `@/` as an alias for `./src/`:
```typescript
import { Button } from "@/components/ui/button"
// Resolves to: ./src/components/ui/button
```

### Key Dependencies

- **UI Framework**: React + shadcn/ui components
- **Styling**: TailwindCSS with custom animations
- **Forms**: react-hook-form with zod validation
- **Rich Text**: Monaco Editor for code editing
- **Charts**: Recharts for data visualization
- **File Handling**: react-dropzone for uploads
- **Date Handling**: date-fns
- **Icons**: lucide-react + react-icons

### Development Notes

1. The project is a Lovable.dev application (AI-assisted development platform)
2. Component tagging is enabled in development mode for Lovable integration
3. ESLint is configured but with relaxed rules (unused vars allowed)
4. Vitest is configured for unit testing with React Testing Library
5. The application requires Supabase environment variables to function properly

### Testing Architecture

**Test Organization**
- Unit tests are colocated with source files in `__tests__` directories
- Test utilities and mocks are in `/src/test/`
- Coverage reports exclude test files, config files, and main.tsx

**Test Stack**
- **Framework**: Vitest (Vite-native test runner)
- **React Testing**: @testing-library/react for component testing
- **Mocking**: Vitest vi.mock() and custom Supabase mocks
- **Coverage**: Vitest with v8 provider

**Key Test Patterns**
1. **Component Tests**: Use custom render function with all providers
2. **Hook Tests**: Use renderHook with proper wrappers
3. **Service Tests**: Mock Supabase client responses
4. **Authentication Tests**: Mock auth states and user profiles

**Running Tests**
```bash
# Run specific test file
npm run test src/components/auth/__tests__/Login.test.tsx

# Run tests matching pattern
npm run test -- --grep "authentication"

# Run tests in CI mode (no watch)
npm run test -- --run
```