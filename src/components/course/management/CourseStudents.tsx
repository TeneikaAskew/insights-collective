
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, UserPlus, X, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Student {
  enrollment_id: string;
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  enrolled_at: string;
  progress?: number;
  last_activity?: string;
}

interface CourseStudentsProps {
  courseId?: string;
}

export default function CourseStudents({ courseId }: CourseStudentsProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (courseId) {
      fetchEnrolledStudents();
    }
  }, [courseId]);

  useEffect(() => {
    filterStudents();
  }, [searchQuery, students]);

  const fetchEnrolledStudents = async () => {
    setLoading(true);
    try {
      // Get all enrollments for this course with user profile data
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          created_at,
          progress,
          last_activity,
          profiles:user_id (
            id,
            email,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('course_id', courseId);
      
      if (error) throw error;

      // Transform data into the Student format
      const transformedData = data?.map((enrollment) => ({
        enrollment_id: enrollment.id,
        id: enrollment.profiles?.id || '',
        email: enrollment.profiles?.email || '',
        first_name: enrollment.profiles?.first_name || '',
        last_name: enrollment.profiles?.last_name || '',
        avatar_url: enrollment.profiles?.avatar_url,
        enrolled_at: enrollment.created_at,
        progress: enrollment.progress || 0,
        last_activity: enrollment.last_activity,
      })) || [];

      setStudents(transformedData);
      setFilteredStudents(transformedData);
    } catch (error: any) {
      console.error('Error fetching enrolled students:', error);
      toast({
        title: 'Error',
        description: 'Failed to load enrolled students',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    const filtered = students.filter((student) => {
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      const email = student.email.toLowerCase();
      const query = searchQuery.toLowerCase();
      
      return fullName.includes(query) || email.includes(query);
    });
    
    setFilteredStudents(filtered);
  };

  const handleAddStudent = async () => {
    if (!courseId || !studentEmail) return;
    
    setAddingStudent(true);
    try {
      // First find the user by email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, avatar_url')
        .eq('email', studentEmail.trim())
        .maybeSingle();
      
      if (userError) throw userError;
      
      if (!userData) {
        toast({
          title: 'User Not Found',
          description: 'No user found with that email address',
          variant: 'destructive',
        });
        return;
      }
      
      // Check if already enrolled
      const { data: existingEnrollment, error: checkError } = await supabase
        .from('enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('user_id', userData.id)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existingEnrollment) {
        toast({
          title: 'Already Enrolled',
          description: 'This user is already enrolled in the course',
          variant: 'destructive',
        });
        return;
      }
      
      // Create the enrollment
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .insert({
          course_id: courseId,
          user_id: userData.id,
        })
        .select()
        .single();
      
      if (enrollmentError) throw enrollmentError;
      
      // Add to the students list
      const newStudent: Student = {
        enrollment_id: enrollmentData.id,
        id: userData.id,
        email: userData.email || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        avatar_url: userData.avatar_url,
        enrolled_at: enrollmentData.created_at,
        progress: 0,
      };
      
      setStudents([...students, newStudent]);
      
      toast({
        title: 'Student Enrolled',
        description: 'Student has been successfully enrolled in the course',
      });
      
      setStudentEmail('');
      setIsAddStudentOpen(false);
    } catch (error: any) {
      console.error('Error adding student:', error);
      toast({
        title: 'Error',
        description: 'Failed to enroll student',
        variant: 'destructive',
      });
    } finally {
      setAddingStudent(false);
    }
  };

  const handleRemoveStudent = async (enrollmentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to unenroll ${studentName}?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);
      
      if (error) throw error;
      
      // Update the students list
      setStudents(students.filter(student => student.enrollment_id !== enrollmentId));
      
      toast({
        title: 'Student Removed',
        description: 'Student has been unenrolled from the course',
      });
    } catch (error: any) {
      console.error('Error removing student:', error);
      toast({
        title: 'Error',
        description: 'Failed to unenroll student',
        variant: 'destructive',
      });
    }
  };

  const exportStudentList = () => {
    // Generate CSV data
    const csvContent = [
      ['ID', 'First Name', 'Last Name', 'Email', 'Enrolled Date', 'Progress'],
      ...students.map(student => [
        student.id,
        student.first_name,
        student.last_name,
        student.email,
        new Date(student.enrolled_at).toLocaleDateString(),
        `${student.progress || 0}%`
      ])
    ]
    .map(row => row.join(','))
    .join('\n');

    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `course_students_${courseId}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input 
            placeholder="Search students..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex space-x-2">
          <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Student to Course</DialogTitle>
                <DialogDescription>
                  Enter the student's email address to add them to this course. 
                  The student must have an account in the system.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="student-email">Email Address</Label>
                <Input
                  id="student-email"
                  placeholder="student@example.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddStudentOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddStudent} disabled={addingStudent || !studentEmail}>
                  {addingStudent ? <Spinner size="sm" className="mr-2" /> : null}
                  {addingStudent ? 'Adding...' : 'Add Student'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={exportStudentList} disabled={students.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Student Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Enrollment Date</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    {students.length === 0 ? 'No students enrolled yet.' : 'No students match your search.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.enrollment_id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-200 mr-3 overflow-hidden">
                          {student.avatar_url ? (
                            <img 
                              src={student.avatar_url} 
                              alt={`${student.first_name} ${student.last_name}`}
                              className="h-full w-full object-cover" 
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-medium">
                              {student.first_name?.charAt(0) || student.email.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          {student.first_name || student.last_name ? (
                            `${student.first_name} ${student.last_name}`
                          ) : (
                            <span className="text-gray-500">No Name</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{new Date(student.enrolled_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2 max-w-[100px]">
                          <div 
                            className="bg-primary h-2.5 rounded-full" 
                            style={{ width: `${student.progress || 0}%` }}
                          />
                        </div>
                        <span>{student.progress || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.last_activity ? (
                        new Date(student.last_activity).toLocaleDateString()
                      ) : (
                        <span className="text-gray-500">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleRemoveStudent(
                          student.enrollment_id, 
                          `${student.first_name} ${student.last_name}`.trim() || student.email
                        )}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { Label } from "@/components/ui/label";
