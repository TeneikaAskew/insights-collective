
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Clock, Upload, FileText, CheckCircle } from 'lucide-react';
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

  // Mock assignment data - in a real app, this would come from an API
  const assignment = {
    id: assignmentId,
    title: "Build a React Component",
    description: "Create a reusable React component that displays user information including name, email, and avatar. The component should be responsive and follow modern React patterns.",
    instructions: `
      <h3>Requirements:</h3>
      <ul>
        <li>Create a functional React component called UserCard</li>
        <li>Accept props for name, email, and avatar URL</li>
        <li>Include proper TypeScript typing</li>
        <li>Implement responsive design using Tailwind CSS</li>
        <li>Add hover effects and smooth transitions</li>
      </ul>
      
      <h3>Submission Guidelines:</h3>
      <ul>
        <li>Submit your complete component code</li>
        <li>Include any supporting CSS or styling</li>
        <li>Provide a brief explanation of your implementation choices</li>
      </ul>
    `,
    dueDate: "2024-01-15T23:59:59Z",
    points: 100,
    status: "Not Submitted",
    submittedWork: null,
    feedback: null,
    grade: null
  };

  const handleSubmit = async () => {
    if (!submission.trim()) {
      toast({
        title: "Error",
        description: "Please enter your submission before submitting.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    
    // Simulate submission
    setTimeout(() => {
      setSubmitting(false);
      toast({
        title: "Assignment submitted!",
        description: "Your assignment has been submitted successfully and will be reviewed.",
      });
    }, 1000);
  };

  const isOverdue = new Date() > new Date(assignment.dueDate);
  const daysUntilDue = Math.ceil((new Date(assignment.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  if (!courseId || !moduleId || !assignmentId) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Assignment Not Found</h1>
          <p className="text-muted-foreground mb-6">The assignment you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/courses">Back to Courses</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

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

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">{assignment.title}</CardTitle>
                  <Badge variant={
                    assignment.status === 'Graded' ? 'default' :
                    assignment.status === 'Submitted' ? 'secondary' :
                    isOverdue ? 'destructive' : 'outline'
                  }>
                    {assignment.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    <span>{assignment.points} points</span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Assignment Description</h3>
                  <p className="text-muted-foreground">{assignment.description}</p>
                </div>

                <div className="prose max-w-none">
                  <h3 className="text-lg font-semibold mb-4">Instructions</h3>
                  <div dangerouslySetInnerHTML={{ __html: assignment.instructions }} />
                </div>

                {assignment.status === 'Graded' ? (
                  <Card className="bg-secondary">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        Your Submission
                        <Badge variant="default">
                          {assignment.grade} / {assignment.points}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Submitted Work:</h4>
                          <div className="bg-background p-4 rounded-lg">
                            <pre className="whitespace-pre-wrap text-sm">{assignment.submittedWork}</pre>
                          </div>
                        </div>
                        
                        {assignment.feedback && (
                          <div>
                            <h4 className="font-medium mb-2">Instructor Feedback:</h4>
                            <div className="bg-background p-4 rounded-lg">
                              <p className="text-sm">{assignment.feedback}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : assignment.status === 'Submitted' ? (
                  <Card className="bg-secondary">
                    <CardContent className="p-6">
                      <div className="flex items-center text-green-600 mb-2">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <span className="font-medium">Assignment Submitted</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your assignment has been submitted and is awaiting review by the instructor.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Submit Your Assignment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        placeholder="Paste your code and explanation here..."
                        className="min-h-[200px] font-mono text-sm"
                        value={submission}
                        onChange={(e) => setSubmission(e.target.value)}
                      />
                      
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="flex-1">
                          <Upload className="h-4 w-4 mr-2" />
                          Attach Files
                        </Button>
                        <Button 
                          className="flex-1"
                          onClick={handleSubmit}
                          disabled={submitting || !submission.trim()}
                        >
                          {submitting ? "Submitting..." : "Submit Assignment"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Assignment Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Due Date</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(assignment.dueDate).toLocaleDateString()} at{' '}
                    {new Date(assignment.dueDate).toLocaleTimeString()}
                  </p>
                  {!isOverdue && daysUntilDue >= 0 && (
                    <p className="text-sm mt-1">
                      {daysUntilDue === 0 ? 'Due today' : `${daysUntilDue} days remaining`}
                    </p>
                  )}
                  {isOverdue && (
                    <p className="text-sm text-red-500 mt-1">Overdue</p>
                  )}
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Points</h4>
                  <p className="text-sm text-muted-foreground">{assignment.points} points possible</p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Status</h4>
                  <Badge variant={
                    assignment.status === 'Graded' ? 'default' :
                    assignment.status === 'Submitted' ? 'secondary' :
                    isOverdue ? 'destructive' : 'outline'
                  }>
                    {assignment.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AssignmentDetail;
