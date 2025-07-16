import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { User, Settings, LogOut, Save } from 'lucide-react';
import QuizResultsSection from '@/components/profile/QuizResultsSection';
import CareerPathwaySection from '@/components/profile/CareerPathwaySection';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { NotificationSettings } from '@/components/profile/NotificationSettings';
import { useProfileUpdate } from '@/hooks/useProfileUpdate';
import { supabase } from '@/integrations/supabase/client';
import { UserWithProfile } from '@/types/index';
import { useCareerPathwayResults } from '@/hooks/useCareerPathwayResults';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('Profile');

interface UserProfile {
  first_name: string;
  last_name: string;
  bio: string;
  notification_settings?: {
    email: boolean;
    browser: boolean;
    frequency: 'daily' | 'weekly' | 'never';
  };
}

const Profile = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { updateProfile, loading } = useProfileUpdate();
  const { toast } = useToast();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [formData, setFormData] = useState<UserProfile>({
    first_name: '',
    last_name: '',
    bio: '',
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [quizAnswers, setQuizAnswers] = useState<Record<string, string | number>>({});

  const { data: careerReportData, isLoading: careerReportLoading } = useCareerPathwayResults();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          const profileData = {
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            bio: data.bio || '',
          };
          setFormData(profileData);
        }
      };

      const fetchEnrolledCourses = async () => {
        const { data, error } = await supabase
          .from('enrollments')
          .select(`
            *,
            courses (*)
          `)
          .eq('user_id', user.id);

        if (data && !error) {
          setEnrolledCourses(data);
        }
      };

      const fetchQuizAnswers = async () => {
        const { data, error } = await supabase
          .from('career_pathway_answers')
          .select('answers')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.answers && !error) {
          setQuizAnswers(data.answers);
        }
      };

      fetchProfile();
      fetchEnrolledCourses();
      fetchQuizAnswers();
    }
  }, [user, isAuthenticated, navigate]);

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile(formData);
      setHasUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      logger.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile changes",
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences.
            </p>
          </div>
          <Button variant="outline" onClick={logout} className="text-destructive hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <ProfileAvatar />
                
                <div className="mt-4 flex flex-wrap gap-1 justify-center">
                  {user.roles?.map(role => (
                    <Badge key={role} variant={role === 'admin' ? 'destructive' : role === 'instructor' ? 'outline' : 'default'} className="capitalize">
                      {role}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="First Name"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Last Name"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Textarea
                    placeholder="Tell us about yourself"
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    className="resize-none"
                    rows={4}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={loading || !hasUnsavedChanges}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Configure how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationSettings
                  initialSettings={(user as any)?.notification_settings || {
                    email: true,
                    browser: true,
                    frequency: 'daily'
                  }}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card id="quiz-results">
              <CardHeader>
                <CardTitle>Career Path Quiz Results</CardTitle>
                <CardDescription>Your career path assessment and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <QuizResultsSection />
              </CardContent>
            </Card>

            <CareerPathwaySection pathwayAnswers={quizAnswers} />

            <Card>
              <CardHeader>
                <CardTitle>Enrolled Courses</CardTitle>
                <CardDescription>Your learning journey</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="active">
                  <TabsList>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="active" className="mt-4">
                    {enrolledCourses.length > 0 ? (
                      <div className="space-y-4">
                        {enrolledCourses.map((enrollment: any) => (
                          <div key={enrollment.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 overflow-hidden rounded-md">
                                <img 
                                  src={enrollment.courses?.thumbnail || '/placeholder.svg'} 
                                  alt={enrollment.courses?.title} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <h3 className="font-medium">{enrollment.courses?.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  Progress: {enrollment.completion_status || 0}%
                                </p>
                              </div>
                            </div>
                            <Button asChild variant="outline">
                              <a href={`/courses/${enrollment.course_id}`}>Continue</a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">You are not enrolled in any courses yet.</p>
                        <Button className="mt-4" asChild>
                          <a href="/courses">Browse Courses</a>
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="completed" className="mt-4">
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        You haven't completed any courses yet.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
