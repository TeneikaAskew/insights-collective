
// Generate letter grade based on percentage
// export function getLetterGrade(percentage: number): string {
//   if (percentage >= 90) return "A";
//   if (percentage >= 80) return "B";
//   if (percentage >= 70) return "C";
//   if (percentage >= 60) return "D";
//   return "F";
// }
// // Generate letter grade based on percentage with a more nuanced scale
export function getLetterGrade(percentage) {
  if (percentage >= 92) return "A";
  if (percentage >= 85) return "B+";
  if (percentage >= 78) return "B";
  if (percentage >= 72) return "C+";
  if (percentage >= 65) return "C";
  if (percentage >= 58) return "D+";
  if (percentage >= 50) return "D";
  return "F"; // Scores below 50% will actually show as F now
}