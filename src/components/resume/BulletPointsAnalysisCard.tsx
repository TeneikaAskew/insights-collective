
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BulletAnalysis } from '@/components/assistants/types';
import BulletPointItem from './BulletPointItem';
import BulletPointChart from './BulletPointChart';
import { Check, Edit2, X, Loader2, BookOpen, FileText, Sparkles, BarChart2 } from 'lucide-react';
import { HighlightedBulletText } from './text/BulletTextParser';
import { ScoreWithIcon } from './chart/ChartComponents';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BulletPointsAnalysisCardProps {
  bullets: BulletAnalysis[];
  isAnalyzing?: boolean;
}

const BulletPointsAnalysisCard: React.FC<BulletPointsAnalysisCardProps> = ({
  bullets = [],
  isAnalyzing = false
}) => {
  const [selectedBulletIndex, setSelectedBulletIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [editedBullet, setEditedBullet] = useState<BulletAnalysis | null>(null);
  const [hasImprovements, setHasImprovements] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('detail');
  const [sortedBullets, setSortedBullets] = useState<BulletAnalysis[]>([]);
  const [sortMethod, setSortMethod] = useState<string>('score');

  useEffect(() => {
    if (bullets && bullets.length > 0) {
      const improvements = bullets.some(bullet => 
        bullet.rewritten && bullet.rewritten !== bullet.original
      );
      setHasImprovements(improvements);
      
      // Sort bullets based on the current sort method
      sortBullets(sortMethod);
    }
  }, [bullets]);

  const sortBullets = (method: string) => {
    const sorted = [...bullets];
    
    switch(method) {
      case 'score':
        sorted.sort((a, b) => (b?.bullet_total || 0) - (a?.bullet_total || 0));
        break;
      case 'improvement':
        sorted.sort((a, b) => {
          const aImproved = (a.rewritten && a.rewritten !== a.original) ? 1 : 0;
          const bImproved = (b.rewritten && b.rewritten !== b.original) ? 1 : 0;
          return bImproved - aImproved;
        });
        break;
      case 'length':
        sorted.sort((a, b) => (b?.original?.length || 0) - (a?.original?.length || 0));
        break;
      default:
        break;
    }
    
    setSortedBullets(sorted);
    setSortMethod(method);
  };

  if (!bullets || bullets.length === 0) {
    return <Card>
        <CardHeader>
          <CardTitle>Resume Bullet Analysis</CardTitle>
          <CardDescription>
            No bullet points found in your resume. Upload a resume with well-formatted bullet points to see detailed analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-gray-400">
          <p>No bullet points to analyze</p>
        </CardContent>
      </Card>;
  }

  const selectedBullet = bullets[selectedBulletIndex < bullets.length ? selectedBulletIndex : 0] || bullets[0];
  const displayBullet = editedBullet || selectedBullet;

  const handleEdit = () => {
    setEditedText(selectedBullet?.rewritten || selectedBullet?.original || "");
    setIsEditing(true);
  };

  const handleSave = () => {
    const improvedBullet = {
      ...selectedBullet,
      rewritten: editedText,
      bullet_total: Math.min(45, (selectedBullet?.bullet_total || 0) + 5),
      xyz_scores: {
        action: Math.min(10, (selectedBullet?.xyz_scores?.action || 0) + 1),
        metrics: Math.min(30, (selectedBullet?.xyz_scores?.metrics || 0) + 3),
        clarity: Math.min(15, (selectedBullet?.xyz_scores?.clarity || 0) + 2),
        industry: Math.min(25, (selectedBullet?.xyz_scores?.industry || 0) + 3),
        achievement: Math.min(20, (selectedBullet?.xyz_scores?.achievement || 0) + 1)
      },
      word_balance_score: Math.min(25, (selectedBullet?.word_balance_score || 0) + 2),
      word_balance: {
        industry_pct: Math.min(45, (selectedBullet?.word_balance?.industry_pct || 0) + 5),
        common_pct: Math.max(25, (selectedBullet?.word_balance?.common_pct || 0) - 2),
        action_pct: Math.min(15, (selectedBullet?.word_balance?.action_pct || 0) + 2),
        metric_pct: Math.min(15, (selectedBullet?.word_balance?.metric_pct || 0) + 2)
      }
    };
    setEditedBullet(improvedBullet);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const showImprovements = hasImprovements && !isAnalyzing;

  const getRewrittenText = () => {
    if (isAnalyzing) {
      return "Generating improvement...";
    }
    
    if (displayBullet?.rewritten && displayBullet.rewritten !== displayBullet.original) {
      return displayBullet.rewritten;
    }
    
    return "No improvements available yet";
  };

  const getTips = () => {
    if (isAnalyzing) {
      return "Analyzing your resume bullet points...";
    }
    
    if (displayBullet?.tips) {
      if (Array.isArray(displayBullet.tips)) {
        return displayBullet.tips.join('. ');
      }
      return displayBullet.tips;
    }
    
    return "Add more specific technical skills or leadership traits. Start with a stronger action verb and avoid passive language. Include quantifiable results (%, $, or other metrics). Make this more concise, aiming for 25 words or fewer.";
  };

  const renderLoadingOverlay = () => {
    if (isAnalyzing) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 rounded-lg">
          <Loader2 className="animate-spin h-8 w-8 mb-4 text-blue-600" />
          <p className="text-lg font-medium text-gray-700">
            {isAnalyzing ? "Analyzing your resume..." : "Generating improved bullet points..."}
          </p>
          <p className="text-sm text-gray-500 mt-2 text-center max-w-md">
            Our AI is analyzing your resume bullets and creating enhanced versions with better metrics and action verbs.
          </p>
        </div>
      );
    }
    return null;
  };

  const totalXYZScore = 
    (displayBullet?.xyz_scores?.action || 0) +
    (displayBullet?.xyz_scores?.metrics || 0) +
    (displayBullet?.xyz_scores?.clarity || 0) +
    (displayBullet?.xyz_scores?.industry || 0) +
    (displayBullet?.xyz_scores?.achievement || 0);

  // Calculate some metrics for the summary
  const bulletCount = bullets.length;
  const averageScore = Math.round(bullets.reduce((sum, bullet) => sum + (bullet?.bullet_total || 0), 0) / bulletCount);
  const improvableBullets = bullets.filter(b => (b?.bullet_total || 0) < 30).length;
  const strongBullets = bullets.filter(b => (b?.bullet_total || 0) >= 35).length;

  return (
    <Card className="relative">
      {renderLoadingOverlay()}
      <CardHeader className={`${isAnalyzing ? "opacity-50" : ""} flex flex-row items-center justify-between`}>
        <div>
          <CardTitle>Storytelling Analysis</CardTitle>
          <CardDescription>How effectively your resume tells your professional story</CardDescription>
        </div>
        <div>
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger 
              value="detail" 
              className={`${viewMode === 'detail' ? 'bg-[#9b87f5] text-white' : ''}`}
              onClick={() => setViewMode('detail')}
            >
              <FileText className="h-4 w-4 mr-1" />
              Detail
            </TabsTrigger>
            <TabsTrigger 
              value="list" 
              className={`${viewMode === 'list' ? 'bg-[#9b87f5] text-white' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <BookOpen className="h-4 w-4 mr-1" />
              All
            </TabsTrigger>
          </TabsList>
        </div>
      </CardHeader>
      
      <CardContent className={`space-y-6 ${isAnalyzing ? "opacity-50" : ""}`}>
        {viewMode === 'list' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart2 className="h-4 w-4 text-[#9b87f5]" />
                <h3 className="font-medium">Resume Bullet Points ({bulletCount})</h3>
              </div>
              
              <select 
                className="text-sm border rounded px-2 py-1" 
                value={sortMethod}
                onChange={(e) => sortBullets(e.target.value)}
              >
                <option value="score">Sort by Score</option>
                <option value="improvement">Sort by Improvement</option>
                <option value="length">Sort by Length</option>
              </select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 border border-green-100 rounded-md p-3 flex items-center space-x-3">
                <div className="bg-green-100 rounded-full p-1.5">
                  <Sparkles className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">Strong Bullets</p>
                  <p className="text-xs text-green-600">{strongBullets} bullet points</p>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-100 rounded-md p-3 flex items-center space-x-3">
                <div className="bg-amber-100 rounded-full p-1.5">
                  <Edit2 className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800">Need Improvement</p>
                  <p className="text-xs text-amber-600">{improvableBullets} bullet points</p>
                </div>
              </div>
            </div>
            
            <Accordion type="multiple" className="space-y-2">
              {sortedBullets.map((bullet, index) => (
                <BulletPointItem key={index} bullet={bullet} index={index} />
              ))}
            </Accordion>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Select a bullet point:</label>
              <select 
                className="w-full border rounded p-2 text-ellipsis overflow-hidden" 
                value={selectedBulletIndex} 
                onChange={e => {
                  setSelectedBulletIndex(parseInt(e.target.value));
                  setEditedBullet(null);
                  setIsEditing(false);
                }} 
                style={{
                  maxWidth: '100%',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                disabled={isAnalyzing}
              >
                {bullets.map((bullet, idx) => (
                  <option 
                    key={idx} 
                    value={idx} 
                    style={{
                      maxWidth: '100%',
                      whiteSpace: 'normal'
                    }}
                  >
                    {bullet?.original || `Bullet point ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="text-center py-2">
              <div className="mt-2 text-lg">
                <HighlightedBulletText text={selectedBullet?.original || ''} />
              </div>
            </div>
            
            {displayBullet && <BulletPointChart bullet={displayBullet} />}

            <div className="mt-6 border-t pt-4">
              <h4 className="text-lg font-semibold mb-4">Score Breakdown:</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-medium text-sm mb-2">Word Balance ({displayBullet?.word_balance_score || 0}/25)</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Industry:</span>
                      <span className="font-medium">{displayBullet?.word_balance?.industry_pct || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Common:</span>
                      <span className="font-medium">{displayBullet?.word_balance?.common_pct || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Action:</span>
                      <span className="font-medium">{displayBullet?.word_balance?.action_pct || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Metric:</span>
                      <span className="font-medium">{displayBullet?.word_balance?.metric_pct || 0}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-sm mb-2">XYZ Quality ({totalXYZScore}/100)</h5>
                  <div className="space-y-2">
                    <ScoreWithIcon score={displayBullet?.xyz_scores?.action || 0} maxScore={10} label="Action Words" />
                    <ScoreWithIcon score={displayBullet?.xyz_scores?.metrics || 0} maxScore={30} label="Metrics/Results" />
                    <ScoreWithIcon score={displayBullet?.xyz_scores?.clarity || 0} maxScore={15} label="Clarity/Conciseness" />
                    <ScoreWithIcon score={displayBullet?.xyz_scores?.industry || 0} maxScore={25} label="Industry Keywords" />
                    <ScoreWithIcon score={displayBullet?.xyz_scores?.achievement || 0} maxScore={20} label="Achievement Focus" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-6 border-t pt-4">
              <div>
                <h4 className="text-md font-semibold mb-2">Original:</h4>
                <div className="text-sm bg-slate-50 p-3 rounded">
                  <HighlightedBulletText text={displayBullet?.original || ''} />
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-semibold mb-2 flex items-center">
                  <span>Suggested Improvement:</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-2 h-6 p-1" 
                    onClick={isEditing ? undefined : handleEdit} 
                    disabled={isEditing || isAnalyzing || !hasImprovements}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </h4>
                
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea 
                      value={editedText} 
                      onChange={e => setEditedText(e.target.value)} 
                      className="min-h-[100px] text-sm" 
                      placeholder="Edit your bullet point here..." 
                    />
                    <div className="flex space-x-2 justify-end">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCancel} 
                        className="flex items-center"
                      >
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleSave} 
                        className="flex items-center"
                      >
                        <Check className="h-4 w-4 mr-1" /> Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 p-3 rounded text-gray-700">
                    {getRewrittenText()}
                  </div>
                )}
              </div>
            </div>
            
            {showImprovements && displayBullet?.rewritten && displayBullet.rewritten !== displayBullet.original && (
              <div className="mt-6 border-t pt-4">
                <div className="text-center mb-4">
                  <div className="text-lg">
                    <HighlightedBulletText text={displayBullet?.rewritten || ''} />
                  </div>
                </div>
                
                <BulletPointChart bullet={{
                  ...displayBullet,
                  original: displayBullet.rewritten,
                  bullet_total: Math.min(45, displayBullet.bullet_total + 10),
                  xyz_scores: {
                    action: Math.min(10, displayBullet.xyz_scores.action + 1),
                    metrics: Math.min(30, displayBullet.xyz_scores.metrics + 3),
                    clarity: Math.min(15, displayBullet.xyz_scores.clarity + 2),
                    industry: Math.min(25, displayBullet.xyz_scores.industry + 3),
                    achievement: Math.min(20, displayBullet.xyz_scores.achievement + 1)
                  },
                  word_balance_score: Math.min(25, displayBullet.word_balance_score + 5),
                  word_balance: {
                    industry_pct: Math.min(45, displayBullet.word_balance.industry_pct + 5),
                    common_pct: Math.max(25, displayBullet.word_balance.common_pct - 2),
                    action_pct: Math.min(15, displayBullet.word_balance.action_pct + 2),
                    metric_pct: Math.min(15, displayBullet.word_balance.metric_pct + 2)
                  }
                }} />
              </div>
            )}

            <div className="mt-6 border-t pt-4">
              <h4 className="text-md font-semibold mb-2">Improvement Tips:</h4>
              <p className="text-md text-slate-700">
                {getTips()}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BulletPointsAnalysisCard;
