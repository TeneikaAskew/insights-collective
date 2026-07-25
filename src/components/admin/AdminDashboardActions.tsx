import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarPlus, Upload, FileSpreadsheet, Activity, BookOpen, FormInput } from 'lucide-react';
import { AddEventModal } from '@/components/events/modals/AddEventModal';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useCreateEvent } from '@/hooks/useEvents';

const adminActions = [
  {
    title: "Manage Courses",
    description: "Create, edit, and manage course content and assignments",
    icon: <BookOpen className="h-5 w-5" />,
    href: "/admin/courses",
    color: "bg-orange-100 dark:bg-orange-900",
    iconColor: "text-orange-600 dark:text-orange-300",
  },
  {
    title: "Form Management",
    description: "Create, edit, and manage forms and surveys",
    icon: <FormInput className="h-5 w-5" />,
    href: "/admin/unified-form-management",
    color: "bg-blue-100 dark:bg-blue-900",
    iconColor: "text-blue-600 dark:text-blue-300",
  },
];

export const AdminDashboardActions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const createEvent = useCreateEvent();

  // The old handler toasted "Event Added" without writing anything to the
  // database. Persist the event for real, and only report verified success.
  const handleAddEvent = async (eventData: any) => {
    try {
      const { id: _id, ...data } = eventData;
      await createEvent.mutateAsync(data);
      toast({
        title: 'Event Added',
        description: 'The event has been successfully added.',
      });
      setIsEventModalOpen(false);
      navigate('/admin/events');
    } catch (error: any) {
      toast({
        title: 'Failed to create event',
        description: error?.message || 'The event could not be saved.',
        variant: 'destructive',
      });
    }
  };
  
  // Note: Certificates are auto-issued by a Supabase trigger when a student
  // completes every published item in a course (see auto_issue_certificate_on_progression).
  // No manual "Issue Certificates" admin action is wired to the DB, so we intentionally
  // do not surface a button that would previously have fired a fake success toast.

  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button variant="outline" className="w-full justify-start" onClick={() => setIsEventModalOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            <span>Add Event</span>
          </Button>
          
          {isEventModalOpen && (
            <AddEventModal 
              open={isEventModalOpen}
              onAddEvent={handleAddEvent} 
              onClose={() => setIsEventModalOpen(false)}
            />
          )}
          


          
          <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/admin/unified-form-management')}>
            <FormInput className="mr-2 h-4 w-4" />
            <span>Manage Forms</span>
          </Button>
          
          <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/admin/courses')}>
            <Upload className="mr-2 h-4 w-4" />
            <span>New Course</span>
          </Button>
          
          <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/admin/users')}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            <span>Export User Data</span>
          </Button>
          
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link to="/admin/activity">
              <Activity className="mr-2 h-4 w-4" />
              <span>View Activity</span>
            </Link>
          </Button>
        </CardContent>
      </Card>
      
      {adminActions.map((action, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className={`${action.color} pb-2`}>
            <div className={`${action.iconColor} mb-2`}>
              {action.icon}
            </div>
            <CardTitle className="text-md font-semibold">{action.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <CardDescription className="mb-3">{action.description}</CardDescription>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate(action.href)}
            >
              Go to {action.title}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
