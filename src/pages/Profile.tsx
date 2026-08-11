import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Settings, LogOut, Save } from 'lucide-react';
import QuizResultsSection from '@/components/profile/QuizResultsSection';
import { MyCertificates } from '@/components/profile/MyCertificates';
import { Award } from 'lucide-react';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { NotificationSettings } from '@/components/profile/NotificationSettings';
import { useProfileUpdate } from '@/hooks/useProfileUpdate';
import { supabase } from '@/integrations/supabase/client';
import { UserWithProfile } from '@/types/index';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('Profile');

interface UserProfile {
  first_name: string;
  last_name: string;
  notification_settings?: {
    email: boolean;
    browser: boolean;
    frequency: 'daily' | 'weekly' | 'never';
  };
}

const Profile = () => {
  const { user, isAuthenticated, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { updateProfile, loading } = useProfileUpdate();
  const { toast } = useToast();
  const [formData, setFormData] = useState<UserProfile>({
    first_name: '',
    last_name: '',
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [profileReloadKey, setProfileReloadKey] = useState(0);

  useEffect(() => {
    // The /login bounce that used to live here is gone: /profile is wrapped in
    // ProtectedRoute now (src/App.tsx), which redirects synchronously and
    // preserves the return path, so an unauthenticated visitor never reaches
    // this component at all.
    //
    // What it replaces is worth recording. This effect had to sniff
    // localStorage for a persisted session and bail out if it found one,
    // because Supabase's getSession() can resolve to null a tick before
    // INITIAL_SESSION restores the session — so without that check a signed-in
    // user was kicked off their own profile during hydration. ProtectedRoute
    // waits on the auth context's own `loading` instead of guessing from
    // storage, which removes both the race and the guess.
    if (authLoading) return;
    if (!isAuthenticated) return;

    if (user) {
      const fetchProfile = async () => {
        setProfileLoadError(null);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          const profileData = {
            first_name: data.first_name || '',
            last_name: data.last_name || '',
          };
          setFormData(profileData);
        } else if (error) {
          // Block the form: rendering blank fields after a failed load would
          // let a save silently overwrite the user's real profile with blanks.
          logger.error('Error loading profile:', error);
          setProfileLoadError(error.message || 'Failed to load your profile');
        }
      };

      fetchProfile();
    }
  }, [user, isAuthenticated, authLoading, navigate, profileReloadKey]);

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

  if (profileLoadError) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <div className="border rounded-lg py-10 text-center" role="alert">
            <p className="text-destructive font-medium mb-1">Failed to load your profile</p>
            <p className="text-sm text-muted-foreground mb-4">{profileLoadError}</p>
            <Button variant="outline" onClick={() => setProfileReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

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
            <Card id="my-certificates" data-testid="my-certificates-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  My Certificates
                </CardTitle>
                <CardDescription>Course completion certificates with public verification codes.</CardDescription>
              </CardHeader>
              <CardContent>
                <MyCertificates />
              </CardContent>
            </Card>

            <Card id="quiz-results">
              <CardHeader>
                <CardTitle>Career Path Quiz Results</CardTitle>
                <CardDescription>Your career path assessment and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <QuizResultsSection />
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
