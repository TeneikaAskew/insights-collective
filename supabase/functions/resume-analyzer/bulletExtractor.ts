const actionWords = [
  "accelerated", "accomplished", "achieved", "acquired", "activated", "adapted", "addressed", "administered", "advanced", "advised",
  "advocated", "aligned", "allocated", "analyzed", "applied", "appraised", "assembled", "assessed", "assigned", "assisted",
  "attained", "automated", "boosted", "budgeted", "built", "calculated", "centralized", "championed", "changed", "clarified",
  "coached", "collaborated", "collected", "communicated", "compared", "compiled", "completed", "conceived", "conceptualized", "concluded",
  "conducted", "consolidated", "constructed", "consulted", "contributed", "controlled", "converted", "coordinated", "corrected", "created",
  "cultivated", "customized", "decreased", "defined", "delivered", "demonstrated", "designed", "developed", "devised", "diagnosed",
  "directed", "discovered", "dispatched", "documented", "doubled", "drove", "enabled", "encouraged", "engaged", "engineered",
  "enforced", "enhanced", "enlarged", "ensured", "established", "evaluated", "executed", "expanded", "expedited", "explained",
  "explored", "facilitated", "forecasted", "formed", "formulated", "fostered", "founded", "generated", "governed", "guided",
  "headed", "identified", "implemented", "improved", "increased", "influenced", "informed", "initiated", "innovated", "inspected",
  "inspired", "installed", "instituted", "instructed", "integrated", "intensified", "introduced", "invented", "investigated", "launched",
  "led", "leveraged", "maintained", "managed", "maximized", "merged", "minimized", "modernized", "monitored", "motivated",
  "negotiated", "optimized", "orchestrated", "organized", "outperformed", "overhauled", "oversaw", "partnered", "performed", "piloted",
  "pioneered", "planned", "prepared", "presented", "prioritized", "produced", "programmed", "projected", "promoted", "proposed",
  "protected", "provided", "qualified", "quantified", "realigned", "realized", "rebuilt", "received", "reconciled", "recruited",
  "reduced", "redesigned", "refined", "reformed", "reengineered", "reinforced", "reorganized", "replaced", "reported", "resolved",
  "restructured", "revamped", "reviewed", "revised", "saved", "scheduled", "secured", "selected", "simplified", "solved",
  "spearheaded", "specified", "stabilized", "standardized", "started", "streamlined", "strengthened", "structured", "supervised", "supported",
  "surpassed", "surveyed", "synthesized", "targeted", "tested", "trained", "transformed", "translated", "updated", "upgraded",
  "validated", "won", "yielded", "determine", "approve", "approving", "maintain", "write", "writing", "update", "updating", "enforce", "manage"
];

// Function to extract bullet points from resume text
export function extractBulletPoints(text: string): string[] {
  if (!text || typeof text !== 'string') {
    console.warn("Invalid text input for bullet extraction:", text);
    return [];
  }
  
  // Match lines that begin with bullet symbols (•, –, —, -, *) followed by whitespace
   // 1) Bullet‑marker extraction
  const bulletRegex = /^[\s]*[•\-–—*][\s]+(.*)/gm;
  let results = [...text.matchAll(bulletRegex)].map(m => m[1].trim());

  // 2) Sentence splitting + date‑range filtering
  if (results.length === 0) {
    const dateRangeRegex = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{4})\s*[-–]\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{4})\b/;
    results = text
      .split(/(?<=[.;\n])\s+/) //.split(/(?<=[.;\n])\s+/)                             // split on punctuation or newline including semicolon
      .flatMap(chunk => chunk.split(/(?<=[a-z])\s+(?=[A-Z])/)) // also split lowercase→space→Uppercase
      .map(s => s.replace(/\r?\n/g, ' ').trim())
      .filter(s => s.length > 15 && !dateRangeRegex.test(s));
  }

  // 3) Action‑verb fallback
  if (results.length === 0) {
    const actionRegex = new RegExp(
      `^(${actionWords.map(w => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`,
      'i'
    );
    results = [...text.matchAll(actionRegex)].map(m => m[0].trim());
  }

  // const bulletRegex = /^[\s]*[•\-–—*][\s]+(.*)/gm;
  // const matches = [...text.matchAll(bulletRegex)];
  
  // // If no matches are found, try to find sentences that might be bullet points
  // if (matches.length === 0) {
  //   // Look for sentences that start with action verbs (common in resumes)
  //   // const actionRegex = /^(Managed|Developed|Created|Led|Implemented|Designed|Achieved|Increased|Reduced|Improved)[^.;:]*/gm;
    
  //   const actionRegex = new RegExp(`^(${actionWords.map(w => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`,'i');
  
  //   const actionMatches = [...text.matchAll(actionRegex)];
  //   return actionMatches.map(match => match[0].trim()).filter(Boolean);
  // }
  
  // return matches.map(match => match[1].trim()).filter(Boolean);
  // Final cleanup and return
  return results.filter(Boolean);
}

// Fallback function to extract content as bullets by splitting on newlines
export function fallbackExtractBullets(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // 1) Split on newlines, trim, filter out short lines and date ranges
  const dateRangeRegex = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{4})\s*[-–]\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{4})\b/;
  
  // Split by newlines and filter empty lines
  const lines = text.split(/\r?\n/)
    // .map(line => line.trim())
    // .filter(line => line.length > 15) // Minimum length for a meaningful bullet
    // .filter(Boolean);

  .map(l => l.trim())
    .filter(l => l.length > 15 && !dateRangeRegex.test(l))
    .filter(l => {
      const low = l.toLowerCase();
      return !(
        low.includes('resume') ||
        low.includes('curriculum vitae') ||
        low.includes('@') ||
        low.includes('phone:') ||
        low.includes('address:') ||
        low.includes('education') ||
        low.includes('skills') ||
        /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/.test(low) ||// Phone number
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(low)// Email
      );
    });

  // 2) Further split long lines into sentences, skipping date ranges
  const bullets: string[] = [];
  for (const line of lines) {
    if (
      line.length > 100 &&
      (/[.;]\s+/.test(line) || /(?<=[a-z])\s+(?=[A-Z])/.test(line))
    ) {
      const parts = line
        .split(/(?<=[.;])\s+|(?<=[a-z])\s+(?=[A-Z])/)   // punctuation or lowercase→space→Uppercase
        .map(p => p.replace(/[.;]$/, '').trim())
        .filter(p => p.length > 15 && !dateRangeRegex.test(p));
      bullets.push(...parts);
    } else {
      bullets.push(line);
    }
  }

  // Return the filtered lines as bullets
  return bullets;
}
  
//   // Further filter by removing very common headers and non-content lines
//   const filteredLines = lines.filter(line => {
//     const lowerLine = line.toLowerCase();
    
//     // Skip common headers, contact info, etc.
//     if (
//       lowerLine.includes('resume') || 
//       lowerLine.includes('curriculum vitae') ||
//       lowerLine.includes('@') ||
//       lowerLine.includes('phone:') ||
//       lowerLine.includes('address:') ||
//       lowerLine.includes('education') ||
//       lowerLine.includes('skills') ||
//       /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/.test(lowerLine) || // Phone number
//       /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(lowerLine) // Email
//     ) {
//       return false;
//     }
    
//     return true;
//   });
  
//   // Try to further split lines that may contain multiple sentences
//   let finalBullets = [];
//   for (const line of filteredLines) {
//     // Check if line is very long and might contain multiple points
//     if (line.length > 100 && (line.includes('. ') || line.includes('• '))) {
//       // Split on periods followed by space or bullet points
//       const subLines = line.split(/\.\s+|\•\s+/)
//         .map(subline => subline.trim())
//         .filter(subline => subline.length > 15);
      
//       finalBullets.push(...subLines);
//     } else {
//       finalBullets.push(line);
//     }
//   }
  
//   // Return the filtered lines as bullets
//   return finalBullets;
// }
