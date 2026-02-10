
# Add Context-Aware AI Endpoint Logging

## Problem
Currently, `utils.ts` logs `"Successfully used GEMINI endpoint"` but there's no indication of **which analysis step** triggered the call (e.g., was it the elevator pitch enhancer, the bullet improver, or the career action plan?). This makes it hard to monitor which providers handle which tasks.

## Solution
Add an optional `label` parameter to `callLLMAPI` and `callLLMWithRetry` that gets included in all log messages for that call.

## Changes

### File: `supabase/functions/resume-analyzer/utils.ts`

1. Add optional `label` parameter to `callLLMAPI(system, user, label?)`:
   - Line 296: Log becomes `[${label}] Prompt uses ${n} tokens`
   - Line 330: Log becomes `[${label}] Successfully used ${endpoint} endpoint`
   - Line 334: Error log becomes `[${label}] ${endpoint} API call failed:`
   - Default label to `"LLM"` if not provided

2. Add optional `label` parameter to `callLLMWithRetry(system, user, attempt, maxAttempts, label?)`:
   - Pass it through to `callLLMAPI`
   - Line 355: Log becomes `[${label}] Attempt ${attempt} failed, retrying in ${delay}ms`

### File: `supabase/functions/resume-analyzer/aiEnhancer.ts`

3. Pass label `"AI_ENHANCER"` when calling `callLLMWithRetry` from `enhanceWithGroq`

### File: `supabase/functions/resume-analyzer/bulletImprover.ts`

4. Pass label `"BULLET_IMPROVER"` when calling `callLLMWithRetry` from bullet improvement logic

### File: `supabase/functions/resume-analyzer/bulletSuggestions.ts`

5. Pass label `"THEME_GENERATOR"` when calling `callLLMWithRetry` from `generateThemes`

### File: `supabase/functions/resume-analyzer/index.ts`

6. Any direct `callLLMWithRetry` calls in the main handler get label `"RESUME_ANALYZER"`

---

## Result

Logs will look like:
```
[AI_ENHANCER] Prompt uses 842 tokens
[AI_ENHANCER] Successfully used GEMINI endpoint
[BULLET_IMPROVER] Prompt uses 320 tokens
[BULLET_IMPROVER] GEMINI API call failed: ...
[BULLET_IMPROVER] Successfully used GROQ endpoint
```

This makes it clear at a glance which analysis step used which provider, and where failures occur.
