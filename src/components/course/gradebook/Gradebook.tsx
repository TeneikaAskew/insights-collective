import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  Upload, 
  Filter, 
  Search,
  MessageSquare,
  Save,
  Calculator,
  ChevronDown,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { Grade, AssignmentSubmission, EnhancedAssignment } from '@/types/course';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GradebookProps {
  courseId: string;
  students: Array<{
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  }>;
  assignments: EnhancedAssignment[];
  quizzes: any[];
  grades: Grade[];
  submissions: AssignmentSubmission[];
  onGradeUpdate: (gradeData: any) => void;
  onBulkGradeUpdate: (updates: any[]) => void;
}

interface GradeCell {
  studentId: string;
  itemId: string;
  itemType: 'assignment' | 'quiz';
  pointsEarned?: number;
  pointsPossible?: number;
  percentage?: number;
  status?: 'submitted' | 'graded' | 'missing' | 'late';
  submissionId?: string;
}

export const Gradebook: React.FC<GradebookProps> = ({
  courseId,
  students,
  assignments,
  quizzes,
  grades,
  submissions,
  onGradeUpdate,
  onBulkGradeUpdate,
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [tempGrades, setTempGrades] = useState<Record<string, number>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});

  // Calculate grade data for each cell
  const gradeData = useMemo(() => {
    const data: Record<string, GradeCell> = {};

    // Process assignments
    assignments.forEach(assignment => {
      students.forEach(student => {
        const key = `${student.id}-${assignment.id}`;
        const submission = submissions.find(
          s => s.student_id === student.id && s.assignment_id === assignment.id
        );
        const grade = grades.find(
          g => g.student_id === student.id && g.assignment_id === assignment.id
        );

        data[key] = {
          studentId: student.id,
          itemId: assignment.id,
          itemType: 'assignment',
          pointsEarned: grade?.points_earned || submission?.grade,
          pointsPossible: assignment.points,
          percentage: grade?.percentage,
          status: submission?.status || 'missing',
          submissionId: submission?.id,
        };
      });
    });

    // Process quizzes
    quizzes.forEach(quiz => {
      students.forEach(student => {
        const key = `${student.id}-${quiz.id}`;
        const grade = grades.find(
          g => g.student_id === student.id && g.quiz_id === quiz.id
        );

        data[key] = {
          studentId: student.id,
          itemId: quiz.id,
          itemType: 'quiz',
          pointsEarned: grade?.points_earned,
          pointsPossible: quiz.total_points,
          percentage: grade?.percentage,
          status: grade ? 'graded' : 'missing',
        };
      });
    });

    return data;
  }, [students, assignments, quizzes, grades, submissions]);

  // Calculate student totals
  const studentTotals = useMemo(() => {
    const totals: Record<string, { earned: number; possible: number; percentage: number }> = {};

    students.forEach(student => {
      let totalEarned = 0;
      let totalPossible = 0;

      // Sum assignment grades
      assignments.forEach(assignment => {
        const key = `${student.id}-${assignment.id}`;
        const cell = gradeData[key];
        if (cell?.pointsEarned !== undefined) {
          totalEarned += cell.pointsEarned;
        }
        if (cell?.pointsPossible) {
          totalPossible += cell.pointsPossible;
        }
      });

      // Sum quiz grades
      quizzes.forEach(quiz => {
        const key = `${student.id}-${quiz.id}`;
        const cell = gradeData[key];
        if (cell?.pointsEarned !== undefined) {
          totalEarned += cell.pointsEarned;
        }
        if (cell?.pointsPossible) {
          totalPossible += cell.pointsPossible;
        }
      });

      totals[student.id] = {
        earned: totalEarned,
        possible: totalPossible,
        percentage: totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0,
      };
    });

    return totals;
  }, [students, assignments, quizzes, gradeData]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      switch (filterBy) {
        case 'missing':
          return Object.values(gradeData).some(
            cell => cell.studentId === student.id && cell.status === 'missing'
          );
        case 'late':
          return Object.values(gradeData).some(
            cell => cell.studentId === student.id && cell.status === 'late'
          );
        case 'graded':
          return Object.values(gradeData).some(
            cell => cell.studentId === student.id && cell.status === 'graded'
          );
        default:
          return true;
      }
    });
  }, [students, searchTerm, filterBy, gradeData]);

  const handleGradeChange = (studentId: string, itemId: string, value: string) => {
    const key = `${studentId}-${itemId}`;
    setTempGrades({ ...tempGrades, [key]: parseFloat(value) || 0 });
  };

  const handleGradeSave = async (studentId: string, itemId: string, itemType: 'assignment' | 'quiz') => {
    const key = `${studentId}-${itemId}`;
    const grade = tempGrades[key];
    const cell = gradeData[key];

    if (grade === undefined || !cell) return;

    try {
      await onGradeUpdate({
        studentId,
        itemId,
        itemType,
        grade,
        pointsPossible: cell.pointsPossible,
        submissionId: cell.submissionId,
      });

      setEditingCell(null);
      setTempGrades(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });

      toast({
        title: 'Success',
        description: 'Grade updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update grade',
        variant: 'destructive',
      });
    }
  };

  const getLetterGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const getGradeColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    if (percentage >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const exportGrades = () => {
    // Implementation for CSV export
    toast({
      title: 'Export Started',
      description: 'Grades are being exported to CSV',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Gradebook</CardTitle>
              <CardDescription>
                Manage grades for all students and assignments
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportGrades}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Class Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(
                students.reduce((sum, student) => sum + studentTotals[student.id]?.percentage || 0, 0) /
                students.length
              ).toFixed(1)}%
            </div>
            <Progress 
              value={
                students.reduce((sum, student) => sum + studentTotals[student.id]?.percentage || 0, 0) /
                students.length
              } 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {assignments.filter(a => a.is_published).length} published
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissions.filter(s => s.status === 'submitted').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {submissions.filter(s => s.status === 'graded').length} graded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Missing Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {Object.values(gradeData).filter(cell => cell.status === 'missing').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              across all students
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="missing">Missing Work</SelectItem>
                <SelectItem value="late">Late Submissions</SelectItem>
                <SelectItem value="graded">Graded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Gradebook Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-background min-w-[200px]">
                    Student
                  </TableHead>
                  {assignments.map(assignment => (
                    <TableHead key={assignment.id} className="text-center min-w-[120px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex flex-col items-center">
                              <FileText className="h-4 w-4 mb-1" />
                              <span className="text-xs truncate max-w-[100px]">
                                {assignment.title}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {assignment.points} pts
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{assignment.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  ))}
                  {quizzes.map(quiz => (
                    <TableHead key={quiz.id} className="text-center min-w-[120px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex flex-col items-center">
                              <FileText className="h-4 w-4 mb-1" />
                              <span className="text-xs truncate max-w-[100px]">
                                {quiz.title}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {quiz.total_points} pts
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{quiz.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[120px]">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map(student => (
                  <TableRow key={student.id}>
                    <TableCell className="sticky left-0 z-10 bg-background font-medium">
                      <div className="flex items-center gap-2">
                        {student.avatar_url ? (
                          <img
                            src={student.avatar_url}
                            alt={student.full_name}
                            className="h-8 w-8 rounded-full"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <Users className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">{student.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    
                    {assignments.map(assignment => {
                      const key = `${student.id}-${assignment.id}`;
                      const cell = gradeData[key];
                      const isEditing = editingCell === key;
                      const tempGrade = tempGrades[key];

                      return (
                        <TableCell key={assignment.id} className="text-center p-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                max={assignment.points || 100}
                                value={tempGrade || cell?.pointsEarned || ''}
                                onChange={(e) => handleGradeChange(student.id, assignment.id, e.target.value)}
                                className="w-16 h-8 text-center"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleGradeSave(student.id, assignment.id, 'assignment')}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="cursor-pointer hover:bg-muted rounded p-1"
                              onClick={() => setEditingCell(key)}
                            >
                              {cell?.status === 'missing' ? (
                                <Badge variant="destructive" className="text-xs">
                                  Missing
                                </Badge>
                              ) : cell?.status === 'late' ? (
                                <Badge variant="warning" className="text-xs">
                                  Late
                                </Badge>
                              ) : cell?.pointsEarned !== undefined ? (
                                <div>
                                  <span className={`font-medium ${getGradeColor(cell.percentage || 0)}`}>
                                    {cell.pointsEarned}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    /{assignment.points}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                    
                    {quizzes.map(quiz => {
                      const key = `${student.id}-${quiz.id}`;
                      const cell = gradeData[key];

                      return (
                        <TableCell key={quiz.id} className="text-center p-2">
                          {cell?.pointsEarned !== undefined ? (
                            <div>
                              <span className={`font-medium ${getGradeColor(cell.percentage || 0)}`}>
                                {cell.pointsEarned}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                /{quiz.total_points}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      );
                    })}
                    
                    <TableCell className="text-center font-medium">
                      <div>
                        <span className={`text-lg ${getGradeColor(studentTotals[student.id]?.percentage || 0)}`}>
                          {studentTotals[student.id]?.percentage.toFixed(1)}%
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {studentTotals[student.id]?.earned}/{studentTotals[student.id]?.possible}
                        </div>
                        <Badge variant="outline" className="mt-1">
                          {getLetterGrade(studentTotals[student.id]?.percentage || 0)}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};