

# Fix: "Upload & Analyze Resume" Button Not Responding

## Root Cause

When you click "Upload & Analyze Resume," the code checks if text has been extracted from your file first (`extractedText`). If extraction hasn't completed yet (or failed silently for the DOCX file), clicking the button shows a brief toast message ("Still extracting text or no file selected") but otherwise appears to do nothing.

There are two underlying problems:

1. **No loading indicator during text extraction** -- After selecting a file, there's no visual feedback that text is being extracted. The button appears ready immediately, but internally it's waiting for extraction to finish.

2. **DOCX extraction may fail silently** -- If mammoth fails to extract text, the error toast may appear briefly and be easy to miss, leaving `extractedText` as `null` permanently, which blocks the upload button forever.

---

## Plan

### Step 1: Add an `isExtracting` state to show extraction progress

**File:** `src/pages/Resume.tsx`

- Add a new state: `const [isExtracting, setIsExtracting] = useState(false);`
- In the `useEffect` that extracts text (around line 416), wrap the extraction with `setIsExtracting(true)` before and `setIsExtracting(false)` after (in both success and error paths)
- Pass `isExtracting` to `ResumeAnalysisDisplay`

### Step 2: Disable button and show extraction status during text extraction

**File:** `src/components/resume/ResumeAnalysisDisplay.tsx`

- Accept new prop `isExtracting: boolean`
- Update the "Upload & Analyze Resume" button:
  - Add `isExtracting` to the `disabled` condition
  - Show "Extracting text..." label when `isExtracting` is true
  - Add a spinner icon during extraction

Updated button:
```typescript
<Button
  onClick={handleUpload}
  disabled={!resumeFile || uploading || isAnalyzing || isExtracting}
  className="w-full"
>
  {uploading ? 'Uploading...' 
    : isAnalyzing ? 'Analyzing...' 
    : isExtracting ? 'Extracting text...' 
    : 'Upload & Analyze Resume'}
</Button>
```

### Step 3: Improve error handling when extraction fails

**File:** `src/pages/Resume.tsx`

- In the text extraction error handler (around line 427), after showing the error toast, also clear the `resumeFile` state so the user knows they need to re-select:
  ```typescript
  setResumeFile(null); // Force user to re-select since extraction failed
  ```
- Add a more prominent error message explaining what went wrong

### Step 4: Add fallback text extraction for DOCX

**File:** `src/pages/Resume.tsx`

- In the extraction `useEffect`, if mammoth extraction fails, try a fallback `FileReader.readAsText()` approach before giving up entirely
- This matches the fallback pattern already used in `useResume.ts` `uploadResume` method (around line 238)

---

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Resume.tsx` | Add `isExtracting` state, wrap extraction in loading state, improve error handling, add fallback extraction |
| `src/components/resume/ResumeAnalysisDisplay.tsx` | Accept `isExtracting` prop, disable button during extraction, show "Extracting text..." label |
