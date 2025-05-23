
import React from 'react';
import { BULLET_CATEGORIES } from '../chart/BulletChartData';

// Component types
interface TextComponent {
  text: string;
  type: 'action' | 'skill' | 'measurable' | 'normal' | 'industry' | 'metric';
  category: string;
}

// Parse the bullet text to identify different component types
export const parseTextComponents = (text: string): TextComponent[] => {
  if (!text) return [];
  
  const components: TextComponent[] = [];
  
  // Enhanced rule-based parsing to identify key components
  // Action words (usually at start)
  const actionWords = [
    'Spearheaded', 'Implemented', 'Developed', 'Led', 'Managed', 'Coordinated', 'Created', 'Built', 'Executed',
    'Achieved', 'Delivered', 'Improved', 'Increased', 'Reduced', 'Enforced', 'Established', 'Maintained',
    'Directed', 'Transformed', 'Generated', 'Optimized', 'Initiated', 'Produced', 'Engineered', 'Deployed',
    'Upgraded', 'Streamlined', 'Consolidated', 'Facilitated', 'Automated', 'Launched', 'Orchestrated', 'Resolved',
    'Designed', 'Modernized', 'Piloted', 'Enabled', 'Restructured', 'Enhanced', 'Instituted', 'Mobilized',
    'Influenced', 'Refined', 'Simplified', 'Overhauled', 'Shaped', 'Monitored', 'Elevated', 'Integrated',
    'Revamped', 'Analyzed', 'Identified', 'Forecasted', 'Tested', 'Tracked', 'Audited', 'Reported', 'Formulated',
    'Mentored', 'Trained', 'Negotiated', 'Supervised', 'Contributed', 'Partnered', 'Delegated', 'Validated',
    'Budgeted', 'Estimated', 'Collaborated', 'Reviewed', 'Championed', 'Adapted', 'Advocated', 'Improvised',
    'Assessed', 'Allocated', 'Resolved', 'Documented', 'Filed', 'Audited', 'Researched', 'Strengthened',
    'Streamed', 'Assumed', 'Coded', 'Programmed', 'Investigated', 'Scheduled', 'Tested', 'Executed', 'Led teams',
    'Drafted', 'Outlined', 'Launched', 'Rolled out'
  ];

  // Achievement words
  const achievementWords = [
    'success', 'successful', 'achievement', 'accomplishment', 'milestone', 'breakthrough', 'win', 'recognition',
    'award', 'certified', 'honored', 'top performer', 'pioneer', 'champion', 'leader', 'promoted',
    'improved', 'reduced', 'increased', 'generated', 'saved', 'cut', 'exceeded', 'surpassed', 'maximized',
    'optimized', 'attained', 'delivered', 'grew', 'expanded', 'strengthened', 'enhanced', 'accelerated',
    'boosted', 'outperformed', 'elevated', 'surged', 'streamlined', 'minimized', 'conserved', 'stabilized',
    'capitalized', 'realized', 'advanced', 'scaled', 'mobilized', 'retained', 'converted', 'secured', 'won'
  ];

  // Industry/domain-specific terms
  const industryTerms = [
    'payroll', 'regulations', 'policies', 'procedures', 'compliance', 'adherence', 'governmental',
    'corporate', 'technical', 'strategy', 'framework', 'system', 'platform', 'architecture',
    'database', 'pipeline', 'infrastructure', 'deployment', 'integration', 'security', 'data',
    'analytics', 'reporting', 'visualization', 'machine learning', 'AI', 'cloud', 'DevOps',
    'finance', 'budget', 'forecast', 'operations', 'procurement', 'supply chain', 'inventory',
    'logistics', 'transportation', 'customer service', 'CRM', 'marketing', 'SEO', 'salesforce',
    'communication', 'compliance', 'productivity', 'sustainability', 'talent', 'engagement', 'onboarding',
    'risk management', 'cybersecurity', 'governance', 'automation', 'IoT', 'blockchain', 'BI', 'KPI'
  ];

  // Clarity/conciseness terms
  const clarityTerms = [
    'clear', 'concise', 'specific', 'defined', 'streamlined', 'simplified', 'standardized',
    'documented', 'outlined', 'delineated', 'formalized', 'codified', 'visualized',
    'summarized', 'clarified', 'organized', 'mapped', 'structured', 'tracked', 'recorded',
    'blueprinted', 'categorized', 'indexed', 'workflowed', 'charted', 'benchmarked',
    'explained', 'clarified', 'transparent', 'articulated', 'declared'
  ];

  let remainingText = text;
  
  // Find action words at the beginning
  for (const word of actionWords) {
    if (text.toLowerCase().startsWith(word.toLowerCase())) {
      components.push({
        text: text.substring(0, word.length),
        type: 'action',
        category: BULLET_CATEGORIES.xyz_scores.action.label
      });
      remainingText = text.substring(word.length);
      break;
    }
  }
  
  // Process the remaining text by checking for different types of components
  if (remainingText) {
    let processedIndex = 0;
    const lowerText = remainingText.toLowerCase();
    const words = remainingText.split(/\s+/);
    let currentSegment = '';
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const lowerWord = word.toLowerCase();
      const originalIndex = lowerText.indexOf(lowerWord, processedIndex);
      
      // Check if word is an action word
      if (actionWords.some(action => lowerWord.includes(action.toLowerCase()))) {
        // Add any text before this word
        if (currentSegment.length > 0) {
          components.push({
            text: currentSegment,
            type: 'normal',
            category: BULLET_CATEGORIES.word_balance.common_pct.label
          });
          currentSegment = '';
        }
        
        components.push({
          text: word,
          type: 'action',
          category: BULLET_CATEGORIES.xyz_scores.action.label
        });
      }
      // Check if word is a metric
      else if (word.match(/\d+%|\$\d+|\d+x|\d+ percent|\d+K|\d+M/)) {
        // Add any text before this word
        if (currentSegment.length > 0) {
          components.push({
            text: currentSegment,
            type: 'normal',
            category: BULLET_CATEGORIES.word_balance.common_pct.label
          });
          currentSegment = '';
        }
        
        components.push({
          text: word,
          type: 'measurable',
          category: BULLET_CATEGORIES.xyz_scores.metrics.label
        });
      }
      // Check if word is an industry term
      else if (industryTerms.some(term => lowerWord.includes(term.toLowerCase()))) {
        // Add any text before this word
        if (currentSegment.length > 0) {
          components.push({
            text: currentSegment,
            type: 'normal',
            category: BULLET_CATEGORIES.word_balance.common_pct.label
          });
          currentSegment = '';
        }
        
        components.push({
          text: word,
          type: 'industry',
          category: BULLET_CATEGORIES.xyz_scores.industry.label
        });
      }
      // Check if word is an achievement word
      else if (achievementWords.some(term => lowerWord.includes(term.toLowerCase()))) {
        // Add any text before this word
        if (currentSegment.length > 0) {
          components.push({
            text: currentSegment,
            type: 'normal',
            category: BULLET_CATEGORIES.word_balance.common_pct.label
          });
          currentSegment = '';
        }
        
        components.push({
          text: word,
          type: 'skill',
          category: BULLET_CATEGORIES.xyz_scores.achievement.label
        });
      }
      // Check if word is a clarity term
      else if (clarityTerms.some(term => lowerWord.includes(term.toLowerCase()))) {
        // Add any text before this word
        if (currentSegment.length > 0) {
          components.push({
            text: currentSegment,
            type: 'normal',
            category: BULLET_CATEGORIES.word_balance.common_pct.label
          });
          currentSegment = '';
        }
        
        components.push({
          text: word,
          type: 'skill',
          category: BULLET_CATEGORIES.xyz_scores.clarity.label
        });
      }
      else {
        // Add space if not the first word in the segment
        if (currentSegment.length > 0) {
          currentSegment += ' ';
        }
        currentSegment += word;
      }
      
      // Update the processed index
      processedIndex = originalIndex + word.length;
      
      // If this is the last word and we have a current segment, add it
      if (i === words.length - 1 && currentSegment.length > 0) {
        components.push({
          text: currentSegment,
          type: 'normal',
          category: BULLET_CATEGORIES.word_balance.common_pct.label
        });
      }
    }
  }
  
  // Clean up components - add spaces between components
  const finalComponents: TextComponent[] = [];
  components.forEach((component, index) => {
    // Add the component
    finalComponents.push(component);
    
    // Add space after component if it's not the last one and doesn't end with space
    if (index < components.length - 1 && !component.text.endsWith(' ') && !components[index + 1].text.startsWith(' ')) {
      finalComponents.push({
        text: ' ',
        type: 'normal',
        category: BULLET_CATEGORIES.word_balance.common_pct.label
      });
    }
  });
  
  return finalComponents;
};

// Component to display parsed bullet text with highlighting using brand colors
export const HighlightedBulletText: React.FC<{ text: string }> = ({ text }) => {
  const components = parseTextComponents(text || '');
  
  return (
    <>
      {components.length > 0 ? 
        components.map((part, idx) => (
          <span 
            key={idx} 
            className={`transition-colors duration-200 ${
              part.category === BULLET_CATEGORIES.xyz_scores.industry.label
                ? 'text-[#1E40AF] font-bold' : 
              part.category === BULLET_CATEGORIES.xyz_scores.action.label
                ? 'text-[#D97706] font-bold' : 
              part.category === BULLET_CATEGORIES.xyz_scores.metrics.label
                ? 'text-[#0D9488] font-bold' : 
              part.category === BULLET_CATEGORIES.xyz_scores.clarity.label
                ? 'text-[#2563EB] font-bold' :
              part.category === BULLET_CATEGORIES.xyz_scores.achievement.label
                ? 'text-[#059669] font-bold' :
              'text-gray-600'
            }`}
          >
            {part.text}
          </span>
        )) : 
        "No bullet text available"
      }
    </>
  );
};
