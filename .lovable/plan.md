

# Fix: Key Improvement Themes via Tool Calling

## Problem

The `enhanceWithGroq` function in `aiEnhancer.ts` asks the AI for free-text output, then attempts to parse it with 400+ lines of regex patterns (`formatResponse`). The AI frequently returns themes as a single paragraph, which none of the regex fallbacks can split into separate items.

## Solution

Use the Lovable AI Gateway's **tool calling** feature to force the AI to return structured JSON. This eliminates all regex parsing.

## Changes

### 1. Update `callGeminiAPI` in `supabase/functions/resume-analyzer/utils.ts`

- Add optional `tools` and `tool_choice` parameters to the function signature
- Include them in the request body when provided
- When the response contains `tool_calls`, extract and return the parsed `arguments` JSON instead of `message.content`

### 2. Rewrite the AI call in `supabase/functions/resume-analyzer/aiEnhancer.ts`

- Replace the free-text system prompt (lines 487-492) with a prompt that works alongside tool calling
- Add a tool definition for `analyze_resume` with this schema:
  - `elevator_pitch`: string (max 2 sentences)
  - `themes`: array of exactly 3 strings (one sentence each)
  - `explanation`: string (max 2 sentences)
- Set `tool_choice` to force the model to use `analyze_resume`
- Replace the `formatResponse(aiResponse)` call (line 522) with direct JSON extraction from the tool call response
- The `formatResponse` and `jsonFormatResponse` functions (lines 199-457) and all commented-out regex code (lines 46-196) will be removed

### 3. Update `callLLMWithRetry` and `callLLMAPI` in `utils.ts`

- Pass through `tools` and `tool_choice` from callers to the underlying API call functions
- Update `callGROQAPI` similarly so the fallback chain also supports tool calling

### 4. Redeploy the `resume-analyzer` edge function

## Technical Detail: Tool Definition

```text
{
  type: "function",
  function: {
    name: "analyze_resume",
    description: "Return structured resume analysis with elevator pitch, improvement themes, and grade explanation.",
    parameters: {
      type: "object",
      properties: {
        elevator_pitch: { type: "string", description: "Professional elevator pitch, max 2 sentences" },
        themes: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 3,
          description: "Three specific improvement themes, one sentence each"
        },
        explanation: { type: "string", description: "Brief explanation of the resume grade, max 2 sentences" }
      },
      required: ["elevator_pitch", "themes", "explanation"],
      additionalProperties: false
    }
  }
}
```

## What Gets Removed

- `formatResponse` function (~240 lines of regex patterns)
- `jsonFormatResponse` function (~18 lines)
- All commented-out regex code (~150 lines)
- The `stripPhrases` helper and `capitalizeFirstWord` helper

## Risk

Low. Tool calling is the documented approach for structured output with the Lovable AI Gateway. The fallback chain (Gemini to GROQ to ANWAN) will all receive the same tool definitions.

