
// Default/fallback analysis responses
export function createEmptyAnalysis(message: string = "Please upload a resume with text content") {
  return {
    bullets: [],
    resume_average: 25,
    resume_percent: 50,
    letter_grade: "C",
    themes: [message],
    elevator_pitch: "We couldn't find any text to analyze. Please upload a valid resume document.",
    explanation: "We couldn't find any text to analyze. Make sure your document contains readable text content."
  };
}

export function createPartialAnalysis(errorMessage: string) {
  return {
    bullets: [],
    resume_average: 25,
    resume_percent: 50, // Default to 50% instead of 0% to avoid "F"
    letter_grade: "C", // Default to "C" instead of "F"
    themes: ["Format your resume with clear bullet points", "Start each bullet with an action verb", "Include measurable achievements"],
    elevator_pitch: "We encountered an issue analyzing your resume. For best results, ensure your resume uses clear bullet points with action verbs and metrics.",
    explanation: `Error analyzing resume: ${errorMessage || "Unknown error"}`
  };
}

export function createErrorResponse(errorMessage: string) {
  return {
    error: errorMessage,
    resume_percent: 50,
    letter_grade: "C",
    themes: ["Error during analysis, please try again"],
    elevator_pitch: "We encountered an error. Please try again with a different resume format.",
    explanation: `Error: ${errorMessage}`,
    bullets: []
  };
}
