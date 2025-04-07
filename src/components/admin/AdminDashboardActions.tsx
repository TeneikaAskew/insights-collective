
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarPlus, Award, Upload, FileSpreadsheet, Activity } from 'lucide-react';
import { AddEventModal } from '@/components/events/modals/AddEventModal';
import { IssueCertificatesModal } from '@/components/admin/IssueCertificatesModal';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export const AdminDashboardActions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  
  const handleAddEvent = (eventData: any) => {
    toast({
      title: 'Event Added',
      description: 'The event has been successfully added.',
    });
    setIsEventModalOpen(false);
    navigate('/admin/events');
  };
  
  const handleIssueCertificates = (courseId: string, userIds: string[]) => {
    toast({
      title: 'Certificates Issued',
      description: `Successfully issued ${userIds.length} certificates.`,
    });
  };
  
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
              onAddEvent={handleAddEvent} 
              onClose={() => setIsEventModalOpen(false)}
            />
          )}
          
          <IssueCertificatesModal onIssueCertificates={handleIssueCertificates}>
            <Button variant="outline" className="w-full justify-start" asChild>
              <div>
                <Award className="mr-2 h-4 w-4" />
                <span>Issue Certificates</span>
              </div>
            </Button>
          </IssueCertificatesModal>
          
          <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/admin/courses')}>
            <Upload className="mr-2 h-4 w-4" />
            <span>Upload Course</span>
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
    </div>
  );
};
