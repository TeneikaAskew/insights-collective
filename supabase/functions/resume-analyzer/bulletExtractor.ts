// console.log("Bullet Extractor Endpoint hit")
import { actionWords } from './bulletAnalysis.ts';
import { detectSentences } from './sentenceDetector.ts';
// Function to extract bullet points from resume text
export async function extractBulletPoints(text: string) {
  console.log("Bullet Extractor Endpoint hit")
  if (!text || typeof text !== 'string') {
    console.warn("Invalid text input for bullet extraction:", text);
    return [];
  }
  // Match lines that begin with bullet symbols (•, –, —, -, *) followed by whitespace
  const bulletRegex = /^[\s]*[•\-–—*][\s]+(.*)/gm;
  let results = [
    ...text.matchAll(bulletRegex)
  ].map((m)=>m[1].trim());
  // If no bullet-formatted points found, try to detect sentences using detectSentences
  if (results.length === 0) {
    try {
      console.log("Attempting to detect sentences");
      results = await detectSentences(text);
      console.log(`Detected ${results.length} sentences using sentence detection service`);
    } catch (error) {
      console.error("Error using sentence detection, falling back to regex:", error);
      // Fall back to regex patterns
      results = fallbackExtractSentences(text);
    }
  }
  // If still no results, try the action word approach
  if (results.length === 0) {
    const actionRegex = new RegExp(`^(${actionWords.map((w)=>w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`, 'i');
    results = [
      ...text.split('\n')
    ].filter((line)=>actionRegex.test(line.trim())).map((m)=>m.trim());
  }
  // Filter out any empty results
  return results.filter(Boolean);
}
// Helper function for fallback sentence detection
function fallbackExtractSentences(text: string) {
  console.log("Fallback Sentence Extractor Endpoint hit")
  if (!text) return [];
  // Date range pattern to filter out
  const dateRangeRegex = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{4})\s*[-–]\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{4})\b/;
  // Split on periods followed by space then capital letter
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s)=>s.replace(/\r?\n/g, ' ').trim()).filter((s)=>s.length > 15 && !dateRangeRegex.test(s));
  return sentences;
}
// Fallback function to extract content as bullets by splitting on newlines
export function fallbackExtractBullets(text: string) {
  console.log("Fallback Bullet Extractor Endpoint hit")
  if (!text || typeof text !== 'string') {
    return [];
  }
  // Split on newlines, trim, filter out short lines and date ranges
  const dateRangeRegex = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{4})\s*[-–]\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{4})\b/;
  // Split by newlines and filter empty lines
  const lines = text.split(/\r?\n/).map((l)=>l.trim()).filter((l)=>l.length > 15 && !dateRangeRegex.test(l)).filter((l)=>{
    const low = l.toLowerCase();
    return !(low.includes('resume') || low.includes('curriculum vitae') || low.includes('@') || low.includes('phone:') || low.includes('address:') || low.includes('education') || low.includes('skills') || /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/.test(low) || // Phone number
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(low) // Email
    );
  });
  // Further split long lines into sentences
  const bullets = [];
  for (const line of lines){
    if (line.length > 100 && (/[.;]\s+/.test(line) || /(?<=[a-z])\s+(?=[A-Z])/.test(line))) {
      const parts = line.split(/(?<=[.])\s+/).map((p)=>p.replace(/[.]/, '').trim()).filter((p)=>p.length > 15 && !dateRangeRegex.test(p));
      bullets.push(...parts);
    } else {
      bullets.push(line);
    }
  }
  return bullets;
}
