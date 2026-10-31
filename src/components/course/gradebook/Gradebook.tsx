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
import { buildGradebook, buildGradebookCsvRows, toCsv, type NormalizedCell, type RawQuizSubmission } from './gradebookData';
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
  /** Raw quiz_submissions rows; the latest scored attempt per student is used. */
  quizSubmissions?: RawQuizSubmission[];
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
  quizSubmissions = [],
  onGradeUpdate,
  onBulkGradeUpdate,
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [tempGrades, setTempGrades] = useState<Record<string, number>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});

  // One normalized model feeds the table, totals and the CSV export.
  // `grades` is still accepted for compatibility but cells come from the raw
  // submission rows so 0 vs missing and latest attempt are handled once.
  const model = useMemo(
    () =>
      buildGradebook({
        students,
        assignments: assignments.map((a: any) => ({ id: a.id, title: a.title, points: a.points })),
        quizzes: quizzes.map((q: any) => ({ id: q.id, title: q.title, points: q.total_points ?? q.points_possible })),
        assignmentSubmissions: (submissions as any[]).map((sub) => ({
          ...sub,
          user_id: sub.user_id ?? sub.student_id,
        })),
        quizSubmissions,
      }),
    [students, assignments, quizzes, submissions, quizSubmissions],
  );
  // 'late' is kept as a status the UI understands, though nothing derives it yet.
  const gradeData = model.cells as Record<string, Omit<NormalizedCell, 'status'> & { status: string }>;
  const studentTotals = model.totals;
  const classAverage = useMemo(() => {
    const pcts = students.map((s) => studentTotals[s.id]?.percentage).filter((p): p is number => typeof p === 'number');
    return pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : undefined;
  }, [students, studentTotals]);

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
    if (percentage >= 90) return 'text-ss-good';
    if (percentage >= 80) return 'text-ss-teal';
    if (percentage >= 70) return 'text-ss-warn';
    if (percentage >= 60) return 'text-ss-warn';
    return 'text-ss-bad';
  };

  // Builds the CSV from the same normalized model the table renders.
  const exportGrades = () => {
    let url: string | null = null;
    try {
      const items = [
        ...assignments.map((a: any) => ({ id: a.id, title: a.title, points: a.points, type: 'assignment' as const })),
        ...quizzes.map((q: any) => ({ id: q.id, title: q.title, points: q.total_points, type: 'quiz' as const })),
      ];
      const rows = buildGradebookCsvRows(students, items, model);
      const csv = toCsv(rows);
      url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `gradebook-${courseId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      const toRevoke = url;
      // Revoke later: revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(toRevoke), 30_000);
      toast({ title: 'Gradebook CSV prepared', description: `${rows.length - 1} students included` });
    } catch (err: any) {
      if (url) URL.revokeObjectURL(url);
      toast({ title: 'Export failed', description: err?.message || 'Could not build the CSV', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div>
              <CardTitle>Gradebook</CardTitle>
              <CardDescription>
                Manage grades for all students and assignments
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-shrink-0">
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
              {classAverage === undefined ? '—' : `${classAverage.toFixed(1)}%`}
            </div>
            <Progress 
              value={classAverage ?? 0} 
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
            <div className="text-2xl font-bold text-ss-bad">
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
                            <p className="text-xs text-muted-foreground">
                              Quiz scores are recorded at submission time and are read-only here.
                            </p>
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
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
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
                                value={tempGrade ?? cell?.pointsEarned ?? ''}
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
                              ) : cell?.status === 'submitted' ? (
                                <Badge variant="outline" className="text-xs">
                                  Needs grading
                                </Badge>
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
                        <TableCell
                          key={quiz.id}
                          className="text-center p-2"
                          title="Quiz scores are recorded at submission time"
                        >
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
                          {studentTotals[student.id]?.percentage === undefined
                            ? '—'
                            : `${studentTotals[student.id].percentage.toFixed(1)}%`}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {studentTotals[student.id]?.earned}/{studentTotals[student.id]?.possible}
                        </div>
                        {studentTotals[student.id]?.percentage !== undefined && (
                          <Badge variant="outline" className="mt-1">
                            {getLetterGrade(studentTotals[student.id].percentage)}
                          </Badge>
                        )}
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