// import React, { useState, useEffect } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import { CareerTrack, getSkillLevel, getTrackPersona, getCourseRecommendations } from '@/data/careerQuizData';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
// import { RefreshCw, ArrowRight, Download, Share2, MessageCircle } from 'lucide-react';
// import { useCareerCoach } from '@/hooks/useCareerCoach';
// import { useAuth } from '@/contexts/AuthContext';
// import { storeQuizAttempt } from '@/services/quizService';
// import { useToast } from '@/hooks/use-toast';
// import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// interface QuizResultsProps {
//   scores: Record<CareerTrack, number>;
//   answers: Record<number, number | string>;
//   onReset: () => void;
// }

// const QuizResults: React.FC<QuizResultsProps> = ({ scores, answers, onReset }) => {
//   const { initiateCareerCoachChat, isProcessing } = useCareerCoach();
//   const { isAuthenticated, storeRedirectPath } = useAuth();
//   const { toast } = useToast();
//   const navigate = useNavigate();
//   const [showSaveDialog, setShowSaveDialog] = useState(false);
//   const [isSaving, setIsSaving] = useState(false);

//   useEffect(() => {
//     localStorage.setItem('quizScores', JSON.stringify(scores));
//     localStorage.setItem('quizAnswers', JSON.stringify(answers));
//   }, [scores, answers]);

//   const topTracks = Object.entries(scores)
//     .sort(([, a], [, b]) => b - a)
//     .slice(0, 3)
//     .map(([track, score]) => ({
//       track: track as CareerTrack,
//       score: Math.round(score),
//       level: getSkillLevel(Math.round(score)),
//       persona: getTrackPersona(track as CareerTrack),
//       courses: getCourseRecommendations(track as CareerTrack, getSkillLevel(Math.round(score)))
//     }));

//   const getTrackIcon = (track: CareerTrack) => {
//     const iconMap = {
//       'AI/ML': <MessageCircle className="h-6 w-6 text-primary" />,
//       'Analytics': <Share2 className="h-6 w-6 text-primary" />,
//       'Data Engineering': <Download className="h-6 w-6 text-primary" />,
//       'Business Intelligence': <ArrowRight className="h-6 w-6 text-primary" />
//     };
//     return iconMap[track] || <ArrowRight className="h-6 w-6 text-primary" />;
//   };

//   const getCareerRoleId = (track: CareerTrack): string => {
//     switch (track) {
//       case 'AI/ML': return 'machine-learning-engineer';
//       case 'Analytics': return 'data-analyst';
//       case 'Data Engineering': return 'data-engineer';
//       case 'Business Intelligence': return 'bi-analyst';
//       default: return 'data-professional';
//     }
//   };

//   const handleAuthRequiredAction = (action: () => void, redirectPath: string) => {
//     if (!isAuthenticated) {
//       storeRedirectPath(redirectPath);
//       localStorage.setItem('quizScores', JSON.stringify(scores));
//       localStorage.setItem('quizAnswers', JSON.stringify(answers));
//       toast({ title: "Login Required", description: "Please log in to continue." });
//       navigate('/login');
//       return;
//     }
//     action();
//   };

//   const saveQuizResults = async () => {
//     if (!isAuthenticated) return;
//     setIsSaving(true);
//     try {
//       await storeQuizAttempt(answers, scores);
//       toast({ title: "Saved", description: "Your results have been saved." });
//       localStorage.removeItem('quizScores');
//       localStorage.removeItem('quizAnswers');
//     } catch (err) {
//       toast({ title: "Error", description: "Could not save results.", variant: "destructive" });
//     } finally {
//       setIsSaving(false);
//       setShowSaveDialog(false);
//     }
//   };

//   const downloadResults = () => {
//     const content = `
//       Quiz Results\\n\\n${topTracks.map(t => `
// ${t.track} - ${t.score} (${t.level})
// ${t.persona?.description}
// Tools: ${t.persona?.tools.join(', ')}
// Sample Roles: ${t.persona?.sampleRoles.join(', ')}
// Courses:
// ${t.courses.map(c => `- ${c.title}: ${c.description}`).join('\\n')}
//       `).join('\\n\\n')}
//     `.trim();
//     const blob = new Blob([content], { type: 'text/plain' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = 'career-quiz-results.txt';
//     document.body.appendChild(a);
//     a.click();
//     URL.revokeObjectURL(url);
//   };

//   return (
//     <div className="max-w-4xl mx-auto w-full">
//       <div className="text-center mb-10">
//         <h2 className="text-3xl font-bold">Your Career Path Results</h2>
//         <p className="text-muted-foreground">Based on your answers, here are your top career paths in data.</p>

//         <div className="mt-6 mb-4">
//           <Button onClick={() => initiateCareerCoachChat(answers, scores)} disabled={isProcessing} className="w-full sm:w-auto text-lg py-6 px-8 bg-primary/90 hover:bg-primary">
//             <MessageCircle className="h-5 w-5" /> Chat with Career Coach
//           </Button>
//         </div>

//         <div className="flex flex-wrap gap-3 justify-center mt-4">
//           <Button variant="outline" onClick={onReset}><RefreshCw className="h-4 w-4" /> Retake Quiz</Button>
//           <Button variant="outline" onClick={() => handleAuthRequiredAction(downloadResults, '/quiz#results')}><Download className="h-4 w-4" /> Download</Button>
//           <Button variant="outline" onClick={() => handleAuthRequiredAction(() => setShowSaveDialog(true), '/quiz#results')}><Share2 className="h-4 w-4" /> Share</Button>
//         </div>
//       </div>

//       {topTracks.map((result, index) => (
//         <Card key={result.track} className="mb-6 border-t-4 border-primary">
//           <CardHeader className="flex justify-between items-start">
//             <div>
//               <div className="flex items-center gap-2">{getTrackIcon(result.track)}<CardTitle>{result.track}</CardTitle></div>
//               <CardDescription>Match Score: {result.score} ({result.level})</CardDescription>
//             </div>
//             <div className="font-bold text-xl">#{index + 1}</div>
//           </CardHeader>
//           <CardContent>
//             <p className="text-sm mb-4">{result.persona?.description}</p>
//             <div className="grid md:grid-cols-2 gap-6">
//               <div>
//                 <h4 className="font-semibold text-lg mb-2">Ideal For</h4>
//                 <p>{result.persona?.idealFor}</p>
//                 <h4 className="mt-4 font-semibold text-lg mb-2">Tools</h4>
//                 <div className="flex flex-wrap gap-2">{result.persona?.tools.map(t => <span key={t} className="badge bg-ss-teal-chip text-ss-teal">{t}</span>)}</div>
//                 <h4 className="mt-4 font-semibold text-lg mb-2">Sample Roles</h4>
//                 <div className="flex flex-wrap gap-2">{result.persona?.sampleRoles.map(role => (
//                   <Link to={`/explore-data-careers?role=${getCareerRoleId(result.track)}`} key={role} className="badge bg-ss-teal-chip text-ss-teal">{role}</Link>
//                 ))}</div>
//               </div>
//               <div>
//                 <h4 className="font-semibold text-lg mb-2">Courses</h4>
//                 <ul className="space-y-2">{result.courses.map(course => (
//                   <li key={course.id} className="bg-muted p-3 rounded"><strong>{course.title}</strong><p className="text-sm bg-muted">{course.description}</p></li>
//                 ))}</ul>
//               </div>
//             </div>
//           </CardContent>
//           <CardFooter className="flex flex-wrap gap-2 mt-4">
//             <Button asChild><Link to={`/courses?category=${result.track.toLowerCase().replace(/\\s+/g, '-')}`}>Browse Courses <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
//             <Button variant="outline" asChild><Link to={`/explore-data-careers?role=${getCareerRoleId(result.track)}`}>Explore Careers <ArrowRight className="ml-2 h-4 w-4 aqua-teal" /></Link></Button>
//           </CardFooter>
//         </Card>
//       ))}

//       <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Save Quiz Results</DialogTitle>
//             <DialogDescription>Would you like to save your quiz results to your profile?</DialogDescription>
//           </DialogHeader>
//           <DialogFooter>
//             <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Not Now</Button>
//             <Button onClick={saveQuizResults} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Results'}</Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// };

// export default QuizResults;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CareerTrack, getSkillLevel, getTrackPersona, getCourseRecommendations, toMatchPercentage } from '@/data/careerQuizData';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart2, BarChart3, Brain, Database, Download, Loader2, MessageCircle, Presentation, RefreshCw, Share2 } from 'lucide-react';
import { useCareerCoach } from '@/hooks/useCareerCoach';
import { useAuth } from '@/contexts/AuthContext';
import { storeQuizAttempt } from '@/services/quizService';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { subjectsForRole } from '@/data/roleLearningPaths';
import { courseraCoursesForSubject, subjectIndexFor } from '@/data/courseraCatalog';
import { useCourseraCatalog } from '@/hooks/useCourseraCatalog';
import { resolvedFromCoursera } from '@/lib/skillCourseResolver';
import { CourseraCourseRow } from '@/components/learning/CourseraCourseRow';

import { createLogger } from '@/utils/logger';

const logger = createLogger('getTrackIcon');

/**
 * Top Coursera courses for a quiz track, rendered below the internal
 * Recommended Courses block. The track name is a category, and the role
 * paths' category fallback maps all four tracks to sensible subject lists —
 * no separate track table needed. One course per subject first (breadth),
 * then backfill by subject priority.
 */
const TrackCourseraCourses: React.FC<{ track: CareerTrack }> = ({ track }) => {
  const subjects = React.useMemo(() => subjectsForRole('quiz-track', track), [track]);
  const { catalog, error: courseraError, retry: retryCoursera } = useCourseraCatalog(subjects);

  const courses = React.useMemo(() => {
    const index = subjectIndexFor(catalog);
    const seen = new Set<string>();
    const picks = [];
    for (const subject of subjects) {
      if (picks.length >= 3) break;
      const course = courseraCoursesForSubject(subject, index).find((c) => !seen.has(c.url));
      if (!course) continue;
      seen.add(course.url);
      picks.push(resolvedFromCoursera(course, course.subjects.filter((s) => subjects.includes(s))));
    }
    if (picks.length < 3) {
      for (const course of courseraCoursesForSubject(subjects[0], index)) {
        if (picks.length >= 3) break;
        if (seen.has(course.url)) continue;
        seen.add(course.url);
        picks.push(resolvedFromCoursera(course, course.subjects.filter((s) => subjects.includes(s))));
      }
    }
    return picks;
  }, [catalog, subjects]);

  // A failed read used to be impossible to see here: the bundled catalog filled
  // `courses` and the section rendered as usual. Now the section would simply
  // vanish, which reads as "there are no Coursera courses for this track" — a
  // claim nobody made and the data does not support.
  if (courseraError) {
    return (
      <div
        className="mt-4 rounded-lg border border-ss-bad/40 bg-ss-bad-chip px-3 py-2.5 text-sm flex items-center justify-between gap-3"
        role="alert"
      >
        <span className="text-ss-bad">Couldn't load Coursera recommendations.</span>
        <Button variant="outline" size="sm" className="bg-card" onClick={retryCoursera}>
          Retry
        </Button>
      </div>
    );
  }

  if (courses.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="font-semibold mb-1">
        From Coursera <span className="text-sm font-normal text-muted-foreground">· external</span>
      </h4>
      <div className="space-y-2 mt-2">
        {courses.map((course) => (
          <CourseraCourseRow key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
};
interface QuizResultsProps {
  scores: Record<CareerTrack, number>;
  answers: Record<number, number | string>;
  onReset: () => void;
}
const QuizResults: React.FC<QuizResultsProps> = ({
  scores,
  answers,
  onReset
}) => {
  const {
    initiateCareerCoachChat,
    isProcessing
  } = useCareerCoach();
  const {
    isAuthenticated,
    storeRedirectPath
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  React.useEffect(() => {
    if (scores && answers) {
      localStorage.setItem('quizScores', JSON.stringify(scores));
      localStorage.setItem('quizAnswers', JSON.stringify(answers));
    }
  }, [scores, answers]);
  // `score * 5` assumed every track topped out at 20. The weights say otherwise
  // — the ceilings are 19 to 23 — so that arithmetic printed match scores above
  // 100% for the two tracks that can exceed 20 and understated the one that
  // cannot reach it. Normalize against each track's own maximum instead.
  const topTracks = Object.entries(scores).sort(([, a], [, b]) => b - a).slice(0, 3).map(([track, score]) => {
    const percentage = toMatchPercentage(track as CareerTrack, score);
    return {
      track: track as CareerTrack,
      score: percentage,
      level: getSkillLevel(percentage),
      persona: getTrackPersona(track as CareerTrack),
      courses: getCourseRecommendations(track as CareerTrack, getSkillLevel(percentage))
    };
  });
  const getTrackIcon = (track: CareerTrack) => {
    switch (track) {
      case 'AI/ML':
        return <Brain className="h-6 w-6 text-primary" />;
      case 'Analytics':
        return <BarChart3 className="h-6 w-6 text-primary" />;
      case 'Data Engineering':
        return <Database className="h-6 w-6 text-primary" />;
      case 'Business Intelligence':
        return <Presentation className="h-6 w-6 text-primary" />;
      default:
        return <BarChart2 className="h-6 w-6 text-primary" />;
    }
  };
  const getCareerRoleId = (track: CareerTrack): string => {
    switch (track) {
      case 'AI/ML':
        return 'machine-learning-engineer';
      case 'Analytics':
        return 'data-analyst';
      case 'Data Engineering':
        return 'data-engineer';
      case 'Business Intelligence':
        return 'bi-analyst';
      default:
        return 'data-scientist';
    }
  };
  const handleAuthRequiredAction = (action: () => void, redirectPath: string) => {
    if (!isAuthenticated) {
      storeRedirectPath(redirectPath);
      localStorage.setItem('quizScores', JSON.stringify(scores));
      localStorage.setItem('quizAnswers', JSON.stringify(answers));
      toast({
        title: "Login Required",
        description: "Please log in to continue."
      });
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
        toast({
          title: "Quiz Results Saved",
          description: "Your quiz results have been saved."
        });
        localStorage.removeItem('quizScores');
        localStorage.removeItem('quizAnswers');
      }
    } catch (error) {
      logger.error('Error saving quiz results:', error);
      toast({
        title: "Error Saving Results",
        description: "Please try again.",
        variant: "destructive"
      });
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
    const blob = new Blob([content], {
      type: 'text/plain'
    });
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
  return <div className="w-full">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Your Career Path Results</h2>
          <p className="text-muted-foreground">Here are the top data career paths based on your answers.</p>
          <div className="mt-6 mb-4">
            <Button onClick={handleCareerCoachClick} disabled={isProcessing} className="w-full sm:w-auto py-6 px-8">
              <MessageCircle className="h-5 w-5" /> Chat with Career Coach
              {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-4">
            <Button variant="outline" onClick={onReset}><RefreshCw className="h-4 w-4" /> Take Quiz Again</Button>
            <Button variant="outline" onClick={() => handleAuthRequiredAction(downloadResults, '/quiz#results')}><Download className="h-4 w-4" /> Download Results</Button>
            <Button variant="outline" onClick={shareResults}><Share2 className="h-4 w-4" /> Share Results</Button>
          </div>
        </div>

        <div className="space-y-6">
          {topTracks.map((result, i) => <Card key={result.track} className={`border-t-4 ${i === 0 ? 'border-t-primary' : i === 1 ? 'border-t-blue-400' : 'border-t-blue-300'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">{getTrackIcon(result.track)}<CardTitle>{result.track}</CardTitle></div>
                  <CardDescription>Match Score: {Math.round(result.score)} - {result.level}</CardDescription>
                  <div className="text-xl font-bold bg-primary/10 text-primary w-12 h-12 flex items-center justify-center rounded-full">#{i + 1}</div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Persona Profile</h4>
                    <p>{result.persona?.description}</p>
                    <h5 className="mt-3 font-semibold">Ideal For</h5>
                    <p>{result.persona?.idealFor}</p>
                    <h5 className="mt-3 fontsemibold">Tools</h5>
                    <div className="flex flex-wrap gap-1  ">{result.persona?.tools.map(tool => <span key={tool} className="text-xs bg-ss-teal-chip text-ss-teal px-2 py-1 rounded-full">{tool}</span>)}</div>
                    <h5 className="mt-3 font-semibold">Sample Roles</h5>
                    <div className="flex flex-wrap gap-1">
                      {result.persona?.sampleRoles.map(role => <Link key={role} to={`/explore-data-careers?role=${getCareerRoleId(result.track)}`} className="text-xs bg-ss-teal-chip text-ss-teal px-2 py-1 rounded-full">{role}</Link>)}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Recommended Courses</h4>
                    <div className="space-y-3">
                      {result.courses.map(course => <div key={course.id} className="p-3 bg-muted rounded-lg">
                          <h5 className="font-medium">{course.title}</h5>
                          <p className="text-sm">{course.description}</p>
                        </div>)}
                    </div>
                    <TrackCourseraCourses track={result.track} />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col md:flex-row gap-3">
                <Button asChild><Link to={`/courses?category=${result.track.toLowerCase().replace(/\\s+/g, '-')}`}>Browse {result.track} Courses <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild variant="outline"><Link to={`/explore-data-careers?role=${getCareerRoleId(result.track)}`}>Explore {result.track} Careers <ArrowRight className="ml-2 h-4 w-4 aqua-teal" /></Link></Button>
              </CardFooter>
            </Card>)}
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
    </div>;
};
export default QuizResults;