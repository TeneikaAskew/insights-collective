
import { analyzeWordBalance } from "./word-balance-analyzer.ts";
import { xyzCheck } from "./xyz-analyzer.ts";

// Export the main analysis functions from the new modular structure
export { analyzeWordBalance, xyzCheck };

// Re-export industry data for use in other modules
export { industryWords, actionWords, softSkills, weakPhrases, skillsKeywords } from "./industry-data.ts";
