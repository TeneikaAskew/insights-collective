import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Briefcase, BookOpen, Users, FileText, TrendingUp } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCareerPathwayResults } from '@/hooks/useCareerPathwayResults';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

const CareerPathway: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: sections, isLoading, error, isError } = useCareerPathwayResults();
  
  console.log(data)
  console.log(report)
  const [activeCareerStep, setActiveCareerStep] = useState(0);

  // Get user name from available properties
  const userName = user?.user_metadata?.name || 
                  user?.email?.split('@')[0] || 
                  'there';
                
  // Career step carousel navigation
  const nextCareerStep = () => {
    if (report?.careerPathSteps && activeCareerStep < report.careerPathSteps.length - 1) {
      setActiveCareerStep(activeCareerStep + 1);
    }
  };

  const prevCareerStep = () => {
    if (activeCareerStep > 0) {
      setActiveCareerStep(activeCareerStep - 1);
    }
  };

  // If there's an error or no report data found
  if (isError || (report && report.skillsAndCourses && report.skillsAndCourses.length === 0)) {
    return (
      <AppLayout>
        <div className="container mx-auto py-6 px-4">
          <Card className="text-center p-6">
            <h2 className="text-xl font-bold mb-4">No Career Report Found</h2>
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
      <div className="container mx-auto py-8 px-4 space-y-8 max-w-6xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-6 mb-12"
        >
          <div className="h-24 w-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Users className="h-12 w-12 text-gray-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Hey {userName}, let's discuss your career insights.
          </h1>
          <p className="text-gray-600 max-w-3xl mx-auto">
            <strong>The foundation for building and advancing your career is a deep understanding of your core values, beliefs, personal strengths, and authentic interests. </strong>Through self-discovery, you can uncover what truly drives you, identify your natural talents, and recognize the principles that guide your decisions. This self-awareness becomes your compass for making career choices that not only lead to professional success but also create genuine fulfillment and alignment with who you are at your core
          </p>
        </motion.div>

        {/* Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white">
            <CardContent className="p-6">
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <p className="text-gray-700 leading-relaxed">
                  {report?.summary || 'Loading your personalized career insights...'}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Career Path Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Path to your aspirational role</h2>
            <p className="text-gray-600">
              {report?.userName}, we created a clear path to your dream role—with a simple, step-by-step plan to bring you closer to your ultimate professional future.
            </p>
          </div>

          <div className="relative bg-white rounded-lg shadow-sm">
            <div className="flex items-center overflow-hidden">
              <div className="p-6 w-32 flex-shrink-0 border-r">
                <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Briefcase className="h-8 w-8 text-gray-600" />
                </div>
                <p className="text-sm text-center mt-2 text-gray-600">Current Position</p>
              </div>

              <div className="flex items-center flex-grow overflow-x-auto p-6">
                {isLoading ? (
                  <CareerPathSkeleton />
                ) : (
                  report?.careerPathSteps?.map((step, index) => (
                    <div 
                      key={index}
                      className={`flex-shrink-0 w-64 px-4 transition-all duration-300 ${
                        index === activeCareerStep ? 'scale-105' : 'scale-95 opacity-75'
                      }`}
                    >
                      <Card className={index === activeCareerStep ? 'bg-blue-50 border-blue-200' : 'bg-white'}>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-gray-900">{step.title}</h3>
                          <p className="text-gray-500 text-sm mb-2 font-medium">$80-120K</p>
                          <p className="text-gray-600 text-sm">{step.description}</p>
                        </CardContent>
                      </Card>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button 
                variant="outline" 
                size="icon"
                onClick={prevCareerStep}
                disabled={activeCareerStep === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={nextCareerStep}
                disabled={!report?.careerPathSteps || activeCareerStep === report.careerPathSteps.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Next Steps */}
        {report?.careerPathSteps && report.careerPathSteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white">
              <CardContent className="p-6">
                <p className="text-gray-700">
                  Your next career steps should build upon your current foundation while steering towards your aspirational role. 
                  Initially, advancing from your current position to {report.careerPathSteps[0].title} can help bridge the gap 
                  between your current expertise and desired career path.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Roles Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#EEF2FF] p-8 rounded-lg"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Roles that might be right for you</h2>
              <p className="text-gray-600">
                These roles are suggested based on your transferable skills and interests—options you may have yet to consider but have the potential to be rewarding.
              </p>
            </div>
            <div className="hidden md:block h-48 w-48 flex-shrink-0">
              <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-20 w-20 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <AlternativeRolesSkeleton />
            ) : report?.recommendedRoles?.map((role, index) => (
              <Card key={index} className="bg-white">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="bg-gray-100 p-2 rounded">
                    <Briefcase className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{role.title}</h3>
                    <p className="text-gray-600 text-sm mb-1">{role.salaryRange || '$80-120K'}</p>
                    <p className="text-gray-600 text-sm">{role.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Skills Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Recommended skills</h2>
              <p className="text-gray-600">
                These recommendations are based on current market trends, your existing skill set, and the requirements of your desired roles or alternative options.
              </p>
            </div>
            <div className="hidden md:block h-32 w-32 flex-shrink-0">
              <div className="w-full h-full bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center">
                <BookOpen className="h-16 w-16 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 font-semibold border-b">
              <div className="col-span-4">Skill</div>
              <div className="col-span-8">Recommended Course</div>
            </div>
            {isLoading ? (
              <SkillsSkeleton />
            ) : report?.skillsAndCourses?.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 p-4 border-b hover:bg-gray-50 transition-colors">
                <div className="col-span-4 flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-gray-600" />
                  <div>
                    <div className="font-medium">{item.skill}</div>
                    <Badge variant="secondary" className="mt-1">{item.level || 'intermediate'}</Badge>
                  </div>
                </div>
                <div className="col-span-8 text-gray-600">{item.course}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Additional Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-white">
            <CardContent className="p-6">
              <p className="text-gray-700">
                To streamline your career transition and development, consider focusing on the skills recommended above. 
                These courses are carefully selected to help you build the necessary competencies for your target roles 
                while leveraging your existing strengths and experience.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Feedback Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center space-y-4"
        >
          <p className="text-gray-600">Was this information useful?</p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" className="px-8">Yes</Button>
            <Button variant="outline" className="px-8">No</Button>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

// Skeleton components
const SkillsSkeleton = () => (
  <>
    {[1, 2, 3].map((i) => (
      <div key={i} className="grid grid-cols-12 gap-4 p-4 border-b">
        <div className="col-span-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="col-span-8">
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    ))}
  </>
);

const CareerPathSkeleton = () => (
  <>
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex-shrink-0 w-64 px-4">
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    ))}
  </>
);

const AlternativeRolesSkeleton = () => (
  <>
    {[1, 2, 3].map((i) => (
      <Card key={i} className="bg-white">
        <CardContent className="p-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    ))}
  </>
);

export default CareerPathway;
