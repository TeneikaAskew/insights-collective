
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarPlus, Award, Upload, FileSpreadsheet } from 'lucide-react';
import { AddEventModal } from '@/components/events/AddEventModal';
import { IssueCertificatesModal } from '@/components/admin/IssueCertificatesModal';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export const AdminDashboardActions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const handleAddEvent = (eventData: any) => {
    toast({
      title: 'Event Added',
      description: 'The event has been successfully added.',
    });
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
          <AddEventModal onAddEvent={handleAddEvent}>
            <Button variant="outline" className="w-full justify-start" asChild>
              <div>
                <CalendarPlus className="mr-2 h-4 w-4" />
                <span>Add Event</span>
              </div>
            </Button>
          </AddEventModal>
          
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
        </CardContent>
      </Card>
    </div>
  );
};
