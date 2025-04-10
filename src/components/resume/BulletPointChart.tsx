
import React from 'react';
import { BulletAnalysis } from '@/components/assistants/types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface BulletPointChartProps {
  bullet: BulletAnalysis;
}

const BulletPointChart: React.FC<BulletPointChartProps> = ({
  bullet
}) => {
  // Add fallback for when bullet properties are undefined
  const {
    word_balance = { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
    bullet_total = 0,
    xyz_scores = { hard_soft: 0, action_words: 0, measurable_results: 0, clarity_focus: 0 }
  } = bullet || {};

  // Format data for the chart with colors matching the design
  const data = [
    {
      name: 'Hard & Soft Skills',
      value: xyz_scores.hard_soft,
      fill: '#1F75FE', // Insight Blue from theme
      target: 35,
      percent: 0
    },
    {
      name: 'Action Words',
      value: xyz_scores.action_words,
      fill: '#F9A826', // Energetic Amber from theme
      target: 15,
      percent: 0
    },
    {
      name: 'Measurable Results',
      value: xyz_scores.measurable_results,
      fill: '#5ED3B5', // Aqua Teal from theme
      target: 15,
      percent: 0
    },
    {
      name: 'Common Words',
      value: xyz_scores.clarity_focus,
      fill: '#8A8F9E', // Dusty Gray from theme
      target: 35,
      percent: 0
    }
  ];

  // Calculate actual percentages
  const totalScore = data.reduce((sum, item) => sum + item.value, 0);
  const dataWithPercent = data.map(item => ({
    ...item,
    percent: Math.round(item.value / (totalScore || 1) * 100)
  }));

  // Parse the bullet text to identify different component types
  const parseTextComponents = (text: string) => {
    if (!text) return [];
    
    const components = [];
    
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

  // Function to determine if target is met
  const isTargetMet = (actual: number, target: number) => {
    return actual >= target - 5 && actual <= target + 5;
  };

  // Use the original bullet text or fallback to sample
  const textComponents = bullet?.original 
    ? parseTextComponents(bullet.original)
    : [
        { text: 'Spearheaded', type: 'action' },
        { text: ' new training protocols to reduce ', type: 'normal' },
        { text: 'new hire onboarding', type: 'skill' },
        { text: ' by ', type: 'normal' },
        { text: '15%', type: 'measurable' }
      ];

  return (
    <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
      <div className="text-center mb-6">
        <p className="text-lg mt-4 mb-4">
          {textComponents.map((part, index) => (
            <span key={index} className={
              part.type === 'action' ? 'text-primary font-semibold' : 
              part.type === 'skill' ? 'text-destructive font-semibold' : 
              part.type === 'measurable' ? 'text-accent font-semibold' : 
              ''
            }>
              {part.text}
            </span>
          ))}
        </p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <h3 className="text-md font-semibold text-center mb-4">Bullet Anatomy</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie 
                  data={dataWithPercent} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60} 
                  outerRadius={90} 
                  paddingAngle={2} 
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {dataWithPercent.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-3xl font-bold">{bullet_total}</div>
              <div className="text-sm text-gray-500">Bullet Score</div>
            </div>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold">Distribution</h3>
            <div className="flex items-center space-x-8">
              <span className="text-sm font-medium">Actual</span>
              <span className="text-sm font-medium">Target</span>
            </div>
          </div>
          
          <div className="space-y-4">
            {dataWithPercent.map((item, index) => (
              <div key={index} className="relative">
                <div className="flex justify-between text-sm mb-1">
                  <div className="flex items-center">
                    <div className="w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: item.fill }}></div>
                    <span>{item.name}</span>
                  </div>
                  <div className="flex items-center space-x-10">
                    <span className={isTargetMet(item.percent, item.target) ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                      {item.percent}%
                    </span>
                    <span className="text-gray-500">
                      {item.target}% (±5%)
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded">
                  <div 
                    className="h-full rounded" 
                    style={{
                      width: `${Math.min(100, item.percent)}%`,
                      backgroundColor: item.fill
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulletPointChart;
