# Insights Collective Courses Feature - Production Roadmap

**Goal**: Build out the /courses feature to match Kajabi, Udemy, and Canvas quality within the next few weeks.

**Last Updated**: October 5, 2025

---

## Executive Summary

The Insights Collective platform has a **solid foundation** for a comprehensive LMS (Learning Management System). The database schema is robust with Canvas-style content management, advanced grading, quiz question banks, rubrics, and submission tracking. However, several critical features are missing for production readiness, and the frontend UI/UX needs significant polish to compete with Kajabi, Udemy, and Canvas.

### Current Strengths ✅
- **Database**: Canvas-style schema with content_items, comprehensive grading system, question banks, rubrics
- **Backend Services**: Well-structured services (courseCalendarService, canvasContentService, etc.)
- **Components**: 50+ course-related components including gradebook, question banks, rubrics, calendar
- **Routes**: Complete routing structure for all course sections
- **Permission System**: Role-based access control (instructor, student, admin)

### Critical Gaps ❌
- **Student Experience**: Limited student-facing UI, no clear course navigation or progress indicators
- **Video Platform**: No video hosting, tracking, or interactive features
- **Discussion Forums**: Partial implementation, not integrated into course flow
- **Live Sessions**: No webinar/live class functionality
- **Mobile Responsiveness**: Unknown state, likely needs work
- **Notifications**: Limited notification system beyond grade changes
- **Analytics**: Basic analytics exist but not comprehensive student insights
- **User Onboarding**: No guided onboarding for students or instructors

---

## Phase 1: Critical Student Experience (Week 1-2)
**Priority**: MUST HAVE for launch

### 1.1 Enhanced Course Player/Viewer
**Why**: Students need a seamless way to consume course content
- [ ] **Unified Course Player Component**
  - Clean, distraction-free viewing mode
  - Support for all content types: pages, videos, assignments, quizzes
  - Previous/Next navigation between content items
  - Progress auto-save and resume
  - Mobile-responsive design
  - Files: `src/components/course/player/CoursePlayer.tsx`

- [ ] **Module Navigation Sidebar**
  - Collapsible sidebar showing all modules and content
  - Visual progress indicators (checkmarks, percentages)
  - Lock/unlock status for prerequisites
  - Current item highlighted
  - Files: `src/components/course/player/ModuleSidebar.tsx`

- [ ] **Progress Tracking UI**
  - Visual progress bars on course home
  - Module completion badges
  - Overall course progress dashboard
  - Time spent tracking
  - Update existing: `src/components/course/CourseProgressOverview.tsx`

### 1.2 Video Integration & Tracking
**Why**: Core to modern course platforms
- [ ] **Video Player Integration**
  - Integrate with video provider (Vimeo, YouTube, or self-hosted)
  - Custom controls with speed adjustment, captions
  - Resume playback from last position
  - Quality selection
  - Files: `src/components/course/video/VideoPlayer.tsx`

- [ ] **Video Analytics**
  - Track watch time and completion
  - Engagement heatmaps (where students rewatch)
  - Drop-off points
  - Database: `video_analytics` table (needs creation)
  - Files: `src/services/videoAnalyticsService.ts`

- [ ] **Video Content Block**
  - Rich video metadata (transcript, resources)
  - In-video quizzes (optional)
  - Downloadable resources attached to video
  - Update: `src/components/course/content/ContentBlockRenderer.tsx`

### 1.3 Mobile-First Responsive Design
**Why**: 60%+ of students access on mobile
- [ ] **Audit All Course Pages**
  - Test on mobile devices (320px to 768px)
  - Fix layout issues in CourseDetail, CourseModulesList, etc.
  - Ensure all forms work on mobile

- [ ] **Touch-Friendly UI**
  - Larger tap targets (44x44px minimum)
  - Swipe gestures for navigation
  - Bottom navigation for mobile

- [ ] **Progressive Web App (PWA)**
  - Offline content viewing capability
  - Install prompt for mobile users
  - Files: `public/manifest.json`, service worker

---

## Phase 2: Instructor Tools & Content Creation (Week 2-3)
**Priority**: HIGH for instructor satisfaction

### 2.1 Streamlined Course Creation Flow
**Why**: Instructors need an intuitive way to build courses
- [ ] **Course Creation Wizard**
  - Step-by-step wizard (Details → Modules → Content → Settings → Publish)
  - Templates for common course structures
  - Drag-and-drop curriculum builder
  - Files: `src/components/course/creation/CourseCreationWizard.tsx`

- [ ] **Bulk Content Upload**
  - Upload multiple videos at once
  - CSV import for assignments/quizzes
  - Zip file upload with folder structure → auto-create modules
  - Files: `src/components/course/management/BulkUpload.tsx`

- [ ] **Content Duplication**
  - Duplicate modules, lessons, assignments across courses
  - Content library/templates
  - Import from other courses
  - Update: `src/services/canvasContentService.ts`

### 2.2 Enhanced Grading Experience
**Why**: Canvas-level grading workflow is expected
- [ ] **SpeedGrader Interface**
  - Grade submissions without leaving the page
  - Next/Previous student navigation
  - Inline comments and annotations
  - Rubric integration in sidebar
  - Files: `src/components/course/grading/SpeedGrader.tsx`
  - Reference: Canvas SpeedGrader

- [ ] **Bulk Grading Operations**
  - Apply same grade/feedback to multiple students
  - Batch download submissions
  - CSV grade import/export
  - Update: `src/components/course/gradebook/Gradebook.tsx`

- [ ] **Grade Posting Workflow**
  - Muted assignments (grade without posting)
  - Post grades to selected students
  - Notification controls
  - Database: Update `grades` table with `posted` status

### 2.3 Improved Analytics Dashboard
**Why**: Instructors need insights to improve courses
- [ ] **Course Analytics Overview**
  - Student engagement metrics (views, time spent)
  - Assignment/quiz score distributions
  - Completion rates by module
  - At-risk student identification
  - Files: `src/components/course/analytics/CourseInsights.tsx`

- [ ] **Student-Level Analytics**
  - Individual student dashboard
  - Participation tracking
  - Learning pace analysis
  - Files: `src/components/course/analytics/StudentInsights.tsx`

- [ ] **Content Performance**
  - Which modules/videos have highest completion
  - Where students get stuck (drop-off analysis)
  - Assignment difficulty metrics
  - Database: Aggregate from existing progress tables

---

## Phase 3: Communication & Community (Week 3-4)
**Priority**: MEDIUM-HIGH for engagement

### 3.1 Discussion Forums/Boards
**Why**: Critical for student engagement and peer learning
- [ ] **Course Discussion Integration**
  - Forum per course with categories
  - Pinned announcements
  - Q&A vs Discussion thread types
  - Instructor endorsements
  - Files: `src/components/course/discussions/DiscussionBoard.tsx`
  - Database: `discussion_boards`, `discussion_topics`, `discussion_posts` (needs creation)

- [ ] **Inline Discussions**
  - Comment threads on specific content items
  - Assignment-specific discussions
  - Video timestamp comments
  - Update: Content players to include discussion widget

- [ ] **Moderation Tools**
  - Flag inappropriate content
  - Lock threads, delete posts
  - Student vs instructor badges
  - Files: `src/components/course/discussions/ModerationPanel.tsx`

### 3.2 Announcements System
**Why**: Communication is key to active courses
- [ ] **Rich Announcements**
  - WYSIWYG editor for announcements
  - Schedule announcements for future
  - Target specific sections/groups
  - Update: `src/components/course/announcements/` (create new)

- [ ] **Announcement Notifications**
  - Email digest options
  - In-app notifications
  - Push notifications (if PWA)
  - Database: Extend `course_announcements` table

- [ ] **Announcement Analytics**
  - Track read rates
  - Click-through on links
  - Files: `src/services/announcementService.ts`

### 3.3 Enhanced Notification System
**Why**: Keep students engaged and informed
- [ ] **Comprehensive Notification Center**
  - Unified notification feed (all course updates)
  - Mark as read/unread
  - Filter by type (grades, announcements, discussions)
  - Files: `src/components/notifications/NotificationCenter.tsx`

- [ ] **Notification Preferences**
  - Per-course notification settings
  - Email vs in-app preferences
  - Quiet hours
  - Files: `src/pages/NotificationSettings.tsx`

- [ ] **Real-Time Notifications**
  - WebSocket integration for instant updates
  - Badge counts on nav
  - Desktop notifications
  - Files: `src/hooks/useRealtimeNotifications.ts`

---

## Phase 4: Advanced Features (Week 4-5)
**Priority**: MEDIUM for competitive parity

### 4.1 Live Sessions/Webinars
**Why**: Kajabi and others offer live components
- [ ] **Live Session Integration**
  - Zoom/Google Meet integration
  - In-platform live sessions (WebRTC)
  - Scheduled sessions with calendar integration
  - Files: `src/components/course/live/LiveSessionManager.tsx`
  - Database: `live_sessions`, `session_attendance` (needs creation)

- [ ] **Session Recordings**
  - Auto-record and publish to course
  - Attendance tracking
  - Q&A archive
  - Files: `src/components/course/live/SessionRecordings.tsx`

- [ ] **Interactive Features**
  - Live Q&A
  - Polls during session
  - Breakout rooms
  - Requires: WebRTC or third-party service

### 4.2 Certificates & Badges
**Why**: Gamification and credentials increase completion
- [ ] **Enhanced Certificate System**
  - Customizable certificate templates
  - Automated issuance on completion
  - PDF generation with QR codes
  - Update: `src/pages/CourseCertificate.tsx`
  - Files: `src/services/certificateService.ts`

- [ ] **Badge System**
  - Achievement badges (first assignment, all quizzes, etc.)
  - Display on student profiles
  - Shareable badges (social media)
  - Database: `badges`, `student_badges` (needs creation)

- [ ] **Leaderboards** (Optional)
  - Course-level leaderboards
  - Privacy controls (opt-in)
  - Gamification points
  - Files: `src/components/course/gamification/Leaderboard.tsx`

### 4.3 Advanced Quiz Features
**Why**: Question banks exist but need better UI
- [ ] **Improved Quiz Taking Experience**
  - One question at a time mode
  - Timer with warnings
  - Auto-save answers
  - Review mode before submit
  - Update: `src/pages/CanvasQuizTaking.tsx`

- [ ] **Quiz Analytics**
  - Question difficulty analysis
  - Discrimination index
  - Most missed questions
  - Files: `src/components/course/quiz/QuizAnalytics.tsx`

- [ ] **Adaptive Quizzes** (Advanced)
  - Adjust difficulty based on performance
  - Question pool randomization improvements
  - Requires: Algorithm in `src/services/quizService.ts`

---

## Phase 5: Polish & Optimization (Week 5-6)
**Priority**: MEDIUM for launch quality

### 5.1 Performance Optimization
- [ ] **Code Splitting**
  - Lazy load heavy components (Monaco Editor, video player)
  - Route-based splitting (already partially done)
  - Dynamic imports for course content

- [ ] **Database Query Optimization**
  - Add missing indexes on frequently queried fields
  - Optimize N+1 queries in module loading
  - Implement cursor-based pagination
  - Files: Supabase migrations

- [ ] **Caching Strategy**
  - React Query cache tuning
  - CDN for static assets
  - Service worker for offline content

### 5.2 Accessibility (A11y)
- [ ] **WCAG 2.1 AA Compliance**
  - Keyboard navigation throughout
  - Screen reader testing
  - Color contrast fixes
  - ARIA labels

- [ ] **Closed Captions**
  - Support for video captions
  - Auto-generated captions (YouTube API or AI)
  - Multiple language support
  - Database: `video_captions` table (needs creation)

### 5.3 User Onboarding
- [ ] **Student Onboarding**
  - Welcome tour of course interface
  - "How to succeed in this course" guide
  - Platform tutorial videos
  - Files: `src/components/onboarding/StudentCourseOnboarding.tsx`

- [ ] **Instructor Onboarding**
  - Course creation tutorial
  - Best practices guide
  - Templates and examples
  - Files: `src/components/onboarding/InstructorOnboarding.tsx`

---

## Phase 6: Marketplace Features (Week 6+)
**Priority**: LOW for initial launch, HIGH for Udemy parity

### 6.1 Course Marketplace
**Why**: If monetization is planned
- [ ] **Pricing & Payments**
  - Multiple pricing tiers (one-time, subscription, free)
  - Stripe integration
  - Coupon codes and promotions
  - Database: `course_pricing`, `promotions`, `transactions` (needs creation)
  - Files: `src/services/paymentService.ts`

- [ ] **Course Reviews & Ratings**
  - Star ratings (1-5)
  - Written reviews
  - Instructor responses
  - Database: `course_reviews`, `course_ratings` (needs creation)

- [ ] **Course Discovery**
  - Advanced search and filters
  - Recommended courses (ML-based)
  - Category browsing
  - Wishlist functionality (already partially implemented)

### 6.2 Advanced Instructor Tools
- [ ] **Affiliate System**
  - Instructor referral links
  - Commission tracking
  - Files: `src/components/course/affiliate/AffiliateManager.tsx`

- [ ] **Multi-Instructor Courses**
  - Co-teaching support
  - Revenue sharing
  - Database: Extend `course_instructors`

---

## Database Schema Additions Needed

### High Priority
```sql
-- Video Analytics
CREATE TABLE video_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users,
  content_item_id UUID REFERENCES content_items,
  watch_time INTEGER, -- seconds
  completion_percentage INTEGER,
  last_position INTEGER, -- resume point
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discussion System
CREATE TABLE discussion_boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses,
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE discussion_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID REFERENCES discussion_boards,
  user_id UUID REFERENCES auth.users,
  title TEXT,
  pinned BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  type TEXT, -- 'question', 'discussion', 'announcement'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE discussion_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID REFERENCES discussion_topics,
  user_id UUID REFERENCES auth.users,
  content TEXT,
  parent_post_id UUID REFERENCES discussion_posts, -- for threading
  endorsed BOOLEAN DEFAULT FALSE, -- instructor endorsement
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE course_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users,
  course_id UUID REFERENCES courses,
  type TEXT, -- 'announcement', 'grade', 'discussion', 'assignment'
  title TEXT,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Live Sessions
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses,
  title TEXT,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  duration INTEGER, -- minutes
  meeting_url TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE session_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES live_sessions,
  user_id UUID REFERENCES auth.users,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  duration INTEGER -- seconds
);
```

### Medium Priority
```sql
-- Badges & Gamification
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses, -- NULL if platform-wide
  name TEXT,
  description TEXT,
  icon_url TEXT,
  criteria JSONB, -- conditions to earn
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users,
  badge_id UUID REFERENCES badges,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Course Reviews (Marketplace)
CREATE TABLE course_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses,
  user_id UUID REFERENCES auth.users,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  instructor_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Technical Debt & Refactoring

### Code Quality
- [ ] **TypeScript Strict Mode**
  - Enable strict null checks
  - Fix implicit any types
  - Update `tsconfig.json`

- [ ] **Component Consolidation**
  - Merge duplicate components (multiple module managers)
  - Standardize naming conventions
  - Remove deprecated components (old lesson system)

- [ ] **Service Layer Consistency**
  - All Supabase calls through service layer
  - Consistent error handling
  - Type safety throughout

### Testing
- [ ] **Increase Test Coverage**
  - Critical paths: enrollment, submission, grading
  - E2E tests for student flow
  - Integration tests for course creation
  - Target: 70%+ coverage

- [ ] **Visual Regression Testing**
  - Chromatic or Percy integration
  - Catch UI bugs before production

---

## Competitive Analysis: Feature Parity

| Feature | Canvas | Kajabi | Udemy | Insights Collective | Priority |
|---------|--------|--------|-------|---------------------|----------|
| **Content Management** | ✅ | ✅ | ✅ | ✅ (90%) | HIGH - Polish |
| **Video Hosting** | ✅ | ✅ | ✅ | ❌ (Integration needed) | CRITICAL |
| **Assignments & Grading** | ✅ | ⚠️ | ⚠️ | ✅ (85%) | HIGH - UI Polish |
| **Quizzes** | ✅ | ✅ | ✅ | ✅ (80%) | MEDIUM - Features |
| **Discussion Forums** | ✅ | ✅ | ✅ | ❌ (Partial) | HIGH |
| **Live Sessions** | ⚠️ | ✅ | ⚠️ | ❌ | MEDIUM |
| **Certificates** | ✅ | ✅ | ✅ | ⚠️ (Basic) | MEDIUM |
| **Progress Tracking** | ✅ | ✅ | ✅ | ✅ (70%) | HIGH - UI |
| **Mobile App** | ✅ | ✅ | ✅ | ❌ (PWA possible) | MEDIUM |
| **Analytics** | ✅ | ✅ | ✅ | ⚠️ (Basic) | MEDIUM |
| **Notifications** | ✅ | ✅ | ✅ | ⚠️ (Limited) | HIGH |
| **Course Marketplace** | ❌ | ✅ | ✅ | ❌ | LOW (Phase 6) |
| **Rubrics** | ✅ | ❌ | ❌ | ✅ | ✅ Advantage! |
| **Question Banks** | ✅ | ⚠️ | ⚠️ | ✅ | ✅ Advantage! |

**Legend**: ✅ Full Feature | ⚠️ Partial/Limited | ❌ Not Implemented

---

## Recommended 4-Week Sprint Plan

### Week 1: Student Experience Foundation
- Day 1-2: Unified Course Player + Module Sidebar
- Day 3-4: Video Player Integration + Analytics
- Day 5-7: Mobile Responsiveness Audit + Fixes

**Deliverable**: Students can watch courses seamlessly on any device

### Week 2: Instructor Tools & Grading
- Day 8-10: SpeedGrader Interface
- Day 11-12: Course Creation Wizard
- Day 13-14: Bulk Operations (grading, content upload)

**Deliverable**: Instructors can create and grade courses efficiently

### Week 3: Communication & Engagement
- Day 15-17: Discussion Forums Integration
- Day 18-19: Enhanced Announcements + Notifications
- Day 20-21: Real-Time Notification System

**Deliverable**: Active course communities with robust communication

### Week 4: Polish & Launch Prep
- Day 22-23: Performance Optimization
- Day 24-25: User Onboarding Flows
- Day 26-28: Bug fixes, Testing, Documentation

**Deliverable**: Production-ready course platform

---

## Success Metrics

### Student Metrics
- Course completion rate > 60%
- Average session duration > 20 minutes
- Video completion rate > 75%
- Assignment submission rate > 80%

### Instructor Metrics
- Course creation time < 4 hours (first course)
- Grading time < 5 min per submission
- Instructor satisfaction > 4/5 stars

### Platform Metrics
- Page load time < 2 seconds
- Mobile traffic > 40%
- Zero critical bugs
- 95% uptime

---

## Risk Mitigation

### Technical Risks
- **Video hosting costs**: Use YouTube/Vimeo for MVP, migrate later
- **Real-time features**: Start with polling, migrate to WebSockets
- **Mobile performance**: PWA first, native apps later

### Scope Risks
- **Feature creep**: Stick to Phases 1-3 for launch
- **Over-engineering**: MVP first, optimize later
- **Third-party dependencies**: Have fallbacks for integrations

### Resource Risks
- **Team bandwidth**: Prioritize ruthlessly, cut Phase 6 if needed
- **Testing time**: Automated tests + beta user group
- **Documentation**: In-code docs + user guides

---

## Conclusion

**Current State**: The platform has a **strong foundation** (70% complete) with excellent backend architecture.

**Gap to Close**: The remaining 30% is primarily **student-facing UI/UX**, **video integration**, and **communication tools**.

**Realistic Timeline**: With focused effort, Phases 1-3 can be completed in **4 weeks** for a competitive MVP. Phases 4-5 add polish over the following 2 weeks.

**Recommendation**:
1. **Week 1**: Student experience (MUST HAVE)
2. **Week 2**: Instructor tools (MUST HAVE)
3. **Week 3**: Communication (SHOULD HAVE)
4. **Week 4**: Polish + Launch
5. **Weeks 5-6**: Advanced features based on user feedback

**Next Steps**:
1. Prioritize video integration (Day 1)
2. Build unified course player (Day 1-2)
3. Mobile audit (Day 3-5)
4. Iterate with beta users throughout

The platform is **closer than you think** to production-ready. Focus on the student experience first, and the rest will follow. 🚀