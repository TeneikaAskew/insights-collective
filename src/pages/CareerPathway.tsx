
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCareerPathwayResults } from '@/hooks/useCareerPathwayResults';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { useToast } from '@/hooks/use-toast';

const CareerPathway: React.FC = () => {
  const navigate = useNavigate();
  const { data: report, isLoading, error, isError } = useCareerPathwayResults();
  const { isPageVisible } = usePageVisibility();
  const { toast } = useToast();
  
  // Check if the page is visible
  const pageIsVisible = isPageVisible('/career-pathway');

  // If page is not visible, render nothing or a coming soon message
  if (!pageIsVisible && !isError) {
    return (
      <AppLayout>
        <div className="container mx-auto py-6 px-4">
          <Card className="text-center p-6">
            <CardTitle className="mb-4">Coming Soon</CardTitle>
            <p className="text-muted-foreground mb-6">
              This feature is currently under development.
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // If there's an error or no report data found
  if (isError || (report && report.skillsAndCourses && report.skillsAndCourses.length === 0)) {
    return (
      <AppLayout>
        <div className="container mx-auto py-6 px-4">
          <Card className="text-center p-6">
            <CardTitle className="mb-4">No Career Report Found</CardTitle>
            <p className="text-muted-foreground mb-6">
              Please complete the career pathway chat to generate your personalized report.
            </p>
            <Button onClick={() => navigate('/career-agent')}>
              Take Career Assessment
            </Button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
            <CardContent className="py-10">
              <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
                <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileText className="h-10 w-10 text-blue-600" />
                </div>
                <h1 className="text-3xl font-bold">Hey {report?.userName || 'there'}, here are your career insights</h1>
                <p className="text-muted-foreground">
                  {report?.summary || 'Begin a journey of self-discovery to align your professional goals with your personal strengths and interests.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Skills Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Recommended Skills</CardTitle>
              <p className="text-sm text-muted-foreground">
                These recommendations are based on current market trends and the requirements of your desired roles.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {isLoading ? (
                  <SkillsSkeleton />
                ) : (
                  report?.skillsAndCourses && report.skillsAndCourses.length > 0 ? (
                    report.skillsAndCourses.map((skill, index) => (
                      <motion.div
                        key={`skill-${index}-${skill.skill}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded">
                            📚
                          </div>
                          <div>
                            <h3 className="font-medium">{skill.skill}</h3>
                            <span className="text-xs text-muted-foreground">{skill.level}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{skill.course}</p>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">No skill recommendations available yet.</p>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Career Path Section */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Path to Your Aspirational Role</CardTitle>
              <p className="text-sm text-muted-foreground">
                A clear path to your dream role—with a simple, step-by-step plan.
              </p>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="overflow-hidden">
                  {isLoading ? (
                    <CareerPathSkeleton />
                  ) : (
                    <div className="space-y-4">
                      {report?.careerPathSteps && report.careerPathSteps.length > 0 ? (
                        report.careerPathSteps.map((step, index) => (
                          <motion.div
                            key={`step-${index}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.2 }}
                            className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                          >
                            <div>
                              <h3 className="font-medium">{step.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-4">No career path steps available yet.</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="icon">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
};

const SkillsSkeleton = () => (
  <>
    {[1, 2, 3].map((i) => (
      <div key={i} className="p-4 bg-muted/50 rounded-lg">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
    ))}
  </>
);

const CareerPathSkeleton = () => (
  <>
    {[1, 2, 3].map((i) => (
      <div key={i} className="p-4 bg-muted/50 rounded-lg">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-full" />
      </div>
    ))}
  </>
);

export default CareerPathway;
