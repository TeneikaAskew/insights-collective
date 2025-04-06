
import React from 'react';
import { Link } from 'react-router-dom';
import { CareerTrack, getSkillLevel, getTrackPersona, getCourseRecommendations } from '@/data/careerQuizData';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart2, BarChart3, Brain, Database, Download, Presentation, RefreshCw, Share2 } from 'lucide-react';

interface QuizResultsProps {
  scores: Record<CareerTrack, number>;
  onReset: () => void;
}

const QuizResults: React.FC<QuizResultsProps> = ({ scores, onReset }) => {
  // Sort tracks by score (highest to lowest) and take top 3
  const topTracks = Object.entries(scores)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .slice(0, 3)
    .map(([track, score]) => ({
      track: track as CareerTrack,
      score: Math.round(score),
      level: getSkillLevel(Math.round(score)),
      persona: getTrackPersona(track as CareerTrack),
      courses: getCourseRecommendations(track as CareerTrack, getSkillLevel(Math.round(score)))
    }));

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

  // Helper function to map tracks to career roles
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

  const downloadResults = () => {
    // Simple implementation to create a text summary for download
    const content = `
      Career Path Quiz Results
      
      ${topTracks.map((result, index) => `
      ${index + 1}. ${result.track} - Score: ${result.score} (${result.level})
      
      ${result.persona?.description || ''}
      
      Ideal For: ${result.persona?.idealFor || ''}
      
      Recommended Tools: ${result.persona?.tools?.join(', ') || ''}
      
      Sample Roles: ${result.persona?.sampleRoles?.join(', ') || ''}
      
      Recommended Courses:
      ${result.courses.map(course => `- ${course.title}: ${course.description}`).join('\n')}
      `).join('\n\n')}
      
      Insights Collective - Career Path Quiz
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

  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Your Career Path Results</h2>
          <p className="text-muted-foreground">
            Based on your answers, here are the top data career paths you might excel in.
          </p>
          
          <div className="flex gap-3 justify-center mt-4">
            <Button variant="outline" onClick={onReset} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Take Quiz Again
            </Button>
            <Button variant="outline" onClick={downloadResults} className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Download Results
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Share Results
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {topTracks.map((result, index) => (
            <Card key={result.track} className={`animate-fade-in border-t-4 ${
              index === 0 ? 'border-t-primary' : 
              index === 1 ? 'border-t-blue-400' : 
              'border-t-blue-300'}`}
            >
              <CardHeader className="flex flex-row justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    {getTrackIcon(result.track)}
                    <CardTitle>{result.track}</CardTitle>
                  </div>
                  <CardDescription className="mt-1">
                    Match Score: {result.score} - {result.level} Level
                  </CardDescription>
                </div>
                <div className="bg-primary/10 text-primary font-bold text-xl rounded-full w-12 h-12 flex items-center justify-center">
                  #{index + 1}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Persona Profile</h4>
                    <p className="text-sm mb-4">{result.persona?.description}</p>
                    
                    <div className="space-y-3">
                      <div>
                        <h5 className="text-sm font-medium">Ideal For</h5>
                        <p className="text-sm text-muted-foreground">{result.persona?.idealFor}</p>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium">Key Tools</h5>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {result.persona?.tools.map(tool => (
                            <span key={tool} className="inline-flex text-xs bg-secondary px-2 py-1 rounded-full">
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium">Sample Roles</h5>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {result.persona?.sampleRoles.map(role => (
                            <Link 
                              key={role} 
                              to={`/explore-data-careers?role=${getCareerRoleId(result.track)}`}
                              className="inline-flex text-xs bg-secondary hover:bg-secondary/80 transition-colors px-2 py-1 rounded-full"
                            >
                              {role}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Recommended Courses</h4>
                    <div className="space-y-3">
                      {result.courses.map(course => (
                        <div key={course.id} className="p-3 bg-secondary/50 rounded-lg">
                          <h5 className="font-medium">{course.title}</h5>
                          <p className="text-sm text-muted-foreground">{course.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col md:flex-row gap-3">
                <Button asChild className="w-full md:w-auto">
                  <Link to={`/courses?category=${result.track.toLowerCase().replace(/\s+/g, '-')}`}>
                    Browse {result.track} Courses <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full md:w-auto">
                  <Link to={`/explore-data-careers?role=${getCareerRoleId(result.track)}`}>
                    Explore {result.track} Careers <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        <div className="mt-10 text-center">
          <h3 className="text-xl font-semibold mb-2">Want to Explore More Career Options?</h3>
          <p className="text-muted-foreground mb-4">
            Discover all data-related roles and find detailed information about day-to-day responsibilities, skills, and career paths.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link to="/explore-data-careers">Explore All Data Careers</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/courses">Browse All Courses</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizResults;
