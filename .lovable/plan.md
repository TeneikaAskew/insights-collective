
# Fix Resume Analyzer: Rate Limits, Score Rounding, and Theme Extraction

## Summary

Based on your research, the free Together.ai models (`Llama-3.3-70B-Instruct-Turbo-Free` and `DeepSeek-R1-Distill-Llama-70B-free`) are still available but with a very tight rate limit of **0.6 RPM** (1 request every ~100 seconds). The current code only waits 10 seconds between calls, causing rate limit failures. Combined with the unrounded score and missing theme extraction, there are 3 issues to fix.

---

## Issue 1: Rate Limit Too Aggressive (Root Cause of 400 Errors)

The `DELAY_MS` for TOGETHER endpoints is set to `10000` (10 seconds), but the free tier allows only 0.6 RPM = **1 request per 100 seconds**. This means most Together.ai calls will hit rate limits and fail.

Additionally, `callTOGETHERAPI2` checks and tracks against the `TOGETHER` endpoint status instead of `TOGETHER2`, meaning both functions share the same rate limiter and failure counter -- so a failure on TOGETHER1 incorrectly disables TOGETHER2.

**Fix in `supabase/functions/resume-analyzer/utils.ts`:**
- Increase `TOGETHER.DELAY_MS` from `10000` to `110000` (110 seconds, safely under 0.6 RPM)
- Increase `TOGETHER2.DELAY_MS` from `10000` to `110000` 
- Fix `callTOGETHERAPI2` to use `TOGETHER2` for its `canUseEndpoint`, `enforceRateLimit`, and `handleApiResponse` calls instead of `TOGETHER`
- Update the queue delay from `10000` to `110000` to match

---

## Issue 2: Score Percentage Not Rounded

The `resume_percent` of `79.7388888888889` is displayed raw.

**Fix in `supabase/functions/resume-analyzer/index.ts` (~line 1061):**
```typescript
resume_percent: Math.round(percent * 100) / 100,
```

**Fix in `src/components/resume/OverallScoreCard.tsx` (line 144):**
```typescript
<span className="text-xs text-muted-foreground">
  {Number(resumePercent).toFixed(2)}%
</span>
```

**Fix in `src/components/resume/ResumeChat.tsx` (lines 304, 339):**
```typescript
${Number(resumeAnalysis.resume_percent).toFixed(2)}%
```

---

## Issue 3: Theme Extraction Missing "Improvement Theme N:" Format

The AI returns themes formatted as:
```
Improvement Theme 1: Add concrete performance metrics...
Improvement Theme 2: Revise weaker bullets...
Improvement Theme 3: Enhance ATS optimization...
```

But no regex pattern in `aiEnhancer.ts` matches this "Improvement Theme N:" format.

**Fix in `supabase/functions/resume-analyzer/aiEnhancer.ts`:**

Add a new regex pattern to the `themePatterns` array:
```typescript
/Improvement Theme \d+:\s*(.*?)(?=\nImprovement Theme \d+:|\nGrade|The resume grade|$)/gi
```

Also add a dedicated fallback after the existing fallbacks (after line 377) that scans for lines starting with "Improvement Theme":
```typescript
if (extractedContent.themes.length === 0) {
  const improvementThemeRegex = /Improvement Theme \d+:\s*(.*)/gi;
  let match;
  const themes = [];
  while ((match = improvementThemeRegex.exec(text)) !== null) {
    if (match[1].trim().length > 10) {
      themes.push(match[1].trim());
    }
  }
  if (themes.length > 0) {
    extractedContent.themes = themes;
  }
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/resume-analyzer/utils.ts` | Increase TOGETHER delay to 110s, fix TOGETHER2 endpoint tracking, update queue delay |
| `supabase/functions/resume-analyzer/index.ts` | Round `resume_percent` to 2 decimal places |
| `supabase/functions/resume-analyzer/aiEnhancer.ts` | Add "Improvement Theme N:" regex pattern and fallback |
| `src/components/resume/OverallScoreCard.tsx` | Display score with `.toFixed(2)` |
| `src/components/resume/ResumeChat.tsx` | Display score with `.toFixed(2)` in welcome messages |

**No model name changes needed** -- the free model identifiers are confirmed correct. The failures were caused by rate limiting, not model deprecation.

---

## Technical Detail: Rate Limit Math

| Tier | RPM | Min delay between calls |
|------|-----|------------------------|
| Free (no card) | 0.6 | 100 seconds |
| Free (with card) | 3.0 | 20 seconds |
| Current code | ~6.0 | 10 seconds |

The 110-second delay provides a safety margin for the worst case (no credit card). If you have a credit card on file with Together.ai, this could be reduced to ~25 seconds.
