
// Generate letter grade based on percentage
export function getLetterGrade(percentage: number): string {
  if (percentage >= 92) return "A";
  if (percentage >= 85) return "B+";
  if (percentage >= 78) return "B";
  if (percentage >= 72) return "C+";
  if (percentage >= 65) return "C";
  if (percentage >= 58) return "D+";
  if (percentage >= 50) return "D";
  return "F"; // Scores below 50% will actually show as F now
}
