
# Fix Resume Upload Not Working

## Root Cause Analysis

The issue is in the PDF text extraction step. When a user selects a PDF file:

1. `handleFileChange` sets the file in state
2. A `useEffect` immediately triggers text extraction using `pdfjs-dist`
3. If extraction **fails**, the code calls `setResumeFile(null)` -- which resets the UI back to the initial "no file" state
4. The user sees the page "return to normal" with no error toast visible (it may flash briefly or be missed)

**Why extraction is likely failing:**
- The PDF.js worker is loaded from `https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js` -- this external CDN URL may be blocked, stale, or incompatible
- The `pdfjs-dist` package installed is version `^2.16.105`, but worker/library version mismatches can cause silent failures
- The error is caught and a toast is shown, but `setResumeFile(null)` immediately clears the file, making the UI snap back so fast the user doesn't notice the error

**Secondary issue:** The Gemini API call in `callGeminiAPI` has `max_tokens: 500` hardcoded, which is too low for the AI enhancer that generates elevator pitches, themes, and explanations. This would cause truncated/invalid responses even if upload succeeds.

## Proposed Changes

### 1. Fix PDF.js Worker Configuration (`src/hooks/resume/useResumeStorage.ts`)

Replace the external CDN worker URL with a more reliable approach:
- Use `pdfjs.GlobalWorkerOptions.workerSrc` pointing to a local worker or a versioned CDN URL that matches the installed package
- Add error handling for worker loading failures

### 2. Improve Error Visibility (`src/pages/Resume.tsx`)

- When text extraction fails, do NOT clear `resumeFile` immediately -- instead, keep the file selected and show a clear error state
- Add a visible error message in the UI (not just a toast) so users know extraction failed
- Allow retry of extraction without re-selecting the file

### 3. Increase Gemini max_tokens (`supabase/functions/resume-analyzer/utils.ts`)

- Change `max_tokens: 500` to `max_tokens: 2000` in `callGeminiAPI` so the AI enhancer, roast generator, and bullet improver have enough token budget for complete responses

### 4. Add console logging for extraction failures (`src/pages/Resume.tsx`)

- Add explicit `console.error` calls before clearing state so the issue is visible in logs for debugging

## Technical Details

### File: `src/hooks/resume/useResumeStorage.ts`
- Update `pdfjs.GlobalWorkerOptions.workerSrc` to use a CDN URL matching the installed version, or use the bundled worker
- Add a try/catch around worker initialization

### File: `src/pages/Resume.tsx` (lines 456-463)
- When PDF extraction fails, keep `resumeFile` in state instead of calling `setResumeFile(null)`
- Set a new `fileError` state to show the error inline
- Show a "Retry Extraction" button

### File: `supabase/functions/resume-analyzer/utils.ts` (line 163)
- Change `max_tokens: 500` to `max_tokens: 2000`

### Edge Function Redeployment
- Redeploy `resume-analyzer` after the max_tokens fix
