
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Course } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CourseSettingsProps {
  courseId?: string;
  course: Course | null;
}

export default function CourseSettings({ courseId, course }: CourseSettingsProps) {
  const [settings, setSettings] = useState({
    enableDiscussions: true,
    enableAutoEnrollment: false,
    certificateOnCompletion: true,
    autoFeedbackRequests: true,
    notifyOnEnrollment: true,
    slug: course?.title ? course.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '',
  });
  const [loading, setLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSwitchChange = (name: string, checked: boolean) => {
    setSettings(prev => ({ ...prev, [name]: checked }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = async () => {
    if (!courseId) return;
    
    setLoading(true);
    try {
      // In a real implementation, we would save these settings to the database
      // For this demo, we'll just simulate a successful save
      
      // const { error } = await supabase
      //   .from('course_settings')
      //   .upsert({
      //     course_id: courseId,
      //     enable_discussions: settings.enableDiscussions,
      //     enable_auto_enrollment: settings.enableAutoEnrollment,
      //     certificate_on_completion: settings.certificateOnCompletion,
      //     auto_feedback_requests: settings.autoFeedbackRequests,
      //     notify_on_enrollment: settings.notifyOnEnrollment,
      //     slug: settings.slug,
      //   });
      
      // if (error) throw error;
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Settings Saved',
        description: 'Course settings have been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseId) return;
    
    setLoading(true);
    try {
      // Delete the course
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);
      
      if (error) throw error;
      
      toast({
        title: 'Course Deleted',
        description: 'The course has been permanently deleted.',
      });
      
      // Navigate back to course list
      navigate('/admin/courses');
    } catch (error: any) {
      console.error('Error deleting course:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete course',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Course Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableDiscussions" className="text-base font-medium">
                    Enable Discussions
                  </Label>
                  <p className="text-sm text-gray-500">
                    Allow students to participate in course discussions
                  </p>
                </div>
                <Switch
                  id="enableDiscussions"
                  checked={settings.enableDiscussions}
                  onCheckedChange={(checked) => handleSwitchChange('enableDiscussions', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableAutoEnrollment" className="text-base font-medium">
                    Auto Enrollment
                  </Label>
                  <p className="text-sm text-gray-500">
                    Automatically enroll users based on role or group
                  </p>
                </div>
                <Switch
                  id="enableAutoEnrollment"
                  checked={settings.enableAutoEnrollment}
                  onCheckedChange={(checked) => handleSwitchChange('enableAutoEnrollment', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="certificateOnCompletion" className="text-base font-medium">
                    Certificate on Completion
                  </Label>
                  <p className="text-sm text-gray-500">
                    Issue certificates when students complete the course
                  </p>
                </div>
                <Switch
                  id="certificateOnCompletion"
                  checked={settings.certificateOnCompletion}
                  onCheckedChange={(checked) => handleSwitchChange('certificateOnCompletion', checked)}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoFeedbackRequests" className="text-base font-medium">
                    Automated Feedback Requests
                  </Label>
                  <p className="text-sm text-gray-500">
                    Automatically request feedback when modules are completed
                  </p>
                </div>
                <Switch
                  id="autoFeedbackRequests"
                  checked={settings.autoFeedbackRequests}
                  onCheckedChange={(checked) => handleSwitchChange('autoFeedbackRequests', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifyOnEnrollment" className="text-base font-medium">
                    Enrollment Notifications
                  </Label>
                  <p className="text-sm text-gray-500">
                    Notify instructors when new students enroll
                  </p>
                </div>
                <Switch
                  id="notifyOnEnrollment"
                  checked={settings.notifyOnEnrollment}
                  onCheckedChange={(checked) => handleSwitchChange('notifyOnEnrollment', checked)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-base font-medium">
                  Course URL Slug
                </Label>
                <Input
                  id="slug"
                  name="slug"
                  value={settings.slug}
                  onChange={handleInputChange}
                  placeholder="course-url-slug"
                />
                <p className="text-xs text-gray-500">
                  This will be used for the course URL: /courses/{settings.slug}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={loading}>
              {loading ? 'Saving...' : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-red-200">
        <CardHeader className="text-red-600">
          <CardTitle>Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="font-medium">Delete Course</h4>
              <p className="text-sm text-gray-500">
                This action cannot be undone. All course data will be permanently deleted.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Course
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the course
                    "{course?.title}" and remove all associated data including lessons, 
                    enrollments, and student progress.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="confirmText" className="text-base font-medium">
                    Type <span className="font-bold">DELETE</span> to confirm
                  </Label>
                  <Input
                    id="confirmText"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteCourse}
                    disabled={deleteConfirmText !== 'DELETE' || loading}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {loading ? 'Deleting...' : 'Delete Course'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
