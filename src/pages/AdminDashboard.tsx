
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { 
  Search, Plus, Users, BookOpen, Award, BarChart2, CheckCircle, 
  X, Download, FileEdit, UserPlus, TrendingUp, Clock, UserCheck,
  Calendar, BarChart, PieChart
} from 'lucide-react';
import { useCoursesManagement } from '@/hooks/useCoursesManagement';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, BarChart as RechartsBarChart, Bar, 
  PieChart as RechartsPieChart, Pie, Cell, Legend
} from 'recharts';
import { useToast } from '@/hooks/use-toast';

// Mock analytics data
const userActivityData = [
  { name: 'Jan', users: 65 },
  { name: 'Feb', users: 78 },
  { name: 'Mar', users: 90 },
  { name: 'Apr', users: 120 },
  { name: 'May', users: 150 },
  { name: 'Jun', users: 185 },
  { name: 'Jul', users: 210 },
];

const courseCompletionsData = [
  { name: 'Data Science', completions: 42 },
  { name: 'Analytics', completions: 28 },
  { name: 'Data Engineering', completions: 16 },
  { name: 'Machine Learning', completions: 35 },
];

const userRoleData = [
  { name: 'Students', value: 320 },
  { name: 'Instructors', value: 45 },
  { name: 'Admins', value: 15 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

const ActivityItem = ({ user, activity, time }: { user: any, activity: string, time: string }) => {
  if (!user) return null;
  
  return (
    <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-secondary">
      <Avatar className="h-10 w-10">
        <AvatarImage src={user?.avatar} />
        <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="text-sm"><span className="font-medium">{user?.name || 'User'}</span> {activity}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
};

const EditCourseDialog = ({ course, onSave }: { course: any, onSave: () => void }) => {
  const { toast } = useToast();
  
  const handleSave = () => {
    toast({
      title: "Course updated",
      description: "The course has been successfully updated.",
    });
    onSave();
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <FileEdit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
          <DialogDescription>
            Make changes to the course details, content, and settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="title" className="text-sm font-medium">Course Title</label>
            <Input id="title" defaultValue={course.title} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">Description</label>
            <textarea 
              id="description" 
              className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              defaultValue={course.description} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="category" className="text-sm font-medium">Category</label>
              <Input id="category" defaultValue={course.category} />
            </div>
            <div className="grid gap-2">
              <label htmlFor="level" className="text-sm font-medium">Level</label>
              <Input id="level" defaultValue={course.level} />
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Course Status</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input type="radio" name="status" defaultChecked={course.enrollmentStatus === 'Open'} />
                <span>Open</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="radio" name="status" defaultChecked={course.enrollmentStatus === 'Closed'} />
                <span>Closed</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="radio" name="status" defaultChecked={course.enrollmentStatus === 'In Progress'} />
                <span>In Progress</span>
              </label>
            </div>
          </div>
        </div>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="ghost" onClick={onSave}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </CardFooter>
      </DialogContent>
    </Dialog>
  );
};

const AddUserDialog = ({ onSave }: { onSave: () => void }) => {
  const { toast } = useToast();
  
  const handleSave = () => {
    toast({
      title: "User added",
      description: "The user has been successfully added to the platform.",
    });
    onSave();
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Enter the details for the new user or upload a CSV for batch import.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">Full Name</label>
            <Input id="name" placeholder="John Doe" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input id="email" type="email" placeholder="john.doe@ic.tech" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="role" className="text-sm font-medium">Role</label>
            <select id="role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Or Import Users</label>
            <div className="border border-dashed rounded-md p-6 text-center">
              <Button variant="outline" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV File
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                CSV format should include: name, email, role
              </p>
            </div>
          </div>
        </div>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="ghost" onClick={onSave}>Cancel</Button>
          <Button onClick={handleSave}>Add User</Button>
        </CardFooter>
      </DialogContent>
    </Dialog>
  );
};

const ManageCourseUsersDialog = ({ course, onSave }: { course: any, onSave: () => void }) => {
  const { toast } = useToast();
  
  const handleSave = () => {
    toast({
      title: "Users updated",
      description: "The course enrollment has been successfully updated.",
    });
    onSave();
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Users className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Manage Course Users</DialogTitle>
          <DialogDescription>
            Add or remove users enrolled in <span className="font-medium">{course.title}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-semibold">Current Enrolled Users (23)</h4>
            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Users
            </Button>
          </div>
          <div className="border rounded-md overflow-hidden">
            <div className="grid grid-cols-4 bg-muted p-2 text-xs font-medium">
              <div>User</div>
              <div>Role</div>
              <div>Enrolled Date</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="divide-y">
              <div className="grid grid-cols-4 p-2 text-sm items-center">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">John Doe</div>
                    <div className="text-xs text-muted-foreground">john.doe@ic.tech</div>
                  </div>
                </div>
                <div>Student</div>
                <div>Apr 1, 2025</div>
                <div className="text-right">
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-4 p-2 text-sm items-center">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>JS</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">Jane Smith</div>
                    <div className="text-xs text-muted-foreground">jane.smith@ic.tech</div>
                  </div>
                </div>
                <div>Student</div>
                <div>Apr 2, 2025</div>
                <div className="text-right">
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="ghost" onClick={onSave}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </CardFooter>
      </DialogContent>
    </Dialog>
  );
};

const IssueCertificateDialog = ({ onIssue }: { onIssue: () => void }) => {
  const { toast } = useToast();
  
  const handleIssue = () => {
    toast({
      title: "Certificate issued",
      description: "The certificate has been successfully issued to the user.",
    });
    onIssue();
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Award className="h-4 w-4 mr-2" />
          Issue Certificate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Certificate</DialogTitle>
          <DialogDescription>
            Issue a new certificate to a user who has completed a course.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="user" className="text-sm font-medium">Select User</label>
            <select id="user" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Select a user</option>
              <option value="user1">John Doe</option>
              <option value="user2">Jane Smith</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="course" className="text-sm font-medium">Select Course</label>
            <select id="course" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Select a course</option>
              <option value="course1">Introduction to Data Science</option>
              <option value="course2">Advanced Analytics</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="issueDate" className="text-sm font-medium">Issue Date</label>
            <Input id="issueDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="ghost" onClick={onIssue}>Cancel</Button>
          <Button onClick={handleIssue}>Issue Certificate</Button>
        </CardFooter>
      </DialogContent>
    </Dialog>
  );
};

const CreateCourseDialog = ({ onSave }: { onSave: () => void }) => {
  const { toast } = useToast();
  
  const handleSave = () => {
    toast({
      title: "Course created",
      description: "The new course has been successfully created.",
    });
    onSave();
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Course
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create New Course</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new course.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="details">Course Details</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="title" className="text-sm font-medium">Course Title</label>
              <Input id="title" placeholder="e.g. Introduction to Data Science" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="description" className="text-sm font-medium">Description</label>
              <textarea 
                id="description" 
                className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" 
                placeholder="Provide a detailed description of the course..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label htmlFor="category" className="text-sm font-medium">Category</label>
                <select id="category" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select category</option>
                  <option value="data-science">Data Science</option>
                  <option value="analytics">Analytics</option>
                  <option value="data-engineering">Data Engineering</option>
                  <option value="machine-learning">Machine Learning & AI</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="level" className="text-sm font-medium">Level</label>
                <select id="level" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label htmlFor="duration" className="text-sm font-medium">Duration</label>
                <Input id="duration" placeholder="e.g. 8 weeks" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="instructor" className="text-sm font-medium">Instructor</label>
                <select id="instructor" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select instructor</option>
                  <option value="instructor1">John Smith</option>
                  <option value="instructor2">Jane Doe</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="thumbnail" className="text-sm font-medium">Course Thumbnail</label>
              <div className="border border-dashed rounded-md p-6 text-center">
                <Button variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Recommended size: 1280x720 px (16:9 ratio)
                </p>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="modules" className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold">Course Modules</h4>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Module
              </Button>
            </div>
            <div className="border rounded-md p-4">
              <div className="flex justify-between mb-4">
                <div>
                  <h5 className="font-medium">Module 1: Introduction</h5>
                  <p className="text-sm text-muted-foreground">Week 1</p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm">
                    <FileEdit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <X className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 mb-4">
                <label htmlFor="mod-title" className="text-sm font-medium">Module Title</label>
                <Input id="mod-title" defaultValue="Introduction" />
              </div>
              <div className="grid gap-2 mb-4">
                <label htmlFor="mod-desc" className="text-sm font-medium">Description</label>
                <textarea 
                  id="mod-desc" 
                  className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  defaultValue="Foundation concepts and overview of the course."
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h6 className="text-sm font-medium">Content Items</h6>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">Add Lesson</Button>
                    <Button variant="outline" size="sm">Add Assignment</Button>
                    <Button variant="outline" size="sm">Add Quiz</Button>
                  </div>
                </div>
                <div className="pl-4 border-l border-muted pt-2 space-y-2">
                  <div className="flex justify-between items-center p-2 bg-accent/50 rounded-md">
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-sm">Introduction to the Course</span>
                    </div>
                    <Badge>Lesson</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-accent/50 rounded-md">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-sm">Welcome Quiz</span>
                    </div>
                    <Badge>Quiz</Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="settings" className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Enrollment Status</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input type="radio" name="enrollment-status" defaultChecked />
                  <span>Open</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="radio" name="enrollment-status" />
                  <span>Closed</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="radio" name="enrollment-status" />
                  <span>In Progress</span>
                </label>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Visibility</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input type="radio" name="visibility" defaultChecked />
                  <span>Public</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="radio" name="visibility" />
                  <span>Private</span>
                </label>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Completion Requirements</label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked />
                  <span>All lessons must be viewed</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked />
                  <span>All quizzes must be completed</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked />
                  <span>All assignments must be submitted</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" />
                  <span>Minimum grade of 70% required</span>
                </label>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Certificate</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input type="radio" name="certificate" defaultChecked />
                  <span>Issue certificate on completion</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="radio" name="certificate" />
                  <span>No certificate</span>
                </label>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <CardFooter className="flex justify-end space-x-2 mt-4">
          <Button variant="ghost" onClick={onSave}>Cancel</Button>
          <Button onClick={handleSave}>Create Course</Button>
        </CardFooter>
      </DialogContent>
    </Dialog>
  );
};

// Helper component for Upload icon 
const Upload = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" x2="12" y1="3" y2="15"></line>
  </svg>
);

const AdminDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('courses');
  const { toast } = useToast();
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    }
    
    // Set the active tab based on the URL
    if (location.pathname.includes('/admin/courses')) {
      setActiveTab('courses');
    } else if (location.pathname.includes('/admin/users')) {
      setActiveTab('users');
    } else if (location.pathname.includes('/admin/resources')) {
      setActiveTab('resources');
    } else if (location.pathname.includes('/admin/settings')) {
      setActiveTab('settings');
    } else if (location.pathname.includes('/admin/certificates')) {
      setActiveTab('certificates');
    }
  }, [isAuthenticated, user, navigate, location]);
  
  if (!user || user.role !== 'admin') return null;
  
  const { courses } = useCoursesManagement();
  const allCourses = courses;
  const allUsers = []; // TODO: Replace with real users data when available
  
  // Function to handle notifications for various actions
  const handleAction = (action: string, itemType: string) => {
    toast({
      title: `${action} successful`,
      description: `The ${itemType} has been ${action.toLowerCase()}d successfully.`,
    });
  };
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage courses, users, and platform settings.
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{allUsers.length}</div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Total Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{allCourses.length}</div>
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Active Enrollments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">423</div>
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Certificates Issued</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">87</div>
                <Award className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Platform Analytics</CardTitle>
                  <CardDescription>Overview of key platform metrics</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="users">
                <TabsList className="mb-4">
                  <TabsTrigger value="users">User Activity</TabsTrigger>
                  <TabsTrigger value="courses">Course Completions</TabsTrigger>
                  <TabsTrigger value="demographics">User Demographics</TabsTrigger>
                </TabsList>
                
                <TabsContent value="users">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={userActivityData}
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="users" stroke="#8884d8" activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between mt-4 text-sm">
                    <div className="flex items-center">
                      <TrendingUp className="h-4 w-4 mr-1 text-emerald-500" />
                      <span>Active users increased by 24% this month</span>
                    </div>
                    <div className="flex items-center">
                      <UserCheck className="h-4 w-4 mr-1 text-blue-500" />
                      <span>210 new registrations</span>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="courses">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={courseCompletionsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="completions" fill="#8884d8" />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between mt-4 text-sm">
                    <div className="flex items-center">
                      <BarChart className="h-4 w-4 mr-1 text-emerald-500" />
                      <span>Data Science is the most completed course category</span>
                    </div>
                    <div className="flex items-center">
                      <Award className="h-4 w-4 mr-1 text-amber-500" />
                      <span>87 certificates issued</span>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="demographics">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={userRoleData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                          dataKey="value"
                        >
                          {userRoleData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <RechartsTooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between mt-4 text-sm">
                    <div className="flex items-center">
                      <PieChart className="h-4 w-4 mr-1 text-blue-500" />
                      <span>Students make up 84% of platform users</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-purple-500" />
                      <span>Most active during weekdays</span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest platform interactions</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/activity">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allUsers.length > 0 && allCourses.length > 0 && (
                  <>
                    <ActivityItem 
                      user={allUsers[0]} 
                      activity={`enrolled in ${allCourses[0]?.title || 'Course'}`}
                      time="2 hours ago"
                    />
                    
                    {allUsers.length > 1 && (
                      <ActivityItem 
                        user={allUsers[1]}
                        activity={`created a new course ${allCourses.length > 2 ? allCourses[2]?.title : allCourses[0]?.title || 'Course'}`}
                        time="5 hours ago"
                      />
                    )}
                    
                    {allUsers.length > 0 && allCourses.length > 1 && (
                      <ActivityItem 
                        user={allUsers[0]}
                        activity={`completed a module in ${allCourses[1]?.title || 'Course'}`}
                        time="Yesterday"
                      />
                    )}
                    
                    <ActivityItem 
                      user={{name: "Admin User", avatar: null}}
                      activity={`issued a certificate to ${allUsers[0]?.name || 'User'}`}
                      time="2 days ago"
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="courses">Manage Courses</TabsTrigger>
            <TabsTrigger value="users">Manage Users</TabsTrigger>
            <TabsTrigger value="resources">Manage Resources</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="courses" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search courses..." />
              </div>
              <CreateCourseDialog onSave={() => handleAction('Create', 'course')} />
            </div>
            
            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 text-sm font-medium">Course</th>
                        <th className="text-left p-4 text-sm font-medium">Instructor</th>
                        <th className="text-left p-4 text-sm font-medium">Enrollment</th>
                        <th className="text-left p-4 text-sm font-medium">Status</th>
                        <th className="text-right p-4 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allCourses.map((course) => (
                        <tr key={course.id} className="border-b hover:bg-secondary/50">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-md overflow-hidden">
                                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <p className="font-medium">{course.title}</p>
                                <p className="text-xs text-muted-foreground">{course.category}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={course.instructor.avatar} />
                                <AvatarFallback>{course.instructor.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span>{course.instructor.name}</span>
                            </div>
                          </td>
                          <td className="p-4">{course.enrollmentCount} students</td>
                          <td className="p-4">
                            <Badge variant={
                              course.enrollmentStatus === 'open' ? 'default' :
                              course.enrollmentStatus === 'closed' ? 'secondary' : 'outline'
                            }>
                              {course.enrollmentStatus}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <EditCourseDialog 
                                course={course} 
                                onSave={() => handleAction('Update', 'course')} 
                              />
                              <ManageCourseUsersDialog 
                                course={course} 
                                onSave={() => handleAction('Update', 'course users')} 
                              />
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleAction('Delete', 'course')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="users" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search users..." />
              </div>
              <AddUserDialog onSave={() => handleAction('Add', 'user')} />
            </div>
            
            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 text-sm font-medium">User</th>
                        <th className="text-left p-4 text-sm font-medium">Email</th>
                        <th className="text-left p-4 text-sm font-medium">Role</th>
                        <th className="text-left p-4 text-sm font-medium">Status</th>
                        <th className="text-right p-4 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-secondary/50">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-xs text-muted-foreground">User ID: {user.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">{user.email}</td>
                          <td className="p-4">
                            <Badge variant="outline">
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge variant="secondary">Active</Badge>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleAction('Edit', 'user')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                </svg>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleAction('Delete', 'user')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="resources" className="space-y-6 mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configure Resources Page</CardTitle>
                  <CardDescription>
                    Manage the content and resources displayed on the public resources page
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Featured Resources</CardTitle>
                        <CardDescription>
                          Manage which resources are highlighted on the resources page
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Data Science Bootcamp</p>
                              <p className="text-sm text-muted-foreground">Training • Featured</p>
                            </div>
                            <Button variant="outline" size="sm">Edit</Button>
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">ML Conference 2025</p>
                              <p className="text-sm text-muted-foreground">Event • Featured</p>
                            </div>
                            <Button variant="outline" size="sm">Edit</Button>
                          </div>
                          <Button className="w-full" variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Featured Resource
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Resource Categories</CardTitle>
                        <CardDescription>
                          Configure available categories for resource organization
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Training Programs</p>
                              <p className="text-sm text-muted-foreground">12 resources</p>
                            </div>
                            <Button variant="outline" size="sm">Manage</Button>
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Events & Conferences</p>
                              <p className="text-sm text-muted-foreground">8 resources</p>
                            </div>
                            <Button variant="outline" size="sm">Manage</Button>
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Career Opportunities</p>
                              <p className="text-sm text-muted-foreground">15 resources</p>
                            </div>
                            <Button variant="outline" size="sm">Manage</Button>
                          </div>
                          <Button className="w-full" variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Category
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Page Settings</CardTitle>
                      <CardDescription>
                        Configure the appearance and behavior of the resources page
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="page-title" className="text-sm font-medium">Page Title</label>
                          <Input id="page-title" defaultValue="Resources & Opportunities" />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="page-subtitle" className="text-sm font-medium">Page Subtitle</label>
                          <Input id="page-subtitle" defaultValue="Discover training programs, events, and career opportunities" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="page-description" className="text-sm font-medium">Page Description</label>
                        <textarea 
                          id="page-description" 
                          className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                          defaultValue="Explore our curated collection of data science resources, training programs, industry events, and career opportunities to advance your data science journey."
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline">Preview Changes</Button>
                        <Button>Save Settings</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Quick Actions</CardTitle>
                      <CardDescription>
                        Common resource management tasks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Button className="w-full" variant="outline">
                          <BarChart className="h-4 w-4 mr-2" />
                          View Analytics
                        </Button>
                        <Button className="w-full" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Export Resources
                        </Button>
                        <Button className="w-full" variant="outline">
                          <Plus className="h-4 w-4 mr-2" />
                          Bulk Import
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </div>
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search resources..." />
              </div>
              <Button onClick={() => handleAction('Add', 'resource')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Resource
              </Button>
            </div>
            
            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 text-sm font-medium">Name</th>
                        <th className="text-left p-4 text-sm font-medium">Category</th>
                        <th className="text-left p-4 text-sm font-medium">Added Date</th>
                        <th className="text-left p-4 text-sm font-medium">Status</th>
                        <th className="text-right p-4 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-secondary/50">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <p className="font-medium">Data Science Certification Guide</p>
                            <p className="text-xs text-muted-foreground">Comprehensive guide to data science certification paths</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">Training</Badge>
                        </td>
                        <td className="p-4">Apr 1, 2025</td>
                        <td className="p-4">
                          <Badge variant="default">Published</Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleAction('Edit', 'resource')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                              </svg>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleAction('Delete', 'resource')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-secondary/50">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <p className="font-medium">Advanced Analytics Workshop</p>
                            <p className="text-xs text-muted-foreground">Workshop materials for advanced analytics techniques</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">Event</Badge>
                        </td>
                        <td className="p-4">Mar 15, 2025</td>
                        <td className="p-4">
                          <Badge variant="default">Published</Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleAction('Edit', 'resource')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                              </svg>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleAction('Delete', 'resource')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="certificates" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search certificates..." />
              </div>
              <IssueCertificateDialog onIssue={() => handleAction('Issue', 'certificate')} />
            </div>
            
            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 text-sm font-medium">ID</th>
                        <th className="text-left p-4 text-sm font-medium">User</th>
                        <th className="text-left p-4 text-sm font-medium">Course</th>
                        <th className="text-left p-4 text-sm font-medium">Issue Date</th>
                        <th className="text-right p-4 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-secondary/50">
                        <td className="p-4">CERT-001</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>J</AvatarFallback>
                            </Avatar>
                            <span>John Doe</span>
                          </div>
                        </td>
                        <td className="p-4">Introduction to Data Science</td>
                        <td className="p-4">Apr 2, 2025</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleAction('Download', 'certificate')}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleAction('Revoke', 'certificate')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-secondary/50">
                        <td className="p-4">CERT-002</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>J</AvatarFallback>
                            </Avatar>
                            <span>Jane Smith</span>
                          </div>
                        </td>
                        <td className="p-4">Data Science Fundamentals</td>
                        <td className="p-4">Mar 15, 2025</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleAction('Download', 'certificate')}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleAction('Revoke', 'certificate')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Settings</CardTitle>
                <CardDescription>
                  Configure global settings for the Insights Collective platform.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">General Settings</h3>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <label htmlFor="platform-name" className="text-sm font-medium">Platform Name</label>
                      <Input id="platform-name" defaultValue="Insights Collective" />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="contact-email" className="text-sm font-medium">Contact Email</label>
                      <Input id="contact-email" defaultValue="info@ic.tech" />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="timezone" className="text-sm font-medium">Default Timezone</label>
                      <select id="timezone" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="UTC">UTC</option>
                        <option value="EST" selected>Eastern Time (ET)</option>
                        <option value="CST">Central Time (CT)</option>
                        <option value="PST">Pacific Time (PT)</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Course Settings</h3>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <label htmlFor="default-course-status" className="text-sm font-medium">Default Course Status</label>
                      <select id="default-course-status" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                        <option value="In Progress">In Progress</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">Enable Certificate Generation</div>
                      <div className="flex items-center">
                        <input type="checkbox" id="enable-certificates" className="mr-2" checked />
                        <label htmlFor="enable-certificates" className="text-sm">Enabled</label>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">Require Admin Approval for New Courses</div>
                      <div className="flex items-center">
                        <input type="checkbox" id="require-approval" className="mr-2" checked />
                        <label htmlFor="require-approval" className="text-sm">Enabled</label>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Email Settings</h3>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <label htmlFor="email-sender" className="text-sm font-medium">Email Sender Name</label>
                      <Input id="email-sender" defaultValue="Insights Collective" />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="email-from" className="text-sm font-medium">From Email Address</label>
                      <Input id="email-from" defaultValue="noreply@ic.tech" />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">Send Welcome Email to New Users</div>
                      <div className="flex items-center">
                        <input type="checkbox" id="welcome-email" className="mr-2" checked />
                        <label htmlFor="welcome-email" className="text-sm">Enabled</label>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">Send Course Completion Emails</div>
                      <div className="flex items-center">
                        <input type="checkbox" id="completion-email" className="mr-2" checked />
                        <label htmlFor="completion-email" className="text-sm">Enabled</label>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                <Button variant="outline">Cancel</Button>
                <Button onClick={() => handleAction('Save', 'settings')}>Save Changes</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
