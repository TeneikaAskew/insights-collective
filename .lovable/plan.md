
# Replace Together.ai with Gemini 2.5 Flash via Lovable AI Gateway

## Overview

Replace all Together.ai API calls across 8 edge functions with Google Gemini 2.5 Flash, using the **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions`) which is already configured via `LOVABLE_API_KEY`. No new API key is needed.

The Lovable AI Gateway uses the same OpenAI-compatible chat completions format, so the migration is straightforward -- change the URL, the auth header, and the model name.

---

## Changes by File

### 1. `supabase/functions/resume-analyzer/utils.ts`

**The most critical file.** Replace the entire multi-provider fallback system (TOGETHER, TOGETHER2, GROQ, ANWAN) with a single Gemini call via the Lovable AI Gateway.

- Replace `callTOGETHERAPI` and `callTOGETHERAPI2` with a single `callGeminiAPI` function
- Keep GROQ and ANWAN as fallbacks (they still work)
- Reorder preferred endpoints to: `['GEMINI', 'GROQ', 'ANWAN']`
- Replace TOGETHER/TOGETHER2 config entries with a single `GEMINI` entry (low delay since Gemini has generous rate limits)
- Reduce queue delay from 110000 to 2000ms
- New `callGeminiAPI` function:
  - URL: `https://ai.gateway.lovable.dev/v1/chat/completions`
  - Auth: `Bearer ${LOVABLE_API_KEY}`
  - Model: `google/gemini-2.5-flash`

### 2. `supabase/functions/together-ai/index.ts`

The generic Together.ai edge function used by `useTogetherAI` hook.

- Replace `TOGETHER_API_KEY` with `LOVABLE_API_KEY`
- Change fetch URL from `https://api.together.xyz/v1/chat/completions` to `https://ai.gateway.lovable.dev/v1/chat/completions`
- Change default model from `Llama-3.3-70B-Instruct-Turbo-Free` to `google/gemini-2.5-flash`
- Remove the non-LLaMa completions API path (Gemini only supports chat completions)
- Update error messages to reference "Gemini" instead of "Together"

### 3. `supabase/functions/generate-study-guide/index.ts`

- Replace `TOGETHER_API_KEY` with `LOVABLE_API_KEY`
- Change fetch URL to Lovable AI Gateway
- Change model to `google/gemini-2.5-flash`

### 4. `supabase/functions/generate-message/index.ts`

- Replace `TOGETHER_API_KEY` with `LOVABLE_API_KEY`
- Change fetch URL to Lovable AI Gateway
- Change model to `google/gemini-2.5-flash`

### 5. `supabase/functions/generate-career-action-plan/index.ts`

- Replace `TOGETHER_API_KEY` with `LOVABLE_API_KEY`
- Change fetch URL to Lovable AI Gateway
- Change model to `google/gemini-2.5-flash`

### 6. `supabase/functions/evaluateCareerAdvice/index.ts`

- Replace `TOGETHER_API_KEY` with `LOVABLE_API_KEY`
- Change fetch URL to Lovable AI Gateway
- Change model to `google/gemini-2.5-flash`

### 7. `supabase/functions/analyze-job-match/index.ts`

- Replace `TOGETHER_API_KEY` with `LOVABLE_API_KEY`
- Change fetch URL to Lovable AI Gateway
- Change model to `google/gemini-2.5-flash`

### 8. `supabase/functions/portfolio-ideas/index.ts`

- Replace `TOGETHER_API_KEY` with `LOVABLE_API_KEY`
- Change fetch URL to Lovable AI Gateway
- Change model to `google/gemini-2.5-flash`

### 9. `supabase/functions/evaluate-star-response/index.ts`

- Replace `TOGETHER_API_KEY` with `LOVABLE_API_KEY`
- Change fetch URL to Lovable AI Gateway
- Change model to `google/gemini-2.5-flash`

### 10. `src/hooks/useTogetherAI.ts` (client-side)

- Update default model from `Llama-3.3-70B-Instruct-Turbo-Free` to `google/gemini-2.5-flash`
- The hook calls the `together-ai` edge function which will now route to Gemini

---

## What stays the same

- GROQ and ANWAN remain as fallback providers in the resume-analyzer
- All prompt content and system messages stay identical
- The OpenAI-compatible request/response format is the same
- No database changes needed
- No new secrets needed (`LOVABLE_API_KEY` already exists)

## Benefits

- No more rate limit issues (Gemini has generous limits vs Together.ai's 0.6 RPM)
- Faster responses (no 110-second delays between calls)
- Better model quality (Gemini 2.5 Flash is strong at structured output)
- Simpler codebase (removes TOGETHER/TOGETHER2 dual-endpoint complexity)
