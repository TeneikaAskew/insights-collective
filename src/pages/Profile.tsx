
import { useEffect, useState, ChangeEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { mockService } from '@/lib/mockData';
import { Bell, Lock, User, Settings, LogOut, Award, Upload } from 'lucide-react';
import QuizResultsSection from '@/components/profile/QuizResultsSection';
import CareerPathwaySection from '@/components/profile/CareerPathwaySection';
import { supabase } from '@/integrations/supabase/client';
import { quizQuestions } from '@/data/careerQuizData';

const Profile = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number | string>>({});

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to fetch profile', error);
      setProfileAvatarUrl(null);
    } else {
      if (data && data.avatar_url) {
        setProfileAvatarUrl(data.avatar_url);
      } else {
        setProfileAvatarUrl(null);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user, fetchUserProfile]);

  useEffect(() => {
    if (avatarFile) {
      const url = URL.createObjectURL(avatarFile);
      setAvatarPreview(url);
    } else {
      setAvatarPreview(profileAvatarUrl);
    }
  }, [avatarFile, profileAvatarUrl]);

  if (!user) return null;

  const enrolledCourses = mockService.getEnrolledCourses(user.id);

  const getInitial = (name?: string) => {
    return name && name.length > 0 ? name.charAt(0) : '?';
  };

  const getFirstName = () => {
    return user.name ? user.name.split(' ')[0] : '';
  };

  const getLastName = () => {
    return user.name ? user.name.split(' ').slice(1).join(' ') : '';
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;

    setUploadingAvatar(true);

    try {
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const filePath = `user-avatars/${user.id}/${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        alert('Failed to upload avatar. Please try again.');
        setUploadingAvatar(false);
        return;
      }

      const { data } = supabase.storage.from('user-avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update avatar_url error:', updateError);
        alert('Failed to update profile avatar. Please try again.');
        setUploadingAvatar(false);
        return;
      }

      await fetchUserProfile();
      setAvatarFile(null);
    } catch (err) {
      console.error('Unknown error uploading avatar:', err);
      alert('Unexpected error uploading avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAvatarFile(file);
    }
  };

  const handleAvatarReset = () => {
    setAvatarFile(null);
  };

  const handleAvatarSave = () => {
    if (avatarFile) {
      uploadAvatar(avatarFile);
    }
  };

  const careerAdvicePrompt = `Here are outputs from a career chat:
• A set of recommended roles with descriptions & salary bands
• A table of skills and matching courses
• A narrative of next-step career recommendations
• A 'Roles that might be right for you' list
• A 'Path to your aspirational role' carousel
Please combine these data points with the user’s quiz answers to generate a personalized career-advice report.`;

  const evaluateCareerAdvice = async (quizAnswersPayload: Record<number, number | string>) => {
    try {
      const payload = {
        prompt: careerAdvicePrompt,
        Quizquestions: quizQuestions,
        quizAnswers: quizAnswersPayload
      };

      const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (error) {
        console.error('Error invoking evaluateCareerAdvice:', error);
        setCareerAdviceReport('Failed to get career advice. Please try again later.');
        return;
      }

      const responseText = typeof data === 'string' ? data : (data && data.generatedText) || JSON.stringify(data);
      setCareerAdviceReport(responseText);
    } catch (err) {
      console.error('Unknown error invoking career advice function:', err);
      setCareerAdviceReport('Failed to get career advice. Please try again later.');
    }
  };

  useEffect(() => {
    if (Object.keys(quizAnswers).length === quizQuestions.length) {
      evaluateCareerAdvice(quizAnswers);
    }
  }, [quizAnswers]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          <Card className="md:sticky md:top-6 h-fit">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <Avatar className="h-24 w-24 mb-4">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} />
                  ) : (
                    <AvatarFallback className="text-xl">{getInitial(user.name)}</AvatarFallback>
                  )}
                </Avatar>
                <h2 className="text-xl font-semibold">{user.name || 'User'}</h2>
                <p className="text-muted-foreground">{user.email}</p>
                {user.role && (
                  <Badge className="mt-2">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Badge>
                )}
                {user.roles && user.roles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 justify-center">
                    {user.roles.map(role => (
                      <Badge key={role} variant={role === 'admin' ? 'destructive' : role === 'instructor' ? 'outline' : 'default'} className="capitalize">
                        {role}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="#account">
                    <User className="mr-2 h-4 w-4" />
                    Account
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="#quiz-results">
                    <Award className="mr-2 h-4 w-4" />
                    Quiz Results
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="#security">
                    <Lock className="mr-2 h-4 w-4" />
                    Security
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="#notifications">
                    <Bell className="mr-2 h-4 w-4" />
                    Notifications
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="#preferences">
                    <Settings className="mr-2 h-4 w-4" />
                    Preferences
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </CardContent>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Update Profile Image</CardTitle>
                <CardDescription>Select a new avatar or upload your own</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center space-y-4">
                  <Avatar className="h-20 w-20">
                    {avatarPreview ? (
                      <AvatarImage src={avatarPreview} />
                    ) : (
                      <AvatarFallback className="text-3xl">{getInitial(user.name)}</AvatarFallback>
                    )}
                  </Avatar>

                  <input
                    type="file"
                    accept="image/*"
                    id="avatar-upload"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                  <label
                    htmlFor="avatar-upload"
                    className={`cursor-pointer inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50
                      ${uploadingAvatar ? 'opacity-50 pointer-events-none' : ''}
                    `}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingAvatar ? 'Uploading...' : 'Choose Avatar'}
                  </label>
                  {avatarFile && (
                    <div className="flex space-x-2">
                      <Button onClick={handleAvatarReset} variant="outline" size="sm" disabled={uploadingAvatar}>Cancel</Button>
                      <Button onClick={handleAvatarSave} size="sm" disabled={uploadingAvatar}>Save</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Card>

          <div className="space-y-6">
            <Card id="account">
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input id="first-name" defaultValue={getFirstName()} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input id="last-name" defaultValue={getLastName()} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user.email} />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" defaultValue={user.bio || ''} className="resize-none" rows={4} />
                  <p className="text-xs text-muted-foreground">
                    This will be displayed on your profile.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button>Save Changes</Button>
              </CardFooter>
            </Card>
            
            <Card id="quiz-results">
              <CardHeader>
                <CardTitle>Career Path Quiz Results</CardTitle>
                <CardDescription>Your career path assessment and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <QuizResultsSection />
                <CareerPathwaySection quizAnswers={quizAnswers} />
              </CardContent>
            </Card>

            {careerAdviceReport && (
              <Card id="career-advice-report">
                <CardHeader>
                  <CardTitle>Personalized Career Advice</CardTitle>
                  <CardDescription>
                    Based on your quiz answers, here is your career advice report.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm text-gray-800">{careerAdviceReport}</div>
                </CardContent>
              </Card>
            )}
            
            <Card id="security">
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Update your password and security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Make sure your password is at least 8 characters and includes a mix of letters, numbers, and symbols.
                </p>
              </CardContent>
              <CardFooter>
                <Button>Update Password</Button>
              </CardFooter>
            </Card>

            <Card id="enrolled-courses">
              <CardHeader>
                <CardTitle>Enrolled Courses</CardTitle>
                <CardDescription>Your learning journey</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="active">
                  <TabsList>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                    <TabsTrigger value="all">All Courses</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="active" className="mt-4 space-y-4">
                    {enrolledCourses.length > 0 ? (
                      enrolledCourses.map((course) => (
                        <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 overflow-hidden rounded-md">
                              <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <h3 className="font-medium">{course.title}</h3>
                              <p className="text-sm text-muted-foreground">{course.instructor.name}</p>
                            </div>
                          </div>
                          <Button asChild>
                            <a href={`/courses/${course.id}`}>Continue</a>
                          </Button>
                        </div>
                      ))
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
                      <p className="text-muted-foreground">You haven't completed any courses yet.</p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="all" className="mt-4 space-y-4">
                    {enrolledCourses.length > 0 ? (
                      enrolledCourses.map((course) => (
                        <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 overflow-hidden rounded-md">
                              <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <h3 className="font-medium">{course.title}</h3>
                              <p className="text-sm text-muted-foreground">{course.instructor.name}</p>
                            </div>
                          </div>
                          <Button asChild>
                            <a href={`/courses/${course.id}`}>View</a>
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">You are not enrolled in any courses yet.</p>
                        <Button className="mt-4" asChild>
                          <a href="/courses">Browse Courses</a>
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card id="notifications">
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Configure how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <div>
                      <h4 className="font-medium">Email Notifications</h4>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <div>
                      <Button variant="outline">Configure</Button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center py-2">
                    <div>
                      <h4 className="font-medium">Browser Notifications</h4>
                      <p className="text-sm text-muted-foreground">Receive notifications in your browser</p>
                    </div>
                    <div>
                      <Button variant="outline">Configure</Button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center py-2">
                    <div>
                      <h4 className="font-medium">Notification Frequency</h4>
                      <p className="text-sm text-muted-foreground">How often you receive notifications</p>
                    </div>
                    <div>
                      <Button variant="outline">Configure</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="preferences">
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>Customize your learning experience</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <div>
                      <h4 className="font-medium">Language Preference</h4>
                      <p className="text-sm text-muted-foreground">Choose your preferred language</p>
                    </div>
                    <div>
                      <Button variant="outline">English</Button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center py-2">
                    <div>
                      <h4 className="font-medium">Time Zone</h4>
                      <p className="text-sm text-muted-foreground">Set your local time zone</p>
                    </div>
                    <div>
                      <Button variant="outline">UTC-8 (Pacific Time)</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button>Save Preferences</Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
