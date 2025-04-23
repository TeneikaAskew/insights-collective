
import React from 'react';
import { BULLET_CATEGORIES } from '../chart/BulletChartData';

interface TextComponent {
  text: string;
  type: 'action' | 'skill' | 'measurable' | 'normal' | 'industry' | 'metric';
  category: string;
}

export const parseTextComponents = (text: string): TextComponent[] => {
  if (!text) return [];

  const components: TextComponent[] = [];

  const actionWords = ['Spearheaded', 'Implemented', 'Developed', 'Led', 'Managed', 'Coordinated', 'Created', 'Built', 'Executed', 'Achieved', 'Delivered', 'Improved', 'Increased', 'Reduced'];
  const measurableResults = /\d+%|\$\d+|\d+x|\d+ percent|\d+K|\d+M|\d+ million|\d+ thousand/g;
  const skillTerms = ['technical', 'leadership', 'management', 'onboarding', 'training', 'analysis', 'design', 'framework', 'database', 'algorithm', 'system', 'platform', 'architecture'];

  let remainingText = text;

  // Find action words at start
  for (const word of actionWords) {
    if (text.startsWith(word)) {
      components.push({
        text: word,
        type: 'action',
        category: BULLET_CATEGORIES.ACTION
      });
      remainingText = text.substring(word.length);
      break;
    }
  }

  const matches = [...remainingText.matchAll(measurableResults)];
  if (matches.length > 0) {
    let lastIndex = 0;

    for (const match of matches) {
      const index = match.index!;

      if (index > lastIndex) {
        const segment = remainingText.substring(lastIndex, index);

        let foundSkill = false;
        for (const skill of skillTerms) {
          if (segment.toLowerCase().includes(skill.toLowerCase())) {
            const skillIndex = segment.toLowerCase().indexOf(skill.toLowerCase());

            if (skillIndex > 0) {
              components.push({
                text: segment.substring(0, skillIndex),
                type: 'normal',
                category: BULLET_CATEGORIES.ACHIEVEMENT // fallback
              });
            }

            components.push({
              text: segment.substring(skillIndex, skillIndex + skill.length),
              type: 'skill',
              category: BULLET_CATEGORIES.ACTION // fallback
            });

            if (skillIndex + skill.length < segment.length) {
              components.push({
                text: segment.substring(skillIndex + skill.length),
                type: 'normal',
                category: BULLET_CATEGORIES.ACHIEVEMENT // fallback
              });
            }

            foundSkill = true;
            break;
          }
        }

        if (!foundSkill) {
          components.push({
            text: segment,
            type: 'normal',
            category: BULLET_CATEGORIES.ACHIEVEMENT // fallback
          });
        }
      }

      components.push({
        text: match[0],
        type: 'measurable',
        category: BULLET_CATEGORIES.METRICS
      });

      lastIndex = index + match[0].length;
    }

    if (lastIndex < remainingText.length) {
      components.push({
        text: remainingText.substring(lastIndex),
        type: 'normal',
        category: BULLET_CATEGORIES.ACHIEVEMENT
      });
    }
  } else {
    let processedText = false;

    for (const skill of skillTerms) {
      if (remainingText.toLowerCase().includes(skill.toLowerCase())) {
        processedText = true;
        const parts = remainingText.split(new RegExp(`(${skill})`, 'i'));

        parts.forEach((part) => {
          if (part.toLowerCase() === skill.toLowerCase()) {
            components.push({
              text: part,
              type: 'skill',
              category: BULLET_CATEGORIES.ACTION
            });
          } else if (part) {
            let actionFound = false;
            for (const action of actionWords) {
              if (part.includes(action)) {
                const actionIndex = part.indexOf(action);

                if (actionIndex > 0) {
                  components.push({
                    text: part.substring(0, actionIndex),
                    type: 'normal',
                    category: BULLET_CATEGORIES.ACHIEVEMENT
                  });
                }

                components.push({
                  text: action,
                  type: 'action',
                  category: BULLET_CATEGORIES.ACTION
                });

                if (actionIndex + action.length < part.length) {
                  components.push({
                    text: part.substring(actionIndex + action.length),
                    type: 'normal',
                    category: BULLET_CATEGORIES.ACHIEVEMENT
                  });
                }

                actionFound = true;
                break;
              }
            }

            if (!actionFound && part) {
              components.push({
                text: part,
                type: 'normal',
                category: BULLET_CATEGORIES.ACHIEVEMENT
              });
            }
          }
        });

        break;
      }
    }

    if (!processedText) {
      components.push({
        text: remainingText,
        type: 'normal',
        category: BULLET_CATEGORIES.ACHIEVEMENT
      });
    }
  }

  return components;
};

export const HighlightedBulletText: React.FC<{ text: string }> = ({ text }) => {
  const components = parseTextComponents(text || '');

  return (
    <>
      {components.length > 0 ? components.map((part, idx) => (
        <span
          key={idx}
          className={`transition-colors duration-200 ${
            part.category === BULLET_CATEGORIES.INDUSTRY
              ? 'text-[#1E40AF] font-bold'
              : part.category === BULLET_CATEGORIES.ACTION
                ? 'text-[#D97706] font-bold'
                : part.category === BULLET_CATEGORIES.METRICS
                  ? 'text-[#0D9488] font-bold'
                  : part.category === BULLET_CATEGORIES.CLARITY
                    ? 'text-[#2563EB] font-bold'
                    : part.category === BULLET_CATEGORIES.ACHIEVEMENT
                      ? 'text-[#059669] font-bold'
                      : 'text-gray-600'
            }`}
        >
          {part.text}
        </span>
      )) : "No bullet text available"}
    </>
  );
};
