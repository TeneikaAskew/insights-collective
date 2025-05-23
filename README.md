# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/6429aca1-fa6f-43b9-a01e-47aa8c8338eb

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/6429aca1-fa6f-43b9-a01e-47aa8c8338eb) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/6429aca1-fa6f-43b9-a01e-47aa8c8338eb) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes it is!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
📘 Lovable Project - Developer Onboarding Guide

Welcome to the Lovable.dev project! This guide is designed to get new developers up and running quickly by offering a thorough understanding of the codebase, how to set up the project locally, and how the pieces fit together.


---

1. 🌎 Project Summary

Lovable is an AI-driven career development platform that provides:

Personalized career guidance through chat-based assistants

AI-powered resume feedback and scoring

Custom surveys and program forms

Career exploration tools (quizzes, content, role descriptions)

Admin dashboards for managing users, content, and analytics


Live: lovable.dev


---

2. 🌐 Tech Stack

Layer	Tools

Frontend	React + TypeScript, TailwindCSS, Vite
Backend	Supabase (PostgreSQL, Edge Functions - Deno)
Runtime	Bun, Node.js
Deployment	Supabase, GitHub Actions



---

3. 🚀 Getting Started Locally

Prerequisites

Node.js (recommend using nvm)

Bun (for lockfile and builds)

Supabase CLI (optional, for local functions)


Setup

# 1. Clone the repo
$ git clone https://github.com/your-org/insights-collective.git
$ cd insights-collective

# 2. Install dependencies
$ npm install

# 3. Run the dev server
$ npm run dev

# App should now be running on http://localhost:3000

Supabase Config (if needed)

If running locally:

# Start Supabase
$ supabase start

# Push migrations
$ supabase db push


---

4. 📂 Folder Guide

Below is a high-level overview of each major folder, along with a 1–2 sentence summary to guide your exploration and development efforts.

src/

Contains all core frontend application code including UI components, pages, hooks, and utilities; it's the main hub for client-side logic and layout.

Key Folders:

components/ – Reusable and feature-specific React components for the user interface, organized by feature domain for modularity.

pages/ – Defines route-level components, mapping to URL paths like /survey or /admin, serving as entry points for major app views.

hooks/ – Custom React hooks for shared logic across components (e.g., state management, API interactions).

data/ – Stores static JSON or TypeScript files used to power quizzes, forms, and other pre-defined content.

services/ – Contains API interaction logic and external service wrappers, encapsulating fetch and mutation calls.

lib/ – Utility scripts and mock data, supporting core functions like data parsing, token handling, or time formatting.

contexts/ – Sets up React context providers to manage global state like auth, theme, or assistant state across the app.

types/ – Shared TypeScript interfaces and types to ensure consistent typing throughout the app.

utils/ – Utility functions that assist with routing, storage, and general helper logic.


supabase/

Contains backend logic and infrastructure including Deno-based Edge Functions for AI tasks and SQL migrations for database setup.

functions/ – Backend logic for features like resume parsing and chat assistant message handling, written in Deno.

migrations/ – SQL files used to initialize and evolve the Supabase PostgreSQL schema over time.


src/

Main app logic lives here.

Key Folders:

components/ - Reusable UI elements (divided by feature)

pages/ - Route-level React components (e.g., survey forms, admin dashboards)

hooks/ - Custom React hooks

data/ - Static data files used in quizzes, surveys, etc.

services/ - Encapsulated API calls and logic

lib/ - Utilities and mock data

contexts/ - React context providers

types/ - Global TypeScript types

utils/ - Helper functions for routing, storage, etc.


supabase/

Contains all Edge Functions and DB migrations.

functions/ - Deno functions for AI logic, message generation, resume parsing

migrations/ - SQL files to initialize and update DB


---

## Pages and Paths

This section lists all the application pages, their paths, and a brief description for each.

**Public Routes:**
*   `/`: Index page - The main landing page of the application.
*   `/login`: Login page - Allows users to log into their accounts.
*   `/register`: Register page - Allows new users to create an account.
*   `/blog`: Blog list page - Displays a list of all blog posts.
*   `/blog/:postId`: Individual blog post page - Displays a single blog post. The `:postId` is dynamic.
*   `/portfolio/:customUrl`: Public portfolio view page - Displays a user's public portfolio. The `:customUrl` is dynamic.

**Protected Routes (require authentication):**
*   `/dashboard`: User dashboard - The main dashboard for logged-in users.
*   `/profile`: User profile page - Allows users to view and edit their profile.
*   `/courses`: Course list page - Displays a list of available courses.
*   `/course/:courseId`: Course detail page - Displays details for a specific course. The `:courseId` is dynamic.
*   `/module/:moduleId`: Module detail page - Displays details for a specific course module. The `:moduleId` is dynamic.
*   `/career-pathway`: Career pathway page - Helps users explore and plan their career paths.
*   `/resources`: Resources page - Provides access to various learning and career resources.
*   `/resume`: Resume page - Tools and features for resume building and analysis.
*   `/interview-prep`: Interview preparation landing page - Central hub for interview preparation tools.
*   `/interview-prep/job-description`: Job description analysis page - Tool to analyze job descriptions for interview prep.
*   `/interview-prep/star-practice`: STAR method practice page - Helps users practice the STAR method for interviews.
*   `/interview-prep/code-practice`: Coding practice page for interview prep - Platform for practicing coding interview questions.
*   `/interview-prep/mock-interviews`: Mock interviews listing page - Lists available mock interview sessions.
*   `/interview-prep/mock-interview-room/:sessionId`: Mock interview room page - Virtual room for conducting mock interviews. The `:sessionId` is dynamic.
*   `/code-practice`: General code practice page - A general platform for practicing coding.
*   `/events`: Events page - Lists upcoming events and workshops.
*   `/messages`: User messages page - Interface for user-to-user messaging.
*   `/forums`: Forum list page - Displays a list of discussion forums.
*   `/forums/:forumId`: Forum detail page - Displays a specific forum thread or discussion. The `:forumId` is dynamic.
*   `/calendar`: Calendar page - Displays an event calendar.
*   `/assistants`: Assistants list page - Lists available AI assistants.
*   `/assistant/:assistantId`: Specific assistant interface page - Interface for interacting with a particular AI assistant. The `:assistantId` is dynamic.
*   `/career-agent`: Career agent page - AI-powered agent for career advice and planning.
*   `/portfolio-explorer`: Portfolio explorer page - Allows users to explore and discover portfolios.
*   `/portfolio-editor/:pageId`: Portfolio editor page - Allows users to create and edit their portfolio pages. The `:pageId` is dynamic.

**Admin Routes (require admin privileges):**
*   `/admin`: Admin dashboard - Main dashboard for administrators.
*   `/admin/users`: Admin user management page - Manage user accounts.
*   `/admin/courses`: Admin course management page - Manage courses and their content.
*   `/admin/events`: Admin event management page - Manage events and registrations.
*   `/admin/blog-posts`: Admin blog post management page - Manage blog posts.
*   `/admin/resources`: Admin resource management page - Manage shared resources.
*   `/admin/forms`: Admin forms management page - Manage forms and surveys.
*   `/admin/activity`: Admin activity log page - View site activity logs.
*   `/admin/certificates`: Admin certificates management page - Manage user certificates.
*   `/admin/enrollments`: Admin enrollments management page - Manage course enrollments.
*   `/admin/course/:courseId/edit`: Admin course editing page - Edit details of a specific course. The `:courseId` is dynamic.
*   `/admin/page-visibility`: Admin page visibility settings page - Control visibility of different pages/features.

**Other Routes:**
*   `*`: Not Found page - Displayed when a requested path does not match any defined route.

---

5. 🔄 Workflow & Conventions

Git Branching

main is stable and production-ready

Use feature/your-branch-name for development


Code Style

TypeScript + strict mode

Tailwind for all UI styling

Named exports preferred

Directory-based component splitting (1 folder per complex component)


Component Structure Example

src/components/resume/
  BulletPointChart.tsx      # Data chart
  BulletExtractor.ts        # Resume parsing logic
  BulletSuggestions.ts      # AI recommendations


---

6. 🤖 Key Features

Chat Assistants

Located in src/components/assistants/

Uses Supabase functions for message generation and parsing


Resume Analysis

Features natural language parsing and bullet scoring

Powered by supabase/functions/resume-analyzer/


Survey Builder

WYSIWYG-style form builder in components/forms/builder/

Editable and trackable by admins


Career Path Quiz

Data-driven quiz in data/careerQuizData.ts

Results match users to pre-defined personas



---

7. 🔧 Deployment

Auto-deployed via GitHub Actions to Supabase. Manual deployment:

$ supabase functions deploy resume-analyzer


---

8. ✉️ Need Help?

Start by exploring:

README.md for top-level guidance

components/ for feature UI

supabase/functions/ for backend logic


Or reach out to the team via Slack.


---

Welcome aboard! You're now ready to build with Lovable.dev ✨

