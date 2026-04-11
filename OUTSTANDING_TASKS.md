# Outstanding Tasks - Course Feature Roadmap

**Generated**: October 6, 2025
**Based on**: COURSES_ROADMAP.md
**Last Updated**: October 6, 2025 - Added Feature Completion Gap Analysis

---

## 🎯 Feature Completion Gap Analysis (October 6, 2025)

### Video Analytics & Player (95% → 100%)
**Missing 5% for Full Completion:**
- [ ] **Captions/Subtitles Support** - Load and display video captions/subtitles
- [ ] **Quality Selection** - Add video quality selector (720p/1080p/4K)
- [ ] **Keyboard Shortcuts** - Implement spacebar (play/pause), arrow keys (seek), M (mute)
- [ ] **Engagement Heatmap** - Visualize where students rewatch content
- [ ] **Content Block Integration** - Integrate TrackedVideoPlayer into `ContentBlockRenderer.tsx`

**Files to Update:**
- `src/components/course/video/TrackedVideoPlayer.tsx` - Add keyboard shortcuts, captions
- `src/components/course/content/ContentBlockRenderer.tsx` - Integrate video player

---

### Student Analytics Dashboard (95% → 100%)
**Missing 5% for Full Completion:**
- [ ] **Predictive Analytics** - AI/ML algorithm to identify at-risk students
- [ ] **Export Functionality** - Export analytics to PDF/CSV
- [ ] **Comparison to Class Average** - Show peer comparison metrics
- [ ] **Goal Setting & Tracking** - Allow students to set learning goals
- [ ] **Email Reports** - Automated weekly/monthly analytics emails

**Files to Create/Update:**
- `src/services/predictiveAnalyticsService.ts` - At-risk student detection
- `src/utils/exportToPDF.ts` - PDF export functionality
- `src/components/course/analytics/StudentInsightsDashboard.tsx` - Add export button, goals UI

---

### Inline Discussions (90% → 100%)
**Missing 10% for Full Completion:**
- [ ] **Rich Text Editor** - Replace plain textarea with WYSIWYG (bold, italic, code, links)
- [ ] **File Attachments** - Allow image/file uploads in comments
- [ ] **@Mentions** - User tagging with autocomplete
- [ ] **Notifications** - Alert users when someone replies to their comment
- [ ] **Search Discussions** - Full-text search within discussions
- [ ] **Sort Options** - Sort by popular, recent, endorsed, oldest
- [ ] **Best Answer** - Mark answer as "best" (Stack Overflow style)
- [ ] **Reaction Emojis** - Add 👍 ❤️ 😂 🎉 reactions beyond upvotes

**Files to Update:**
- `src/components/course/discussions/InlineDiscussionWidget.tsx` - Add rich text, sorting, reactions
- `src/services/contentDiscussionService.ts` - Add search, attachment methods
- `supabase/migrations/` - New migration for attachments, reactions tables

**Recommended Libraries:**
- Rich Text: `@tiptap/react` or `react-quill`
- Mentions: `@tiptap/extension-mention`
- File Upload: Already have `FileUploadZone.tsx`

---

## 🚀 Integration Tasks (High Priority)

### Wire New Components into Existing Pages
- [ ] **Add TrackedVideoPlayer to CanvasModuleDetail** - Replace video embeds with tracked player
- [ ] **Add InlineDiscussionWidget to Content Pages** - Embed on pages, videos, assignments
- [ ] **Add StudentInsights Route** - Add to App.tsx routing
- [ ] **Link to Student Dashboard** - Add "View Analytics" button in course navigation
- [ ] **Migration Deployment** - Run `20251006_video_analytics_and_discussions.sql` in Supabase

**Files to Update:**
- `src/App.tsx` - Add StudentInsights route
- `src/pages/CanvasModuleDetail.tsx` - Integrate TrackedVideoPlayer and InlineDiscussionWidget
- `src/components/course/CourseSidebar.tsx` - Add analytics link

---

## ✅ Recently Completed (Oct 5-6, 2025)

### Phase 1: Database Schema ✅
- [x] Created `course_difficulty` ENUM type (beginner, intermediate, advanced)
- [x] Added `difficulty_level` column to courses table
- [x] Added `estimated_hours` column to courses table
- [x] Implemented automated calculation functions
- [x] Created database triggers for auto-updates
- [x] Added performance indexes
- [x] Migrated all existing course data

### Phase 2: UI/UX Enhancements ✅
- [x] Difficulty badges on CourseCard component
- [x] Estimated hours display with Clock icon
- [x] Difficulty filtering in CourseList
- [x] Advanced sorting (difficulty, hours, title, date)
- [x] Mobile-responsive design (320px - 2560px)
- [x] Accessibility compliance (WCAG 2.1 AA)
- [x] Dark mode support
- [x] TypeScript type updates

---

## 🔴 Critical Priority (Week 2)

### Video Platform Integration
**Status**: ❌ Not Started
**Priority**: CRITICAL
**Estimated Time**: 4-5 days

**Tasks**:
- [ ] Choose video provider (Vimeo, YouTube, or self-hosted)
- [ ] Implement video player component with custom controls
- [ ] Add resume playback from last position
- [ ] Track watch time and completion percentage
- [ ] Create `video_analytics` database table
- [ ] Implement video analytics service
- [ ] Add in-video resources/attachments
- [ ] Support for captions/subtitles

**Files to Create/Modify**:
- `src/components/course/video/VideoPlayer.tsx` (NEW)
- `src/services/videoAnalyticsService.ts` (NEW)
- `supabase/migrations/[timestamp]_add_video_analytics.sql` (NEW)
- `src/components/course/content/ContentBlockRenderer.tsx` (UPDATE)

---

## 🟠 High Priority (Week 3)

### 1. Course-Specific Discussion Forums
**Status**: ⚠️ Partial (general forums exist)
**Priority**: HIGH
**Estimated Time**: 3-4 days

**Tasks**:
- [ ] Integrate existing forum system with courses
- [ ] Add discussion boards per course
- [ ] Implement inline discussions on content items
- [ ] Add assignment-specific discussions
- [ ] Video timestamp comments
- [ ] Instructor endorsements

**Files to Create/Modify**:
- `src/components/course/discussions/CourseDiscussionBoard.tsx` (NEW)
- `src/components/course/discussions/InlineDiscussion.tsx` (NEW)
- `supabase/migrations/[timestamp]_add_course_discussions.sql` (NEW)

### 2. Enhanced Notification System
**Status**: ⚠️ Limited
**Priority**: HIGH
**Estimated Time**: 3-4 days

**Tasks**:
- [ ] Create unified notification center
- [ ] Implement real-time notifications (WebSocket)
- [ ] Add per-course notification preferences
- [ ] Email vs in-app preferences
- [ ] Badge counts on navigation
- [ ] Desktop notifications (if PWA)

**Files to Create/Modify**:
- `src/components/notifications/NotificationCenter.tsx` (NEW)
- `src/pages/NotificationSettings.tsx` (NEW)
- `src/hooks/useRealtimeNotifications.ts` (NEW)
- `supabase/migrations/[timestamp]_add_course_notifications.sql` (NEW)

### 3. Manual Course Metadata Override
**Status**: ❌ Not Started
**Priority**: MEDIUM-HIGH
**Estimated Time**: 2 days

**Tasks**:
- [ ] Add manual difficulty override UI in CourseEditor
- [ ] Add manual hours override UI in CourseEditor
- [ ] Track manual vs automated in database
- [ ] Show automated estimate for reference
- [ ] Input validation

**Files to Modify**:
- `src/components/course/management/CourseEditor.tsx`
- `src/types/course.ts`

---

## 🟡 Medium Priority (Week 4)

### 1. PWA (Progressive Web App) Support
**Status**: ❌ Not Started
**Priority**: MEDIUM
**Estimated Time**: 3-4 days

**Tasks**:
- [ ] Create `manifest.json` for PWA
- [ ] Implement service worker for offline content
- [ ] Add install prompt for mobile users
- [ ] Cache course content for offline viewing
- [ ] Sync progress when back online

**Files to Create/Modify**:
- `public/manifest.json` (NEW)
- `public/service-worker.js` (NEW)
- `src/hooks/usePWA.ts` (NEW)

### 2. Student-Level Analytics Dashboard
**Status**: ⚠️ Partial
**Priority**: MEDIUM
**Estimated Time**: 2-3 days

**Tasks**:
- [ ] Create individual student analytics dashboard
- [ ] Track participation and engagement
- [ ] Learning pace analysis
- [ ] At-risk student identification
- [ ] Progress predictions

**Files to Create/Modify**:
- `src/components/course/analytics/StudentAnalyticsDashboard.tsx` (NEW)
- `src/services/studentAnalyticsService.ts` (NEW)

### 3. Rich Announcements System
**Status**: ❌ Not Started
**Priority**: MEDIUM
**Estimated Time**: 2 days

**Tasks**:
- [ ] WYSIWYG editor for announcements
- [ ] Schedule announcements for future
- [ ] Target specific sections/groups
- [ ] Track read rates
- [ ] Email digest options

**Files to Create/Modify**:
- `src/components/course/announcements/AnnouncementManager.tsx` (NEW)
- `src/services/announcementService.ts` (NEW)

---

## 🟢 Low Priority (Week 5+)

### 1. Live Sessions/Webinars
**Status**: ❌ Not Started
**Priority**: MEDIUM (if needed)
**Estimated Time**: 5-7 days

**Tasks**:
- [ ] Integrate Zoom/Google Meet
- [ ] Or implement WebRTC live sessions
- [ ] Scheduled sessions with calendar integration
- [ ] Auto-record and publish sessions
- [ ] Attendance tracking
- [ ] Live Q&A and polls

**Files to Create/Modify**:
- `src/components/course/live/LiveSessionManager.tsx` (NEW)
- `src/components/course/live/SessionRecordings.tsx` (NEW)
- `supabase/migrations/[timestamp]_add_live_sessions.sql` (NEW)

### 2. Enhanced Certificate System
**Status**: ⚠️ Basic exists
**Priority**: LOW
**Estimated Time**: 2-3 days

**Tasks**:
- [ ] Customizable certificate templates
- [ ] Automated issuance on completion
- [ ] PDF generation with QR codes
- [ ] Shareable certificates

**Files to Modify**:
- `src/pages/CourseCertificate.tsx`
- `src/services/certificateService.ts` (NEW)

### 3. Badge/Gamification System
**Status**: ❌ Not Started
**Priority**: LOW
**Estimated Time**: 3-4 days

**Tasks**:
- [ ] Create badge system
- [ ] Achievement badges (first assignment, all quizzes, etc.)
- [ ] Display on student profiles
- [ ] Shareable badges (social media)
- [ ] Leaderboards (optional, with privacy controls)

**Files to Create/Modify**:
- `src/components/course/gamification/BadgeManager.tsx` (NEW)
- `src/components/course/gamification/Leaderboard.tsx` (NEW)
- `supabase/migrations/[timestamp]_add_badges.sql` (NEW)

---

## 🔧 Technical Debt & Optimization

### Code Quality
- [ ] Enable TypeScript strict mode
- [ ] Fix implicit any types
- [ ] Consolidate duplicate components
- [ ] Standardize naming conventions
- [ ] Remove deprecated components (old lesson system)

### Testing
- [ ] Increase test coverage to 70%+
- [ ] E2E tests for student flow
- [ ] Integration tests for course creation
- [ ] Visual regression testing (Chromatic/Percy)

### Performance
- [ ] Code splitting (lazy load Monaco, video player)
- [ ] Database query optimization (add missing indexes)
- [ ] React Query cache tuning
- [ ] CDN for static assets

---

## 📊 Database Schema Additions Needed

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

-- Course-Specific Discussions
CREATE TABLE course_discussion_boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses,
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Notifications
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
```

### Medium Priority
```sql
-- Live Sessions
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses,
  title TEXT,
  scheduled_at TIMESTAMPTZ,
  duration INTEGER, -- minutes
  meeting_url TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badges
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses, -- NULL if platform-wide
  name TEXT,
  description TEXT,
  icon_url TEXT,
  criteria JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🎯 Recommended Action Plan

### This Week (Week 2)
1. **Start video player integration** (CRITICAL)
   - Choose provider (Vimeo recommended for privacy/control)
   - Implement basic player component
   - Add analytics tracking

### Next Week (Week 3)
2. **Course-specific discussions** (HIGH)
   - Integrate existing forum system
   - Add inline discussions

3. **Notification system** (HIGH)
   - Build notification center
   - Add real-time updates

4. **Manual metadata override** (MEDIUM)
   - UI for instructor overrides

### Week 4 (Polish)
5. **PWA support** (MEDIUM)
   - Offline content
   - Install prompt

6. **Bug fixes and testing**
   - E2E tests
   - Performance optimization

### Week 5+ (Nice to Have)
7. **Live sessions** (if needed)
8. **Enhanced certificates**
9. **Badges/gamification**

---

## 📝 Notes

- Phase 1 & 2 are complete (90% of core functionality)
- Video integration is the most critical missing piece
- Discussion forums exist but need course-specific integration
- Platform is production-ready for MVP except video features
- Focus on video (Week 2), then communications (Week 3)

**Last Updated**: October 6, 2025
