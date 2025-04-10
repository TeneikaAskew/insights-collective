
import { actionWords, skillsKeywords, weakPhrases } from "./industry-data.ts";

// XYZ ATS Quality Check
export function xyzCheck(bullet: string): {
  hard_soft: number;
  action_words: number;
  measurable_results: number;
  clarity_focus: number;
  xyz_total: number;
} {
  // 1. Hard & Soft Skills check
  const hasSkills = skillsKeywords.some(keyword => bullet.toLowerCase().includes(keyword));
  const hard_soft = hasSkills ? 5 : 0;
  
  // 2. Action Words check
  const actionRegex = new RegExp(`^(${actionWords.map(w => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`,'i');
  const startsWithAction = actionRegex.test(bullet);
  const weakRegex = new RegExp(`\\b(${weakPhrases.map(phrase => phrase.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')).join('|')})\\b`,'i');
  const noWeakPhrasing = !weakRegex.test(bullet);
  const action_words = (startsWithAction && noWeakPhrasing) ? 5 : (startsWithAction || noWeakPhrasing ? 3 : 0);
  
  // 3. Measurable Results check
  const hasNumbers = /\d+%|\d+x|\$\d+|\d+ percent|\d+k|\d+M|\d+B/i.test(bullet);
  const measurable_results = hasNumbers ? 5 : 0;
  
  // 4. Clarity & Focus check
  const wordCount = bullet.split(/\s+/).length;
  const isConcise = wordCount <= 25;
  const clarity_focus = isConcise ? 5 : (wordCount <= 30 ? 3 : 0);
  
  // Calculate total XYZ score
  const xyz_total = hard_soft + action_words + measurable_results + clarity_focus;
  
  return {
    hard_soft,
    action_words,
    measurable_results,
    clarity_focus,
    xyz_total
  };
}
