
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

// Mock data
const courses = [
  { id: 'course1', title: 'Introduction to Data Science' },
  { id: 'course2', title: 'Advanced Machine Learning' },
  { id: 'course3', title: 'Data Engineering Fundamentals' },
  { id: 'course4', title: 'Business Analytics with Python' },
];

const completedUsers = [
  { id: 'user1', name: 'John Doe', email: 'john.doe@example.com', progress: 100 },
  { id: 'user2', name: 'Jane Smith', email: 'jane.smith@example.com', progress: 100 },
  { id: 'user3', name: 'Alice Johnson', email: 'alice.j@example.com', progress: 95 },
  { id: 'user4', name: 'Bob Williams', email: 'bob.w@example.com', progress: 100 },
  { id: 'user5', name: 'Carol Brown', email: 'carol.b@example.com', progress: 92 },
  { id: 'user6', name: 'Dave Miller', email: 'dave.m@example.com', progress: 100 },
];

interface IssueCertificatesModalProps {
  onIssueCertificates: (courseId: string, userIds: string[]) => void;
  children?: React.ReactNode; // Add children prop
}

export function IssueCertificatesModal({ onIssueCertificates, children }: IssueCertificatesModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  const { toast } = useToast();
  
  // Filter users who have completed the selected course (in a real app, this would be dynamic)
  const eligibleUsers = completedUsers.filter(user => user.progress >= 90);
  
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedUsers(new Set(eligibleUsers.map(user => user.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };
  
  const handleUserSelection = (userId: string, checked: boolean) => {
    const newSelectedUsers = new Set(selectedUsers);
    if (checked) {
      newSelectedUsers.add(userId);
    } else {
      newSelectedUsers.delete(userId);
    }
    setSelectedUsers(newSelectedUsers);
    setSelectAll(newSelectedUsers.size === eligibleUsers.length);
  };
  
  const handleSubmit = () => {
    if (!selectedCourse) {
      toast({
        title: 'No course selected',
        description: 'Please select a course to issue certificates.',
        variant: 'destructive',
      });
      return;
    }
    
    if (selectedUsers.size === 0) {
      toast({
        title: 'No users selected',
        description: 'Please select at least one user to issue certificates to.',
        variant: 'destructive',
      });
      return;
    }
    
    onIssueCertificates(selectedCourse, Array.from(selectedUsers));
    
    toast({
      title: 'Certificates Issued',
      description: `Successfully issued ${selectedUsers.size} certificates for the selected course.`,
    });
    
    // Reset form
    setSelectedCourse('');
    setSelectedUsers(new Set());
    setSelectAll(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button variant="outline">Issue Certificates</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Issue Course Certificates</DialogTitle>
          <DialogDescription>
            Select a course and users who have completed it to issue certificates.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="course" className="text-right">
              Course
            </Label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger id="course" className="col-span-3">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedCourse && (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="selectAll"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <label
                  htmlFor="selectAll"
                  className="text-sm font-medium leading-none"
                >
                  Select All Eligible Users
                </label>
              </div>
              
              <div className="border rounded-md">
                <ScrollArea className="h-72 p-2">
                  <div className="space-y-2">
                    {eligibleUsers.map((user) => (
                      <div key={user.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded">
                        <Checkbox
                          id={`user-${user.id}`}
                          checked={selectedUsers.has(user.id)}
                          onCheckedChange={(checked) => handleUserSelection(user.id, !!checked)}
                        />
                        <div className="grid gap-0.5">
                          <label
                            htmlFor={`user-${user.id}`}
                            className="text-sm font-medium leading-none"
                          >
                            {user.name}
                          </label>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="ml-auto text-xs text-muted-foreground">
                          {user.progress}% Complete
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Issue Certificates</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
