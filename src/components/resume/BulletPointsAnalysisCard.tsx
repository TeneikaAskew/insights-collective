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
    return Math.round(bullet.word_balance.word_balance_score); // Average of all percentages
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
        word_balance_score: Math.min(25, (selectedBullet?.word_balance_score || 0) + 2),
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10 rounded-[26px]">
          <Loader2 className="animate-spin h-8 w-8 mb-4 text-primary" />
          <p className="text-lg font-medium text-foreground">
            {isAnalyzing ? "Analyzing your resume..." : "Generating improved bullet points..."}
          </p>
          <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
            Our AI is analyzing your resume bullets and creating enhanced versions with better metrics and action verbs.
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="ss-card relative">
      {renderLoadingOverlay()}
      <CardHeader className={`${isAnalyzing ? "opacity-50" : ""}`}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
          <div>
            <CardTitle className="text-lg sm:text-xl">Resume Storytelling Analysis</CardTitle>
            <CardDescription>Transform your experience into compelling stories</CardDescription>
          </div>
          <Tabs defaultValue={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'detail')}>
            <TabsList className="grid w-full grid-cols-2 gap-1 bg-transparent p-0">
              <TabsTrigger value="detail" className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground data-[state=active]:shadow-none">
                <FileText className="h-4 w-4 mr-1" />
                Detail
              </TabsTrigger>
              <TabsTrigger value="list" className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground data-[state=active]:shadow-none">
                <BookOpen className="h-4 w-4 mr-1" />
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Improved stats card grid with better centering */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
          <Card className="ss-tile">
            <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center h-full">
              <p className="text-xs sm:text-sm text-muted-foreground text-center mb-1">Total Bullets</p>
              <p className="text-xl sm:text-2xl font-bold text-ss-lav-deep">{bulletCount}</p>
            </CardContent>
          </Card>

          <Card className="ss-tile">
            <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center h-full">
              <p className="text-xs sm:text-sm text-muted-foreground text-center mb-1">XYZ Average</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{averageXYZScore}%</p>
            </CardContent>
          </Card>

          <Card className="ss-tile">
            <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center h-full">
              <p className="text-xs sm:text-sm text-muted-foreground text-center mb-1">Balance Rating</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{averageBalanceRating}%</p>
            </CardContent>
          </Card>

          <Card className="ss-tile">
            <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center h-full">
              <p className="text-xs sm:text-sm text-muted-foreground text-center mb-1">Strong Points</p>
              <p className="text-xl sm:text-2xl font-bold text-ss-good">{strongBullets}</p>
            </CardContent>
          </Card>

          <Card className="ss-tile">
            <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center h-full">
              <p className="text-xs sm:text-sm text-muted-foreground text-center mb-1">Need Work</p>
              <p className="text-xl sm:text-2xl font-bold text-ss-warn">{improvableBullets}</p>
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
                      className="w-full border border-input bg-background rounded-xl p-2"
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
                          {bullet?.original}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-background p-4 rounded-2xl border border-border">
                  <h3 className="text-lg font-medium mb-2">Original Bullet</h3>
                  <div className="text-foreground/80">
                    <HighlightedBulletText text={selectedBullet?.original || ''} />
                  </div>
                </div>

                <BulletPointChart bullet={displayBullet} />
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4">
                {/* Explanatory boxes for Word Balance and XYZ Quality */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
                  <div className="bg-ss-lav-chip border border-ss-lav/30 rounded-2xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                    <Scale className="h-5 w-5 sm:h-8 sm:w-8 text-ss-lav mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm sm:text-lg font-medium text-ss-lav-deep mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2 flex-wrap">
                        Word Balance Score:
                        <span className="font-bold">{selectedBullet?.word_balance?.word_balance_score ||  displayBullet?.word_balance?.word_balance_score || 0}%</span>
                      </h4>
                      <ul className="text-xs sm:text-sm text-foreground/75 space-y-0.5 sm:space-y-1 list-disc list-outside pl-4 sm:pl-5 text-left">
                        <li>Industry-specific terms: <span className="font-semibold">35-45%</span></li>
                        <li>Action words: <span className="font-semibold">10-15%</span></li>
                        <li>Metrics: <span className="font-semibold">10-15%</span></li>
                        <li>Common words: <span className="font-semibold">25-35%</span></li>
                      </ul>
                      <p className="text-xs text-muted-foreground mt-1 sm:mt-2 hidden sm:block">
                        A good balance creates compelling, professional content that resonates with both ATS systems and hiring managers.
                      </p>
                    </div>
                  </div>

                  <div className="bg-ss-good-chip border border-ss-good/30 rounded-2xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                    <BarChart2 className="h-5 w-5 sm:h-8 sm:w-8 text-ss-good mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm sm:text-lg font-medium text-ss-good mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2 flex-wrap">
                        XYZ Quality Score:
                        <span className="font-bold">{calculateXYZScore(displayBullet)}%</span>
                      </h4>
                      <ul className="text-xs sm:text-sm text-foreground/75 space-y-0.5 sm:space-y-1 list-disc list-outside pl-4 sm:pl-5 text-left">
                        <li>Action Words <span className="font-semibold">(10 pts)</span></li>
                        <li>Metrics/Results <span className="font-semibold">(30 pts)</span></li>
                        <li>Clarity/Conciseness <span className="font-semibold">(15 pts)</span></li>
                        <li>Industry Keywords <span className="font-semibold">(25 pts)</span></li>
                        <li>Achievement Focus <span className="font-semibold">(20 pts)</span></li>
                      </ul>
                      <p className="text-xs text-muted-foreground mt-1 sm:mt-2 hidden sm:block">
                        This framework ensures your bullet points tell compelling stories that demonstrate impact and expertise.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Word Balance</h3>
                    <div className="space-y-3">
                      {Object.entries(displayBullet?.word_balance || {}).filter(([key]) => key !== 'word_balance_score').map(([key, value]) => (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{key.replace('_pct', '')}</span>
                            <span className="font-medium">{value}%</span>
                          </div>
                          <div className="h-2 bg-ss-track rounded-full overflow-hidden">
                            <div
                              className="h-full bg-ss-lav rounded-full"
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
                      {Object.entries(displayBullet?.xyz_scores || {}).filter(([key]) => key !== 'xyz_total').map(([key, value]) => (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{XYZ_LABELS[key as keyof typeof XYZ_LABELS]}</span>
                            <span className="font-medium">{value}/{XYZ_MAX_SCORES[key as keyof typeof XYZ_MAX_SCORES]}</span>
                          </div>
                          <div className="h-2 bg-ss-track rounded-full overflow-hidden">
                            <div
                              className="h-full bg-ss-good rounded-full"
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
                <div className="bg-ss-good-chip border border-ss-good/30 rounded-2xl p-4">
                  <h3 className="text-lg font-medium mb-2 text-ss-good">AI Improved Version</h3>
                  <p className="text-foreground/80">
                    {displayBullet?.rewritten || "No improvements available yet"}
                  </p>
                </div>

                {(displayBullet?.rewritten && displayBullet.rewritten !== displayBullet.original) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Impact Analysis</h3>
                    <BulletPointChart bullet={{
                      ...displayBullet,
                      xyz_scores: displayBullet.improved_xyz_scores || displayBullet.xyz_scores,
                      bullet_total: displayBullet.improved_bullet_total || displayBullet.bullet_total,
                      word_balance: displayBullet.improved_word_balance || displayBullet.word_balance
                    }} />
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Improvement Tips</h3>
                  <div className="bg-ss-lav-chip border border-ss-lav/30 rounded-2xl p-4">
                    <ul className="list-disc list-inside space-y-2 text-foreground/80">
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
                    className="rounded-full font-bold"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Bullet Point
                  </Button>
                </div>

                {isEditing && (
                  <div className="space-y-4 bg-card border border-border rounded-2xl p-4">
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
                <BarChart2 className="h-4 w-4 text-ss-lav-deep" />
                <h3 className="font-medium">All Bullet Points ({bulletCount})</h3>
              </div>

              <select
                className="text-sm border border-input bg-background rounded-xl px-2 py-1"
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
