

# Revert Model Changes -- Restore Original Multi-Model Strategy

## Problem
During E2E testing, all 10 files were incorrectly standardized to `meta-llama/Llama-3.3-70B-Instruct-Turbo`, destroying the intentional multi-model architecture that optimized for response time, cost, quality, and resilience.

## Step 1: Revert to Pre-Change State

Use the built-in **History/Revert** feature to restore all 10 files to their exact original state (before the model standardization commit). This guarantees every original model selection is preserved precisely, with zero risk of guessing wrong.

- Navigate to the edit History and find the message where the 10 files were changed
- Revert to the message immediately **before** that change

This will restore:
- The `together-ai` edge function's original default model (`mistralai/Mixtral-8x7B-Instruct-v0.1` or similar)
- The `resume-analyzer/utils.ts` tiered fallback chain (Together Llama 70B, DeepSeek-R1, Groq, Awan Llama 8B)
- The `generate-study-guide` dual-model setup (Groq `llama3-8b-8192` for fast assessment, Together for guide generation)
- Every other file's original model choice

## Step 2: Fix Only the Actual Bug

After reverting, apply a **single targeted fix** for the Chat 500 error. The issue was that the `together-ai` edge function and/or `ResumeChat.tsx` referenced a deprecated model. The fix:

- In `supabase/functions/together-ai/index.ts`: Update only the default model fallback from the deprecated value to `meta-llama/Llama-3.3-70B-Instruct-Turbo`
- In `src/components/resume/ResumeChat.tsx`: Update only the `selectedModel` constant (line ~450) to `meta-llama/Llama-3.3-70B-Instruct-Turbo`

No other files are touched. No other models are changed.

## Step 3: Verify

- Re-test the Resume Chat to confirm the 500 error is resolved
- Spot-check that other edge functions still work with their original model selections

## What This Preserves

| File | Original Model (Restored) |
|---|---|
| `resume-analyzer/utils.ts` | Multi-provider fallback: Together -> DeepSeek-R1 -> Groq -> Awan |
| `generate-study-guide/index.ts` | Groq `llama3-8b-8192` (assessment) + Together (guide gen) |
| `portfolio-ideas/index.ts` | Original selection (likely Mixtral or different Llama variant) |
| `generate-career-action-plan/index.ts` | Original selection |
| `analyze-job-match/index.ts` | Original selection |
| `evaluateCareerAdvice/index.ts` | Original selection |
| `generate-message/index.ts` | Original selection |
| `useTogetherAI.ts` | Original default model |

## Technical Notes

- The Revert feature is the only safe way to guarantee exact restoration since we lack git diff access to confirm every original model string
- Only 2 files need a post-revert fix (the actual bug), all others return to their original working state untouched
- The `resume-analyzer/utils.ts` fallback chain (with rate limiting, queue system, and endpoint health tracking) will be fully restored

