import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CareerTrack, getSkillLevel, getTrackPersona, getCourseRecommendations } from '@/data/careerQuizData';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, BarChart2, BarChart3, Brain, Database,
  Download, MessageCircle, Presentation, RefreshCw, Share2
} from 'lucide-react';
import { useCareerCoach } from '@/hooks/useCareerCoach';
import { useAuth } from '@/contexts/AuthContext';
import { storeQuizAttempt } from '@/services/quizService';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

interface QuizResultsProps {
  scores: Record<CareerTrack, number>;
  answers: Record<number, number | string>;
  onReset: () => void;
}

const QuizResults: React.FC<QuizResultsProps> = ({ scores, answers, onReset }) => {
  const { initiateCareerCoachChat, isProcessing } = useCareerCoach();
  const { isAuthenticated, storeRedirectPath } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (scores && answers) {
      localStorage.setItem('quizScores', JSON.stringify(scores));
      localStorage.setItem('quizAnswers', JSON.stringify(answers));
    }
  }, [scores, answers]);

  const topTracks = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([track, score]) => ({
      track: track as CareerTrack,
      score,
      level: getSkillLevel(score),
      persona: getTrackPersona(track as CareerTrack),
      courses: getCourseRecommendations(track as CareerTrack, getSkillLevel(score))
    }));

  const getTrackIcon = (track: CareerTrack) => {
    switch (track) {
      case 'AI/ML': return <Brain className="h-6 w-6 text-primary" />;
      case 'Analytics': return <BarChart3 className="h-6 w-6 text-primary" />;
      case 'Data Engineering': return <Database className="h-6 w-6 text-primary" />;
      case 'Business Intelligence': return <Presentation className="h-6 w-6 text-primary" />;
      default: return <BarChart2 className="h-6 w-6 text-primary" />;
    }
  };

  const getCareerRoleId = (track: CareerTrack): string => {
    switch (track) {
      case 'AI/ML': return 'machine-learning-engineer';
      case 'Analytics': return 'data-analyst';
      case 'Data Engineering': return 'data-engineer';
      case 'Business Intelligence': return 'bi-analyst';
      default: return 'data-scientist';
    }
  };

  const handleAuthRequiredAction = (action: () => void, redirectPath: string) => {
    if (!isAuthenticated) {
      storeRedirectPath(redirectPath);
      localStorage.setItem('quizScores', JSON.stringify(scores));
      localStorage.setItem('quizAnswers', JSON.stringify(answers));
      toast({ title: "Login Required", description: "Please log in to continue." });
      navigate('/login');
      return;
    }
    action();
  };

  const saveQuizResults = async () => {
    if (!isAuthenticated) return;
    setIsSaving(true);
    try {
      const quizAttemptId = await storeQuizAttempt(answers, scores);
      if (quizAttemptId) {
        toast({ title: "Quiz Results Saved", description: "Your quiz results have been saved." });
        localStorage.removeItem('quizScores');
        localStorage.removeItem('quizAnswers');
      }
    } catch (error) {
      console.error('Error saving quiz results:', error);
      toast({ title: "Error Saving Results", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
      setShowSaveDialog(false);
    }
  };

  const downloadResults = () => {
    const content = `
      Career Path Quiz Results

      ${topTracks.map((result, i) => `
      ${i + 1}. ${result.track} - Score: ${Math.round(result.score)} (${result.level})

      ${result.persona?.description || ''}

      Ideal For: ${result.persona?.idealFor || ''}

      Tools: ${result.persona?.tools?.join(', ')}

      Roles: ${result.persona?.sampleRoles?.join(', ')}

      Courses:
      ${result.courses.map(c => `- ${c.title}: ${c.description}`).join('\n')}
      `).join('\n\n')}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'career-path-quiz-results.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareResults = () => {
    handleAuthRequiredAction(() => setShowSaveDialog(true), '/quiz#results');
  };

  const handleCareerCoachClick = async () => {
    await initiateCareerCoachChat(answers, scores);
  };

  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Your Career Path Results</h2>
          <p className="text-muted-foreground">Here are the top data career paths based on your answers.</p>
          <div className="mt-6 mb-4">
            <Button onClick={handleCareerCoachClick} disabled={isProcessing} className="w-full sm:w-auto py-6 px-8">
              <MessageCircle className="h-5 w-5" /> Chat with Career Coach
              {isProcessing && <span className="ml-2 animate-spin">⏳</span>}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-4">
            <Button variant="outline" onClick={onReset}><RefreshCw className="h-4 w-4" /> Take Quiz Again</Button>
            <Button variant="outline" onClick={() => handleAuthRequiredAction(downloadResults, '/quiz#results')}><Download className="h-4 w-4" /> Download Results</Button>
            <Button variant="outline" onClick={shareResults}><Share2 className="h-4 w-4" /> Share Results</Button>
          </div>
        </div>

        <div className="space-y-6">
          {topTracks.map((result, i) => (
            <Card key={result.track} className={`border-t-4 ${i === 0 ? 'border-t-primary' : i === 1 ? 'border-t-blue-400' : 'border-t-blue-300'}`}>
              <CardHeader className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">{getTrackIcon(result.track)}<CardTitle>{result.track}</CardTitle></div>
                  <CardDescription>Match Score: {Math.round(result.score)} - {result.level}</CardDescription>
                </div>
                <div className="text-xl font-bold bg-primary/10 text-primary w-12 h-12 flex items-center justify-center rounded-full">#{i + 1}</div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Persona Profile</h4>
                    <p>{result.persona?.description}</p>
                    <h5 className="mt-3 font-medium">Ideal For</h5>
                    <p>{result.persona?.idealFor}</p>
                    <h5 className="mt-3 font-medium">Tools</h5>
                    <div className="flex flex-wrap gap-1">{result.persona?.tools.map(tool => <span key={tool} className="text-xs bg-secondary px-2 py-1 rounded-full">{tool}</span>)}</div>
                    <h5 className="mt-3 font-medium">Sample Roles</h5>
                    <div className="flex flex-wrap gap-1">
                      {result.persona?.sampleRoles.map(role => (
                        <Link key={role} to={`/explore-data-careers?role=${getCareerRoleId(result.track)}`} className="text-xs bg-secondary px-2 py-1 rounded-full">{role}</Link>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Recommended Courses</h4>
                    <div className="space-y-3">
                      {result.courses.map(course => (
                        <div key={course.id} className="p-3 bg-secondary/50 rounded-lg">
                          <h5 className="font-medium">{course.title}</h5>
                          <p className="text-sm">{course.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col md:flex-row gap-3">
                <Button asChild><Link to={`/courses?category=${result.track.toLowerCase().replace(/\\s+/g, '-')}`}>Browse {result.track} Courses <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild variant="outline"><Link to={`/explore-data-careers?role=${getCareerRoleId(result.track)}`}>Explore {result.track} Careers <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-10 text-center">
          <h3 className="text-xl font-semibold mb-2">Want to Explore More Career Options?</h3>
          <p className="text-muted-foreground mb-4">Discover roles, responsibilities, and paths across the data landscape.</p>
          <div className="flex justify-center gap-3">
            <Button asChild><Link to="/explore-data-careers">Explore All Careers</Link></Button>
            <Button asChild variant="outline"><Link to="/courses">Browse All Courses</Link></Button>
          </div>
        </div>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Your Results</DialogTitle>
            <DialogDescription>Would you like to save these results to your profile?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Not Now</Button>
            <Button onClick={saveQuizResults} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Results'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuizResults;
