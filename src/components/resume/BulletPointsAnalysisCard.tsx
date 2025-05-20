
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BulletAnalysis } from '@/components/assistants/types';
import BulletPointItem from './BulletPointItem';
import BulletPointChart from './BulletPointChart';
import { Check, Edit2, X, Loader2, BookOpen, FileText, Sparkles, BarChart2, Scale } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('impact');

  const XYZ_MAX_SCORES = {
    action: 10,
    metrics: 30,
    clarity: 15,
    industry: 25,
    achievement: 20
  };

  const XYZ_LABELS = {
    action: "Action Words",
    metrics: "Metrics/Results",
    clarity: "Clarity/Conciseness",
    industry: "Industry Keywords",
    achievement: "Achievement"
  };

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
        <CardTitle>Resume Storytelling Analysis</CardTitle>
        <CardDescription>
          No bullet points found in your resume. Upload a resume with well-formatted bullet points to see detailed analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-64 flex items-center justify-center text-gray-400">
        <p>No bullet points to analyze</p>
      </CardContent>
    </Card>;
  }

  // Calculate metrics
  const bulletCount = bullets.length;
  const calculateXYZScore = (bullet: BulletAnalysis) => 
    (bullet?.xyz_scores?.action || 0) +
    (bullet?.xyz_scores?.metrics || 0) +
    (bullet?.xyz_scores?.clarity || 0) +
    (bullet?.xyz_scores?.industry || 0) +
    (bullet?.xyz_scores?.achievement || 0);
    
  const averageXYZScore = Math.round(
    bullets.reduce((sum, bullet) => sum + calculateXYZScore(bullet), 0) / bulletCount
  );
  
  const getBalanceRating = (bullet: BulletAnalysis) => {
    if (!bullet?.word_balance) return 0;
    const balance = bullet.word_balance;
    const total = (balance.industry_pct || 0) + (balance.action_pct || 0) + 
                 (balance.metric_pct || 0) + (balance.common_pct || 0);
    return Math.round(total / 4); // Average of all percentages
  };
  
  const averageBalanceRating = Math.round(
    bullets.reduce((sum, bullet) => sum + getBalanceRating(bullet), 0) / bulletCount
  );
  
  const improvableBullets = bullets.filter(b => calculateXYZScore(b) < 80).length;
  const strongBullets = bullets.filter(b => calculateXYZScore(b) >= 80).length;
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
      bullet_total: Math.min(100, (selectedBullet?.bullet_total || 0) + 5),
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

  return (
    <Card className="relative">
      {renderLoadingOverlay()}
      <CardHeader className={`${isAnalyzing ? "opacity-50" : ""}`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <CardTitle>Resume Storytelling Analysis</CardTitle>
            <CardDescription>Transform your experience into compelling stories</CardDescription>
          </div>
          <Tabs defaultValue={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'detail')}>
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="detail" className={`${viewMode === 'detail' ? 'bg-[#9b87f5] text-white' : ''}`}>
                <FileText className="h-4 w-4 mr-1" />
                Detail
              </TabsTrigger>
              <TabsTrigger value="list" className={`${viewMode === 'list' ? 'bg-[#9b87f5] text-white' : ''}`}>
                <BookOpen className="h-4 w-4 mr-1" />
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Improved stats card grid with better centering */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-purple-50 border-purple-100">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full">
              <p className="text-sm font-medium text-purple-800 text-center mb-1">Total Bullets</p>
              <p className="text-2xl font-bold text-purple-900">{bulletCount}</p>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full">
              <p className="text-sm font-medium text-blue-800 text-center mb-1">XYZ Average</p>
              <p className="text-2xl font-bold text-blue-900">{averageXYZScore}%</p>
            </CardContent>
          </Card>

          <Card className="bg-indigo-50 border-indigo-100">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full">
              <p className="text-sm font-medium text-indigo-800 text-center mb-1">Balance Rating</p>
              <p className="text-2xl font-bold text-indigo-900">{averageBalanceRating}%</p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-100">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full">
              <p className="text-sm font-medium text-green-800 text-center mb-1">Strong Points</p>
              <p className="text-2xl font-bold text-green-900">{strongBullets}</p>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-100">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full">
              <p className="text-sm font-medium text-amber-800 text-center mb-1">Need Work</p>
              <p className="text-2xl font-bold text-amber-900">{improvableBullets}</p>
            </CardContent>
          </Card>
        </div>
      </CardHeader>

      <CardContent>
        {viewMode === 'detail' ? (
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                <TabsTrigger value="impact">Impact</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="improve">Improve</TabsTrigger>
              </TabsList>

              <TabsContent value="impact" className="space-y-4">
                <div className="flex space-x-4 items-start">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">Select a bullet point:</label>
                    <select 
                      className="w-full border rounded p-2"
                      value={selectedBulletIndex}
                      onChange={e => {
                        setSelectedBulletIndex(parseInt(e.target.value));
                        setEditedBullet(null);
                        setIsEditing(false);
                      }}
                      disabled={isAnalyzing}
                    >
                      {bullets.map((bullet, idx) => (
                        <option key={idx} value={idx}>
                          {bullet?.original?.substring(0, 100)}...
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Original Bullet</h3>
                  <div className="text-gray-700">
                    <HighlightedBulletText text={selectedBullet?.original || ''} />
                  </div>
                </div>

                <BulletPointChart bullet={displayBullet} />
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Word Balance</h3>
                    <div className="space-y-3">
                      {Object.entries(displayBullet?.word_balance || {}).map(([key, value]) => (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{key.replace('_pct', '')}</span>
                            <span className="font-medium">{value}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#9b87f5] rounded-full"
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">XYZ Quality</h3>
                    <div className="space-y-3">
                      {Object.entries(displayBullet?.xyz_scores || {}).map(([key, value]) => (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{XYZ_LABELS[key as keyof typeof XYZ_LABELS]}</span>
                            <span className="font-medium">{value}/{XYZ_MAX_SCORES[key as keyof typeof XYZ_MAX_SCORES]}</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#9b87f5] rounded-full"
                              style={{ width: `${(value/XYZ_MAX_SCORES[key as keyof typeof XYZ_MAX_SCORES]) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="improve" className="space-y-4">
                <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-2 text-green-800">AI Improved Version</h3>
                  <p className="text-gray-700">
                    {displayBullet?.rewritten || "No improvements available yet"}
                  </p>
                </div>

                {displayBullet?.rewritten && displayBullet.rewritten !== displayBullet.original && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Impact Analysis</h3>
                    <BulletPointChart bullet={{
                      ...displayBullet,
                      original: displayBullet.rewritten
                    }} />
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Improvement Tips</h3>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                      {Array.isArray(displayBullet?.tips) 
                        ? displayBullet.tips.map((tip, index) => (
                            <li key={index}>{tip}</li>
                          ))
                        : <li>{displayBullet?.tips || "No tips available"}</li>
                      }
                    </ul>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleEdit}
                    className="bg-[#9b87f5] hover:bg-[#8B5CF6] text-white"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Bullet Point
                  </Button>
                </div>

                {isEditing && (
                  <div className="space-y-4 bg-white border rounded-lg p-4">
                    <Textarea 
                      value={editedText}
                      onChange={e => setEditedText(e.target.value)}
                      className="min-h-[100px]"
                      placeholder="Edit your bullet point here..."
                    />
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={handleCancel}>
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                      <Button onClick={handleSave}>
                        <Check className="h-4 w-4 mr-1" /> Save Changes
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart2 className="h-4 w-4 text-[#9b87f5]" />
                <h3 className="font-medium">All Bullet Points ({bulletCount})</h3>
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
            
            <Accordion type="multiple" className="space-y-2">
              {sortedBullets.map((bullet, index) => (
                <BulletPointItem key={index} bullet={bullet} index={index} />
              ))}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BulletPointsAnalysisCard;
