

# Improve Elevator Pitch Quality

## Problem

The tool calling schema constrains the elevator pitch to "max 2 sentences," producing a generic summary like *"This Machine Learning Engineer excels in computer vision..."*. The previous version generated a rich, detailed pitch that covered the candidate's expertise, key achievements, deployment experience, and professional passions -- ending with language like *"...drives advancements in trustworthy AI through hands-on experimentation and interdisciplinary collaboration."*

## Root Cause

Line 17 in `aiEnhancer.ts`:
```
description: "Professional elevator pitch summarizing the candidate, max 2 sentences"
```

And line 88 in the system prompt:
```
1. A professional elevator pitch (max 2 sentences)
```

## Fix

Update two places in `supabase/functions/resume-analyzer/aiEnhancer.ts`:

### 1. Tool schema description (line 17)

Change from:
```
"Professional elevator pitch summarizing the candidate, max 2 sentences"
```
To:
```
"Detailed professional elevator pitch summarizing the candidate's core expertise, key achievements, deployment experience, and professional passions. Should be 4-5 sentences and read like a polished introduction a recruiter could use."
```

### 2. System prompt (line 88)

Change from:
```
1. A professional elevator pitch (max 2 sentences)
```
To:
```
1. A detailed professional elevator pitch (4-5 sentences) covering their core expertise, standout achievements, hands-on experience, and what drives them professionally
```

### 3. Redeploy the `resume-analyzer` edge function

No other files change. After redeployment, clicking the Re-analyze button will produce a richer pitch matching the quality of the previous version.

