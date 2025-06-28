import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { mockService } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Clock, FileText, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AssignmentDetail = () => {
  const { courseId, moduleId, assignmentId } = useParams<{ 
    courseId: string; 
    moduleId: string; 
    assignmentId: string; 
  }>();
  const { toast } = useToast();
  const [submission, setSubmission] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const course = mockService.getCourseById(courseId || '');
  const module = mockService.getModuleById(moduleId || '');
  const assignment = module?.assignments.find(a => a.id === assignmentId);
  
  if (!course || !module || !assignment) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Assignment Not Found</h1>
          <p className="text-muted-foreground mb-6">The assignment you're looking for doesn't exist or has been removed.</p>
          <Button asChild>
            <Link to={`/courses/${courseId}/modules/${moduleId}`}>Back to Module</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }
  
  const handleSubmit = () => {
    if (!submission.trim()) {
      toast({
        title: "Error",
        description: "Please enter your submission",
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    
    setTimeout(() => {
      setSubmitting(false);
      setSubmission('');
      toast({
        title: "Assignment submitted",
        description: "Your submission has been received successfully",
      });
    }, 1000);
  };
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" className="mr-2" asChild>
            <Link to={`/courses/${courseId}/modules/${moduleId}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Module
            </Link>
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">{assignment.title}</CardTitle>
              <Badge variant={
                assignment.status === 'Graded' ? 'default' :
                assignment.status === 'Submitted' ? 'secondary' :
                assignment.status === 'In Progress' ? 'outline' : 'outline'
              }>
                {assignment.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>Due: {new Date(assignment.dueDate || '').toLocaleDateString()}</span>
              </div>
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-1" />
                <span>Points: {assignment.points}</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Assignment Description</h3>
              <p className="text-muted-foreground">{assignment.description}</p>
            </div>
            
            {assignment.status === 'Graded' || assignment.status === 'Submitted' ? (
              <div className="bg-secondary p-4 rounded-lg">
                <h4 className="font-medium mb-2">Your Submission</h4>
                <p className="text-sm mb-4">{assignment.submission?.content}</p>
                
                {assignment.status === 'Graded' && (
                  <div className="pt-4 border-t">
                    <div className="flex justify-between mb-2">
                      <h4 className="font-medium">Feedback</h4>
                      <span className="font-medium">{assignment.submission?.grade} / {assignment.points}</span>
                    </div>
                    <p className="text-sm">{assignment.submission?.feedback}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Your Submission</h4>
                  <Textarea 
                    placeholder="Enter your submission here..." 
                    className="min-h-[200px]"
                    value={submission}
                    onChange={(e) => setSubmission(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex gap-2">
            {assignment.status !== 'Graded' && assignment.status !== 'Submitted' && (
              <>
                <Button variant="outline" className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Attach Files
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit Assignment"}
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AssignmentDetail;