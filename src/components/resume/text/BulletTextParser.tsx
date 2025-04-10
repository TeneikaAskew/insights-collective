
import React from 'react';

// Component types
interface TextComponent {
  text: string;
  type: 'action' | 'skill' | 'measurable' | 'normal' | 'industry' | 'metric';
}

// Parse the bullet text to identify different component types
export const parseTextComponents = (text: string): TextComponent[] => {
  if (!text) return [];
  
  const components: TextComponent[] = [];
  
  // Simple rule-based parsing to identify key components
  // Action words (usually at start)
  const actionWords = ['Spearheaded', 'Implemented', 'Developed', 'Led', 'Managed', 'Coordinated', 'Created', 'Built'];
  const measurableResults = /\d+%|\$\d+|\d+x|\d+ percent/g;
  
  let remainingText = text;
  
  // Find action words
  for (const word of actionWords) {
    if (text.startsWith(word)) {
      components.push({
        text: word,
        type: 'action'
      });
      remainingText = text.substring(word.length);
      break;
    }
  }
  
  // Split the remaining text by measurable results
  const matches = [...remainingText.matchAll(measurableResults)];
  if (matches.length > 0) {
    let lastIndex = 0;
    
    for (const match of matches) {
      const index = match.index!;
      
      // Add the text before the measurable result
      if (index > lastIndex) {
        // Check for skill words in this segment
        const segment = remainingText.substring(lastIndex, index);
        const skillTerms = ['new hire onboarding', 'training', 'technical', 'leadership', 'management'];
        
        let foundSkill = false;
        for (const skill of skillTerms) {
          if (segment.includes(skill)) {
            const skillIndex = segment.indexOf(skill);
            
            // Text before skill
            if (skillIndex > 0) {
              components.push({
                text: segment.substring(0, skillIndex),
                type: 'normal'
              });
            }
            
            // Skill text
            components.push({
              text: skill,
              type: 'skill'
            });
            
            // Text after skill
            if (skillIndex + skill.length < segment.length) {
              components.push({
                text: segment.substring(skillIndex + skill.length),
                type: 'normal'
              });
            }
            
            foundSkill = true;
            break;
          }
        }
        
        // If no skill found, add as normal text
        if (!foundSkill) {
          components.push({
            text: segment,
            type: 'normal'
          });
        }
      }
      
      // Add the measurable result
      components.push({
        text: match[0],
        type: 'measurable'
      });
      
      lastIndex = index! + match[0].length;
    }
    
    // Add any remaining text
    if (lastIndex < remainingText.length) {
      components.push({
        text: remainingText.substring(lastIndex),
        type: 'normal'
      });
    }
  } else {
    // No measurable results found
    components.push({
      text: remainingText,
      type: 'normal'
    });
  }
  
  return components;
};

// Component to display parsed bullet text with highlighting
export const HighlightedBulletText: React.FC<{ text: string }> = ({ text }) => {
  const components = parseTextComponents(text || '');
  
  return (
    <>
      {components.length > 0 ? 
        components.map((part, idx) => (
          <span key={idx} className={
            part.type === 'action' ? 'text-primary font-semibold' : 
            part.type === 'skill' ? 'text-destructive font-semibold' : 
            part.type === 'measurable' ? 'text-accent font-semibold' : 
            ''
          }>
            {part.text}
          </span>
        )) : 
        "No bullet text available"
      }
    </>
  );
};
