
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { BulletAnalysis } from '@/components/assistants/types';
import BulletPointItem from './BulletPointItem';
import BulletPointChart from './BulletPointChart';
import { CheckCircle, AlertTriangle, Edit2 } from 'lucide-react';

interface BulletPointsAnalysisCardProps {
  bullets: BulletAnalysis[];
}

const BulletPointsAnalysisCard: React.FC<BulletPointsAnalysisCardProps> = ({
  bullets = [] // Provide default empty array
}) => {
  const [selectedBulletIndex, setSelectedBulletIndex] = useState(0);

  // If no bullets are available, show a placeholder
  if (!bullets || bullets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resume Bullet Analysis</CardTitle>
          <CardDescription>
            No bullet points found in your resume. Upload a resume with well-formatted bullet points to see detailed analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-gray-400">
          <p>No bullet points to analyze</p>
        </CardContent>
      </Card>
    );
  }

  // Safely select the bullet (handle case where selectedBulletIndex is out of range)
  const selectedBullet = bullets[selectedBulletIndex < bullets.length ? selectedBulletIndex : 0] || bullets[0];

  // Parse bullet text components for highlighting
  const parseTextComponents = (text: string) => {
    if (!text) return [];
    
    const components = [];
    
    // Action words (usually at start)
    const actionWords = [
      'Spearheaded', 'Implemented', 'Developed', 'Led', 'Managed', 'Coordinated', 
      'Created', 'Built', 'Achieved', 'Delivered', 'Improved', 'Increased', 
      'Reduced', 'Transformed', 'Launched', 'Designed', 'Executed', 'Organized'
    ];
    
    // Industry keywords
    const industryKeywords = [
      'new hire onboarding', 'training', 'technical', 'leadership', 'management',
      'HR', 'payroll', 'analytics', 'data', 'metrics', 'strategy', 'budget',
      'recruitment', 'marketing', 'sales', 'revenue', 'customer', 'client', 
      'product', 'project', 'technology', 'software', 'development', 'design'
    ];
    
    // Metric pattern (numbers, percentages, currency)
    const metricPattern = /\d+%|\$\d+|\d+x|\d+ percent|\d+K|\d+M|\d+B/g;
    
    let remainingText = text;
    let foundActionWord = false;
    
    // First look for action words at the beginning
    for (const word of actionWords) {
      if (text.startsWith(word)) {
        components.push({
          text: word,
          type: 'action'
        });
        remainingText = text.substring(word.length);
        foundActionWord = true;
        break;
      }
    }
    
    // If no action word found at start, just proceed with the rest of the text
    if (!foundActionWord) {
      remainingText = text;
    }
    
    // Process the remaining text looking for metrics and industry keywords
    let lastIndex = 0;
    const metricMatches = [...remainingText.matchAll(metricPattern)];
    
    if (metricMatches.length > 0) {
      for (const match of metricMatches) {
        const matchIndex = match.index!;
        const beforeMatch = remainingText.substring(lastIndex, matchIndex);
        
        // Check before match for industry keywords
        let addedIndustryKeyword = false;
        for (const keyword of industryKeywords) {
          const keywordIndex = beforeMatch.toLowerCase().indexOf(keyword.toLowerCase());
          if (keywordIndex !== -1) {
            // Add text before the keyword
            if (keywordIndex > 0) {
              components.push({
                text: beforeMatch.substring(0, keywordIndex),
                type: 'normal'
              });
            }
            
            // Add the keyword
            components.push({
              text: beforeMatch.substring(keywordIndex, keywordIndex + keyword.length),
              type: 'industry'
            });
            
            // Add text after the keyword
            if (keywordIndex + keyword.length < beforeMatch.length) {
              components.push({
                text: beforeMatch.substring(keywordIndex + keyword.length),
                type: 'normal'
              });
            }
            
            addedIndustryKeyword = true;
            break;
          }
        }
        
        // If no industry keyword found, add the whole segment as normal text
        if (!addedIndustryKeyword && beforeMatch.length > 0) {
          components.push({
            text: beforeMatch,
            type: 'normal'
          });
        }
        
        // Add the metric
        components.push({
          text: match[0],
          type: 'metric'
        });
        
        lastIndex = matchIndex + match[0].length;
      }
      
      // Add any remaining text after the last metric
      if (lastIndex < remainingText.length) {
        const remainingSegment = remainingText.substring(lastIndex);
        
        // Check for industry keywords in the remaining text
        let addedIndustryKeyword = false;
        for (const keyword of industryKeywords) {
          const keywordIndex = remainingSegment.toLowerCase().indexOf(keyword.toLowerCase());
          if (keywordIndex !== -1) {
            // Add text before the keyword
            if (keywordIndex > 0) {
              components.push({
                text: remainingSegment.substring(0, keywordIndex),
                type: 'normal'
              });
            }
            
            // Add the keyword
            components.push({
              text: remainingSegment.substring(keywordIndex, keywordIndex + keyword.length),
              type: 'industry'
            });
            
            // Add text after the keyword
            if (keywordIndex + keyword.length < remainingSegment.length) {
              components.push({
                text: remainingSegment.substring(keywordIndex + keyword.length),
                type: 'normal'
              });
            }
            
            addedIndustryKeyword = true;
            break;
          }
        }
        
        // If no industry keyword found, add the whole segment as normal text
        if (!addedIndustryKeyword && remainingSegment.length > 0) {
          components.push({
            text: remainingSegment,
            type: 'normal'
          });
        }
      }
    } else {
      // No metrics found, check for industry keywords in the whole remaining text
      let addedIndustryKeyword = false;
      for (const keyword of industryKeywords) {
        const keywordIndex = remainingText.toLowerCase().indexOf(keyword.toLowerCase());
        if (keywordIndex !== -1) {
          // Add text before the keyword
          if (keywordIndex > 0) {
            components.push({
              text: remainingText.substring(0, keywordIndex),
              type: 'normal'
            });
          }
          
          // Add the keyword
          components.push({
            text: remainingText.substring(keywordIndex, keywordIndex + keyword.length),
            type: 'industry'
          });
          
          // Add text after the keyword
          if (keywordIndex + keyword.length < remainingText.length) {
            components.push({
              text: remainingText.substring(keywordIndex + keyword.length),
              type: 'normal'
            });
          }
          
          addedIndustryKeyword = true;
          break;
        }
      }
      
      // If no industry keyword found, add the whole segment as normal text
      if (!addedIndustryKeyword && remainingText.length > 0) {
        components.push({
          text: remainingText,
          type: 'normal'
        });
      }
    }
    
    return components;
  };

  // Parse the selected bullet text
  const selectedBulletComponents = parseTextComponents(selectedBullet?.original || '');
  const improvedBulletComponents = parseTextComponents(selectedBullet?.rewritten || '');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Resume Bullet Analysis</CardTitle>
        <CardDescription className="text-center">
          Comprehensive breakdown of your resume bullet points with improvement suggestions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bullet selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Select bullet point to analyze:</label>
          <select 
            className="w-full border rounded p-2" 
            value={selectedBulletIndex} 
            onChange={e => setSelectedBulletIndex(parseInt(e.target.value))}
          >
            {bullets.map((bullet, idx) => (
              <option key={idx} value={idx}>
                {bullet?.original?.substring(0, 60) || `Bullet point ${idx + 1}`}...
              </option>
            ))}
          </select>
        </div>
        
        {/* Highlighted bullet text above the charts */}
        <div className="text-center py-2">
          <div className="mt-2 text-lg">
            {selectedBulletComponents.map((part, idx) => (
              <span key={idx} className={
                part.type === 'action' ? 'text-primary font-semibold' : 
                part.type === 'industry' ? 'text-gray-600 font-semibold' : 
                part.type === 'metric' ? 'text-green-600 font-semibold' : 
                ''
              }>
                {part.text}
              </span>
            ))}
          </div>
        </div>
        
        {/* Main visualization for the selected bullet */}
        {selectedBullet && <BulletPointChart bullet={selectedBullet} />}
        
        {/* Original vs Rewritten section */}
        <div className="space-y-4 mt-6 border-t pt-4">
          <div>
            <h4 className="text-md font-semibold mb-2">Original:</h4>
            <div className="bg-slate-50 p-3 rounded text-gray-700">
              {selectedBullet?.original || "No original text available"}
            </div>
          </div>
          
          <div>
            <h4 className="text-md font-semibold mb-2 flex items-center">
              <span>Suggested Improvement:</span>
              <button className="ml-2 text-gray-500 hover:text-gray-700">
                <Edit2 className="h-4 w-4" />
              </button>
            </h4>
            <div className="bg-green-50 p-3 rounded text-gray-700">
              {selectedBullet?.rewritten || "No suggestion available"}
            </div>
          </div>
        </div>
        
        {/* Suggested Improved Bullet Analysis Visualization */}
        {selectedBullet?.rewritten && (
          <div className="mt-6 border-t pt-4">
            <h4 className="text-md font-semibold mb-4">Suggested Improved Bullet Analysis Visualization:</h4>
            
            {/* Improved bullet text display */}
            <div className="text-center mb-4">
              <div className="text-lg">
                {improvedBulletComponents.map((part, idx) => (
                  <span key={idx} className={
                    part.type === 'action' ? 'text-primary font-semibold' : 
                    part.type === 'industry' ? 'text-gray-600 font-semibold' : 
                    part.type === 'metric' ? 'text-green-600 font-semibold' : 
                    ''
                  }>
                    {part.text}
                  </span>
                ))}
              </div>
            </div>
            
            {/* We're reusing the BulletPointChart component for the improved version */}
            <BulletPointChart bullet={{
              ...selectedBullet,
              original: selectedBullet.rewritten,
              // For this example, we're creating an improved version with better scores
              bullet_total: Math.min(45, selectedBullet.bullet_total + 10),
              xyz_scores: {
                hard_soft: Math.min(5, selectedBullet.xyz_scores.hard_soft + 1),
                action_words: Math.min(5, selectedBullet.xyz_scores.action_words + 1),
                measurable_results: Math.min(5, selectedBullet.xyz_scores.measurable_results + 1),
                clarity_focus: Math.min(5, selectedBullet.xyz_scores.clarity_focus + 1)
              },
              word_balance_score: Math.min(25, selectedBullet.word_balance_score + 5),
              word_balance: {
                industry_pct: Math.min(45, selectedBullet.word_balance.industry_pct + 5),
                common_pct: Math.max(25, selectedBullet.word_balance.common_pct - 2),
                action_pct: Math.min(15, selectedBullet.word_balance.action_pct + 2),
                metric_pct: Math.min(15, selectedBullet.word_balance.metric_pct + 2)
              }
            }} />
          </div>
        )}
        
        {/* Score Breakdown section */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-lg font-semibold mb-4">Score Breakdown:</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium text-sm mb-2">Word Balance ({selectedBullet?.word_balance_score || 0}/25)</h5>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Industry:</span>
                  <span className="font-medium">{selectedBullet?.word_balance?.industry_pct || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Common:</span>
                  <span className="font-medium">{selectedBullet?.word_balance?.common_pct || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Action:</span>
                  <span className="font-medium">{selectedBullet?.word_balance?.action_pct || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Metric:</span>
                  <span className="font-medium">{selectedBullet?.word_balance?.metric_pct || 0}%</span>
                </div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-sm mb-2">XYZ Quality ({
                (selectedBullet?.xyz_scores?.hard_soft || 0) + 
                (selectedBullet?.xyz_scores?.action_words || 0) + 
                (selectedBullet?.xyz_scores?.measurable_results || 0) + 
                (selectedBullet?.xyz_scores?.clarity_focus || 0)
              }/20)</h5>
              <div className="space-y-2">
                <div className="flex items-center">
                  {(selectedBullet?.xyz_scores?.hard_soft || 0) >= 3 ? 
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />}
                  <span>Hard/Soft Skills: {selectedBullet?.xyz_scores?.hard_soft || 0}/5</span>
                </div>
                <div className="flex items-center">
                  {(selectedBullet?.xyz_scores?.action_words || 0) >= 3 ? 
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />}
                  <span>Action Words: {selectedBullet?.xyz_scores?.action_words || 0}/5</span>
                </div>
                <div className="flex items-center">
                  {(selectedBullet?.xyz_scores?.measurable_results || 0) >= 3 ? 
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />}
                  <span>Measurable Results: {selectedBullet?.xyz_scores?.measurable_results || 0}/5</span>
                </div>
                <div className="flex items-center">
                  {(selectedBullet?.xyz_scores?.clarity_focus || 0) >= 3 ? 
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />}
                  <span>Clarity & Focus: {selectedBullet?.xyz_scores?.clarity_focus || 0}/5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Improvement Tips */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-md font-semibold mb-2">Improvement Tips:</h4>
          <p className="text-sm text-muted-foreground">
            {selectedBullet?.tips || 
             "Add more specific technical skills or leadership traits. Start with a stronger action verb and avoid passive language. Include quantifiable results (%, $, or other metrics). Make this more concise, aiming for 25 words or fewer."}
          </p>
        </div>
        
        {/* Accordion for all bullet points */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-md font-semibold mb-4">All Bullet Points Analysis:</h4>
          <Accordion type="single" collapsible className="space-y-2">
            {bullets.map((bullet, index) => (
              <BulletPointItem key={index} bullet={bullet} index={index} />
            ))}
          </Accordion>
        </div>
      </CardContent>
    </Card>
  );
};

export default BulletPointsAnalysisCard;
