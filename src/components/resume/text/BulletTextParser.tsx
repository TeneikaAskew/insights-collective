
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
  // const actionWords = ['Spearheaded', 'Implemented', 'Developed', 'Led', 'Managed', 'Coordinated', 'Created', 'Built', 'Executed', 'Achieved', 
  //   'Delivered', 'Improved', 'Increased', 'Reduced', 'Enforced', 'Established', 'Maintained', 'Directed', 'Transformed', 'Generated', 'Optimized'];
  const actionWords = [
    'Spearheaded', 'Implemented', 'Developed', 'Led', 'Managed', 'Coordinated', 'Created', 'Built', 'Executed',
    'Achieved', 'Delivered', 'Improved', 'Increased', 'Reduced', 'Enforced', 'Established', 'Maintained',
    'Directed', 'Transformed', 'Generated', 'Optimized', 'Initiated', 'Produced', 'Engineered', 'Deployed',
    'Upgraded', 'Streamlined', 'Consolidated', 'Facilitated', 'Automated', 'Launched', 'Orchestrated', 'Resolved',
    'Designed', 'Modernized', 'Piloted', 'Enabled', 'Restructured', 'Enhanced', 'Instituted', 'Mobilized',
    'Influenced', 'Refined', 'Simplified', 'Overhauled', 'Shaped', 'Monitored', 'Elevated', 'Instituted',
    'Integrated', 'Revamped', 'Analyzed', 'Identified', 'Forecasted', 'Tested', 'Tracked', 'Audited', 'Reported'
  ];

  // Achievement words
  // const achievementWords = ['success', 'successful', 'achievement', 'improved', 'reduced', 'increased', 'generated', 'saved', 'exceeded', 'surpassed', 
  //   'maximized', 'accomplished', 'attained', 'delivered', 'grew', 'expanded', 'strengthened', 'enhanced', 'accelerated', 'boosted'];
  const achievementWords = [
    'success', 'successful', 'achievement', 'accomplishment', 'milestone', 'breakthrough',
    'improved', 'reduced', 'increased', 'generated', 'saved', 'cut', 'exceeded', 'surpassed',
    'maximized', 'optimized', 'attained', 'delivered', 'grew', 'expanded', 'strengthened',
    'enhanced', 'accelerated', 'boosted', 'outperformed', 'reached', 'elevated', 'surged',
    'streamlined', 'minimized', 'conserved', 'stabilized', 'capitalized', 'realized', 'advanced',
    'scaled', 'mobilized', 'transitioned', 'retained', 'converted', 'secured', 'closed', 'won'
  ];

  // Industry/domain-specific terms
  // const industryTerms = ['payroll', 'regulations', 'policies', 'procedures', 'compliance', 'adherence', 'governmental', 'company', 'corporate', 
  //   'technical', 'strategy', 'framework', 'system', 'platform', 'database', 'architecture', 'process', 'standards', 'protocol', 'integration'];
  const industryTerms = [
    'payroll', 'regulations', 'policies', 'procedures', 'compliance', 'adherence', 'governmental',
    'corporate', 'technical', 'strategy', 'framework', 'system', 'platform', 'architecture',
    'database', 'pipeline', 'infrastructure', 'deployment', 'integration', 'security', 'data',
    'analytics', 'reporting', 'visualization', 'machine learning', 'AI', 'cloud', 'DevOps',
    'finance', 'budget', 'forecast', 'operations', 'procurement', 'supply chain', 'inventory',
    'logistics', 'transportation', 'customer service', 'CRM', 'marketing', 'SEO', 'salesforce',
    'comms', 'compliance', 'productivity', 'sustainability', 'talent', 'engagement', 'onboarding'
  ];

  // Metrics/results - measurement terms and numbers
  // const measurableResults = /\d+%|\$\d+|\d+x|\d+ percent|\d+K|\d+M|\d+ million|\d+ thousand/g;
  const measurableRegex = new RegExp(
    [
      '\\$?\\d{1,3}(,\\d{3})*(\\.\\d+)?\\s?(million|billion|thousand|M|B|K)?', // $3.5 million, 1,000,000
      '\\b\\d+\\s?(%|percent)\\b',                   // 45%, 12 percent
      '\\b\\d+(x| times)\\b',                        // 3x, 5 times
      '\\b\\d+\\s?(hours?|days?|weeks?|months?|years?)\\b', // duration
      '\\b\\d+\\s?(units|customers|clients|users|transactions|projects|sales|visits|downloads|installs|members|subscribers|views)\\b',
      '\\$\\d+[KMB]?',                               // $50K, $3M
      'revenue of \\$?\\d+[KMB%]?',                  // revenue phrases
      'ROI of \\$?\\d+%?',                           // ROI
      'saved (\\$?\\d+|\\d+%)',                      // saved $ or %
      'increased .* by \\$?\\d+%?',                  // increased by $ or %
      'reduced .* by \\$?\\d+%?',                    // reduced by $ or %
      'achieved .* of \\$?\\d+[KMB%]?',              // achieved metric
      'cut .* by \\d+%',                             // cut something by a percentage
      'boosted .* to \\$?\\d+[KMB%]?',               // boosted something to a measurable amount
      '\\b(\\d{4})\\b',                              // year (used for historical reporting)
      '\\d+ out of \\d+',                            // ratios like 9 out of 10
      '\\d+\\.\\d+\\s?(score|rating|stars?)'         // 4.8 rating
    ].join('|'),
    'gi'
  );

  
  // Clarity/conciseness terms - clear and direct expressions
  // const clarityTerms = ['clear', 'concise', 'specific', 'defined', 'streamlined', 'simplified', 'standardized', 'documented', 'outlined', 'delineated',
  //   'established', 'formalized'];
  const clarityTerms = [
    'clear', 'concise', 'specific', 'defined', 'streamlined', 'simplified', 'standardized',
    'documented', 'outlined', 'delineated', 'formalized', 'codified', 'visualized',
    'summarized', 'clarified', 'organized', 'mapped', 'structured', 'tracked', 'recorded',
    'blueprinted', 'categorized', 'indexed', 'workflowed'
  ];

  let remainingText = text;
  
  // Find action words at the beginning
  for (const word of actionWords) {
    if (text.toLowerCase().startsWith(word.toLowerCase())) {
      components.push({
        text: text.substring(0, word.length),
        type: 'action',
        category: BULLET_CATEGORIES.ACTION
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
            category: BULLET_CATEGORIES.COMMON
          });
          currentSegment = '';
        }
        
        components.push({
          text: word,
          type: 'action',
          category: BULLET_CATEGORIES.ACTION
        });
      }
      // Check if word is a metric
      else if (word.match(/\d+%|\$\d+|\d+x|\d+ percent|\d+K|\d+M/)) {
        // Add any text before this word
        if (currentSegment.length > 0) {
          components.push({
            text: currentSegment,
            type: 'normal',
            category: BULLET_CATEGORIES.COMMON
          });
          currentSegment = '';
        }
        
        components.push({
          text: word,
          type: 'measurable',
          category: BULLET_CATEGORIES.METRICS
        });
      }
      // Check if word is an industry term
      else if (industryTerms.some(term => lowerWord.includes(term.toLowerCase()))) {
        // Add any text before this word
        if (currentSegment.length > 0) {
          components.push({
            text: currentSegment,
            type: 'normal',
            category: BULLET_CATEGORIES.COMMON
          });
          currentSegment = '';
        }
        
        components.push({
          text: word,
          type: 'industry',
          category: BULLET_CATEGORIES.INDUSTRY
        });
      }
      // Check if word is an achievement word
      else if (achievementWords.some(term => lowerWord.includes(term.toLowerCase()))) {
        // Add any text before this word
        if (currentSegment.length > 0) {
          components.push({
            text: currentSegment,
            type: 'normal',
            category: BULLET_CATEGORIES.COMMON
          });
          currentSegment = '';
        }
        
        components.push({
          text: word,
          type: 'skill',
          category: BULLET_CATEGORIES.ACHIEVEMENT
        });
      }
      // Check if word is a clarity term
      else if (clarityTerms.some(term => lowerWord.includes(term.toLowerCase()))) {
        // Add any text before this word
        if (currentSegment.length > 0) {
          components.push({
            text: currentSegment,
            type: 'normal',
            category: BULLET_CATEGORIES.COMMON
          });
          currentSegment = '';
        }
        
        components.push({
          text: word,
          type: 'skill',
          category: BULLET_CATEGORIES.CLARITY
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
          category: BULLET_CATEGORIES.COMMON
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
        category: BULLET_CATEGORIES.COMMON
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
              part.category === BULLET_CATEGORIES.INDUSTRY 
                ? 'text-[#1E40AF] font-bold' : 
              part.category === BULLET_CATEGORIES.ACTION 
                ? 'text-[#D97706] font-bold' : 
              part.category === BULLET_CATEGORIES.METRICS 
                ? 'text-[#0D9488] font-bold' : 
              part.category === BULLET_CATEGORIES.CLARITY
                ? 'text-[#2563EB] font-bold' :
              part.category === BULLET_CATEGORIES.ACHIEVEMENT
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
