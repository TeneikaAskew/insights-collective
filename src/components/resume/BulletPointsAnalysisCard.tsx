
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { BulletAnalysis } from '@/components/assistants/types';
import BulletPointItem from './BulletPointItem';
import BulletPointChart from './BulletPointChart';
import { CheckCircle, AlertTriangle } from 'lucide-react';

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

  // Select the first bullet or the currently selected one
  const selectedBullet = bullets[selectedBulletIndex] || bullets[0];

  // Function to parse bullet text components
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

  // Parse the selected bullet text
  const selectedBulletComponents = parseTextComponents(selectedBullet?.original || '');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume Bullet Analysis</CardTitle>
        <CardDescription>
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
        
        {/* Highlighted bullet text */}
        <div className="text-center py-4 border-b">
          <h3 className="text-xl font-semibold">Resume Bullet Analysis</h3>
          <div className="mt-4 text-lg">
            {selectedBulletComponents.map((part, idx) => (
              <span key={idx} className={
                part.type === 'action' ? 'text-primary font-semibold' : 
                part.type === 'skill' ? 'text-destructive font-semibold' : 
                part.type === 'measurable' ? 'text-accent font-semibold' : 
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
            <div className="bg-slate-50 p-3 rounded">
              {selectedBullet?.original || "No original text available"}
            </div>
          </div>
          
          <div>
            <h4 className="text-md font-semibold mb-2">Suggested Improvement:</h4>
            <div className="bg-green-50 p-3 rounded">
              {selectedBullet?.rewritten || "No suggestion available"}
            </div>
          </div>
        </div>
        
        {/* Score breakdown section */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-md font-semibold mb-4">Score Breakdown:</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h5 className="font-medium text-sm mb-2">Word Balance ({selectedBullet?.word_balance_score || 0}/25)</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Industry: <span className="font-medium">{selectedBullet?.word_balance?.industry_pct || 0}%</span></div>
                <div>Common: <span className="font-medium">{selectedBullet?.word_balance?.common_pct || 0}%</span></div>
                <div>Action: <span className="font-medium">{selectedBullet?.word_balance?.action_pct || 0}%</span></div>
                <div>Metric: <span className="font-medium">{selectedBullet?.word_balance?.metric_pct || 0}%</span></div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-sm mb-2">XYZ Quality ({
                (selectedBullet?.xyz_scores?.hard_soft || 0) + 
                (selectedBullet?.xyz_scores?.action_words || 0) + 
                (selectedBullet?.xyz_scores?.measurable_results || 0) + 
                (selectedBullet?.xyz_scores?.clarity_focus || 0)
              }/20)</h5>
              <div>
                <div className="flex items-center mb-1">
                  {(selectedBullet?.xyz_scores?.hard_soft || 0) >= 3 ? 
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />}
                  <span>Hard/Soft Skills: {selectedBullet?.xyz_scores?.hard_soft || 0}/5</span>
                </div>
                <div className="flex items-center mb-1">
                  {(selectedBullet?.xyz_scores?.action_words || 0) >= 3 ? 
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />}
                  <span>Action Words: {selectedBullet?.xyz_scores?.action_words || 0}/5</span>
                </div>
                <div className="flex items-center mb-1">
                  {(selectedBullet?.xyz_scores?.measurable_results || 0) >= 3 ? 
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />}
                  <span>Measurable Results: {selectedBullet?.xyz_scores?.measurable_results || 0}/5</span>
                </div>
                <div className="flex items-center">
                  {(selectedBullet?.xyz_scores?.clarity_focus || 0) >= 3 ? 
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />}
                  <span>Clarity & Focus: {selectedBullet?.xyz_scores?.clarity_focus || 0}/5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Improvement Tips */}
        <div className="mt-4 border-t pt-4">
          <h4 className="text-md font-semibold mb-2">Improvement Tips:</h4>
          <p className="text-sm text-muted-foreground">{selectedBullet?.tips || "No tips available"}</p>
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
