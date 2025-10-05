# Codebase Cleanup Recommendations

## Overview
This document outlines potential areas for cleanup based on a comprehensive audit of the codebase.

## 🔴 High Priority - Unused/Dead Code

### 1. **Unused Function in EnrollmentBadge.tsx**
- **File**: `src/components/course/EnrollmentBadge.tsx`
- **Issue**: `handleManageMaterials()` function is defined but never called
- **Line**: 72-74
- **Recommendation**: Remove the unused function
- **Impact**: Low risk, improves code clarity

### 2. **Duplicate Route: /course-list**
- **File**: `src/App.tsx`
- **Issue**: `/course-list` route points to same component as `/courses`
- **Usage**: Only referenced in PageVisibilityContext
- **Recommendation**: Consider removing duplicate route or document why both exist
- **Impact**: Medium - may be for backward compatibility

### 3. **Potentially Redundant: CourseManageMaterials**
- **File**: `src/pages/CourseManageMaterials.tsx`
- **Route**: `/courses/:courseId/manage-materials`
- **Issue**: CourseManagement now has a "Content" tab with CanvasModuleManager
- **Usage**: Route exists but not navigated to from anywhere
- **Recommendation**:
  - If Content tab in CourseManagement covers same functionality, remove this route
  - If different functionality, document the difference
- **Impact**: Medium - verify Content tab provides same features first

### 4. **Potentially Unused: CourseOrganizer**
- **File**: `src/pages/CourseOrganizer.tsx`
- **Route**: `/courses/:courseId/organize`
- **Usage**: Route exists but no navigation links found
- **Recommendation**: Check if this is accessed directly by users or if it's orphaned
- **Impact**: Medium - verify usage before removal

## 🟡 Medium Priority - Potential Redundancy

### 5. **Old Redirect Routes**
- **File**: `src/App.tsx`
- **Routes**:
  - `/course/:courseId` → redirects
  - `/course/:courseId/*` → redirects
- **Issue**: Old `/course/` pattern (singular) redirects to new `/courses/` pattern (plural)
- **Recommendation**: These may be needed for backward compatibility, but document this
- **Impact**: Low - likely needed for old links

### 6. **Multiple Course Detail Routes**
- **Routes**: Various routes point to CourseDetail component:
  - `/courses/:courseId`
  - `/courses/:courseId/modules`
  - `/courses/:courseId/announcements`
  - `/courses/:courseId/people`
- **Recommendation**: Verify this is intentional (likely for tab-based navigation)
- **Impact**: Low - probably intentional design

## 🟢 Low Priority - Code Quality

### 7. **TODO Comments**
Found TODO comments that should be addressed:
- `src/components/course/management/AssignmentManager.tsx:21`: "TODO: Fetch actual submission counts from database"
- `src/components/forum/ThreadList.tsx`: "TODO: Implement mark as read functionality"

### 8. **ABOUTME Comments**
- Many components have ABOUTME comments (good for documentation!)
- Consider if these should be converted to proper JSDoc comments for better IDE support

## 📋 Recommended Cleanup Actions

### Immediate (Safe to do now):
1. ✅ Remove `handleManageMaterials` function from EnrollmentBadge.tsx (unused)
2. ✅ Document why `/course-list` and `/courses` both exist (or remove duplicate)

### Requires Investigation:
3. 🔍 Compare CourseManageMaterials functionality with CourseManagement Content tab
4. 🔍 Check if CourseOrganizer is still being used
5. 🔍 Verify old `/course/` redirect routes are needed for backward compatibility

### Future Improvements:
6. 📝 Address TODO comments
7. 📝 Consider converting ABOUTME to JSDoc format
8. 📝 Run `npm run lint -- --fix` to catch any auto-fixable issues

## Notes

### Files Already Cleaned:
- ✅ CourseEdit.tsx (removed in previous cleanup)
- ✅ Duplicate /edit routes (consolidated to /management)
- ✅ Old navigation patterns (updated to use /management)

### Testing Recommendations:
Before removing any routes or components:
1. Search access logs (if available) to see if routes are being accessed
2. Check if any external links point to these routes
3. Verify with stakeholders if functionality is still needed
4. Create feature flags for gradual deprecation if unsure

---

Generated: 2025-10-05
Audit Scope: Routes, components, navigation patterns, TODO comments
