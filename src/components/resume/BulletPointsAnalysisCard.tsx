import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BulletAnalysis } from '@/components/assistants/types';
import { CheckCircle, AlertTriangle, Edit2 } from 'lucide-react';
import { HighlightedBulletText } from './text/BulletTextParser';
import BulletPointChart from './BulletPointChart';
import { WordBalanceDistribution } from './chart/WordBalanceDistribution';

interface BulletPointsAnalysisCardProps {
  bullets: BulletAnalysis[];
}

const BulletPointsAnalysisCard: React.FC<BulletPointsAnalysisCardProps> = ({
  bullets = [] // Provide default empty array
}) => {
  const [selectedBulletIndex, setSelectedBulletIndex] = useState(0);
  const componentKey = useMemo(() => {
    return `bullets-${bullets.length}-${JSON.stringify(bullets[0]?.bullet_total || 0)}-${Date.now()}`;
  }, [bullets]);

  console.log("BulletPointsAnalysisCard - Received bullets:", bullets);
  console.log("BulletPointsAnalysisCard - Component key:", componentKey);

  if (!bullets || bullets.length === 0) {
    console.log("BulletPointsAnalysisCard - No bullets available");
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

  console.log("BulletPointsAnalysisCard - Rendering with bullets:", bullets);
  
  const selectedBullet = bullets[selectedBulletIndex < bullets.length ? selectedBulletIndex : 0] || bullets[0];
  
  return (
    <Card className="w-full" key={componentKey}>
      <CardHeader>
        <CardTitle className="text-center">Resume Bullet Analysis</CardTitle>
        <CardDescription className="text-center">
          Comprehensive breakdown of your resume bullet points with improvement suggestions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Select bullet point to analyze:</label>
          <select 
            className="w-full border rounded p-2" 
            value={selectedBulletIndex} 
            onChange={e => setSelectedBulletIndex(parseInt(e.target.value))}
          >
            {bullets.map((bullet, idx) => (
              <option key={`bullet-option-${idx}-${Date.now()}`} value={idx}>
                {bullet?.original?.substring(0, 60) || `Bullet point ${idx + 1}`}...
              </option>
            ))}
          </select>
        </div>
        
        <div className="text-center py-2">
          <div className="mt-2 text-lg">
            <HighlightedBulletText text={selectedBullet?.original || ''} />
          </div>
        </div>
        
        {selectedBullet && (
          <div key={`chart-${selectedBulletIndex}-${Date.now()}`}>
            <BulletPointChart bullet={selectedBullet} />
          </div>
        )}
        
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
        
        {selectedBullet?.rewritten && (
          <div className="mt-6 border-t pt-4">
            <h4 className="text-md font-semibold mb-4">Suggested Improved Bullet Analysis Visualization:</h4>
            
            <div className="text-center mb-4">
              <div className="text-lg">
                <HighlightedBulletText text={selectedBullet?.rewritten || ''} />
              </div>
            </div>
            
            <BulletPointChart 
              bullet={{
                ...selectedBullet,
                original: selectedBullet.rewritten,
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
              }} 
            />
          </div>
        )}
        
        <div className="mt-6 border-t pt-4">
          <h4 className="text-lg font-semibold mb-4">Score Breakdown:</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium text-sm mb-2">Word Balance ({selectedBullet?.word_balance_score || 0}/25)</h5>
              <WordBalanceDistribution wordBalance={selectedBullet?.word_balance} />
            </div>
            
            <div>
              <h5 className="font-medium text-sm mb-2">XYZ Quality ({(selectedBullet?.xyz_scores?.hard_soft || 0) + (selectedBullet?.xyz_scores?.action_words || 0) + (selectedBullet?.xyz_scores?.measurable_results || 0) + (selectedBullet?.xyz_scores?.clarity_focus || 0)}/20)</h5>
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
        
        <div className="mt-6 border-t pt-4">
          <h4 className="text-md font-semibold mb-2">Improvement Tips:</h4>
          <p className="text-lg font-bold text-slate-950">
            {selectedBullet?.tips || "Add more specific technical skills or leadership traits. Start with a stronger action verb and avoid passive language. Include quantifiable results (%, $, or other metrics). Make this more concise, aiming for 25 words or fewer."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BulletPointsAnalysisCard;
