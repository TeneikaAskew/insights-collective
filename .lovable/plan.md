

## Problem

The "Program Commitment Agreement" checkbox on the fellowship survey's last section has two issues:

1. **The checkbox appears invisible or not interactable** — The screenshot shows the label in error-red with "This field is required" but no visible checkbox control to click
2. **Submit does nothing** — Because the checkbox field is required but has no value (undefined, not false), react-hook-form validation blocks the submission silently

### Root Cause

In `src/components/survey/SurveyField.tsx`, the checkbox case (lines 404-454) is missing the `<FormControl>` wrapper that all other field types have. Without it, the field may not properly connect to react-hook-form. Additionally, the validation rule `required: "This field is required"` treats `undefined` and `false` the same way for checkboxes — a custom `validate` function is needed to ensure the checkbox must be **checked** (truthy), not just present.

### Plan

**File: `src/components/survey/SurveyField.tsx`**

1. **Add `<FormControl>` wrapper** around the checkbox div (matching other field types)
2. **Add custom validation for single agreement checkboxes** — When the field is a required checkbox with no options (agreement-style), use a `validate` function instead of just `required`:
   ```ts
   validate: (value) => value === true || "This field is required"
   ```
   This ensures the user must actually check the box, not just have the field exist.

3. **Set a default value of `false`** for checkbox fields so the form control is properly initialized (prevents undefined state that blocks interaction).

**File: `src/pages/survey/SurveyPage.tsx`** (if needed)

4. Verify that checkbox fields get a proper default value of `false` when initializing the form, so the control renders in an unchecked but interactable state.

### Expected Result
- The checkbox renders visibly with the agreement text
- Users can check/uncheck it  
- Submit only proceeds when the checkbox is checked
- Clear error message shown if user tries to submit without checking

