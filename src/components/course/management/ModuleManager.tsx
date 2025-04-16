import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Edit, 
  Trash2, 
  FilePlus, 
  ChevronRight, 
  ChevronDown,
  FileText,
  BookOpen,
  ClipboardCheck,
  HelpCircle,
  Save
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import ModuleContentEditor from './ModuleContentEditor';
import AIContentGenerator from '@/components/ai/AIContentGenerator';
import { Badge } from '@/components/ui/badge';

interface ModuleManagerProps {
  courseId: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  course_id: string;
  created_at: string;
  updated_at: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  duration: string;
  order_num: number;
  module_id: string;
  created_at: string;
  updated_at: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  points: number;
  module_id: string;
  created_at?: string;
  updated_at?: string;
}

interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctOption: number;
  points: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  module_id: string;
  questions: QuizQuestion[];
  time_limit?: number;
  passing_score?: number;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
}

const ModuleManager: React.FC<ModuleManagerProps> = ({ courseId }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit } = useCoursePermissions(courseId);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [editingModule, setEditingModule] = useState<Partial<Module>>({
    title: '',
    description: '',
    week: 1
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [moduleContents, setModuleContents] = useState<any[]>([]);
  
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [editingLesson, setEditingLesson] = useState<Partial<Lesson>>({
    title: '',
    description: '',
    content: '',
    duration: '',
    order_num: 1
  });
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Partial<Assignment>>({
    title: '',
    description: '',
    due_date: '',
    points: 100
  });
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  
  const [quizzes, setQuizzes] = useState<Record<string, Quiz[]>>({});
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<Partial<Quiz>>({
    title: '',
    description: '',
    questions: [],
    time_limit: 30,
    passing_score: 70
  });
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<QuizQuestion>>({
    text: '',
    options: ['', '', '', ''],
    correctOption: 0,
    points: 10
  });
  
  useEffect(() => {
    if (!courseId) return;
    
    const fetchModules = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('modules')
          .select('*')
          .eq('course_id', courseId)
          .order('week', { ascending: true });
        
        if (error) throw error;
        
        setModules(data || []);
      } catch (error: any) {
        console.error('Error fetching modules:', error);
        toast({
          title: 'Error',
          description: 'Failed to load modules',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchModules();
  }, [courseId, toast]);
  
  useEffect(() => {
    if (!activeModuleId) {
      setModuleContents([]);
      return;
    }
    
    const fetchModuleContents = async () => {
      try {
        const { data, error } = await supabase
          .from('module_content')
          .select('*')
          .eq('module_id', activeModuleId)
          .order('position', { ascending: true });
        
        if (error) throw error;
        setModuleContents(data || []);
      } catch (error) {
        console.error('Error fetching module contents:', error);
        toast({
          title: 'Error',
          description: 'Failed to load module contents',
          variant: 'destructive',
        });
      }
    };
    
    fetchModuleContents();
    
    const fetchLessons = async () => {
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .eq('module_id', activeModuleId)
          .order('order_num', { ascending: true });
        
        if (error) throw error;
        
        setLessons(prev => ({
          ...prev,
          [activeModuleId]: data || []
        }));
      } catch (error) {
        console.error('Error fetching lessons:', error);
      }
    };
    
    fetchLessons();
    
    const fetchAssignments = async () => {
      try {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .eq('module_id', activeModuleId);
        
        if (error) {
          if (error.code === '42P01') {
            console.log('Assignments table does not exist yet');
            setAssignments(prev => ({
              ...prev,
              [activeModuleId]: []
            }));
            return;
          }
          throw error;
        }
        
        setAssignments(prev => ({
          ...prev,
          [activeModuleId]: data || []
        }));
      } catch (error) {
        console.error('Error fetching assignments:', error);
      }
    };
    
    fetchAssignments();
    
    const fetchQuizzes = async () => {
      try {
        const { data, error } = await supabase
          .from('quizzes')
          .select('*')
          .eq('module_id', activeModuleId);
        
        if (error) {
          if (error.code === '42P01') {
            console.log('Quizzes table does not exist yet');
            setQuizzes(prev => ({
              ...prev,
              [activeModuleId]: []
            }));
            return;
          }
          throw error;
        }
        
        setQuizzes(prev => ({
          ...prev,
          [activeModuleId]: data || []
        }));
      } catch (error) {
        console.error('Error fetching quizzes:', error);
      }
    };
    
    fetchQuizzes();
  }, [activeModuleId, toast]);
  
  const handleAddContent = async (content: any) => {
    if (!activeModuleId) return null;
    
    try {
      const { data, error } = await supabase
        .from('module_content')
        .insert(content)
        .select()
        .single();
      
      if (error) throw error;
      
      setModuleContents([...moduleContents, data]);
      
      toast({
        title: 'Success',
        description: 'Content added successfully',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error adding content:', error);
      toast({
        title: 'Error',
        description: 'Failed to add content',
        variant: 'destructive',
      });
      throw error;
    }
  };
  
  const handleUpdateContent = async (contentId: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('module_content')
        .update(updates)
        .eq('id', contentId)
        .select()
        .single();
      
      if (error) throw error;
      
      setModuleContents(moduleContents.map(content => 
        content.id === contentId ? data : content
      ));
      
      toast({
        title: 'Success',
        description: 'Content updated successfully',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error updating content:', error);
      toast({
        title: 'Error',
        description: 'Failed to update content',
        variant: 'destructive',
      });
      return null;
    }
  };
  
  const handleDeleteContent = async (contentId: string) => {
    try {
      const { error } = await supabase
        .from('module_content')
        .delete()
        .eq('id', contentId);
      
      if (error) throw error;
      
      setModuleContents(moduleContents.filter(content => content.id !== contentId));
      
      toast({
        title: 'Success',
        description: 'Content deleted successfully',
      });
      
      return true;
    } catch (error: any) {
      console.error('Error deleting content:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete content',
        variant: 'destructive',
      });
      return false;
    }
  };
  
  const handleAIContentGenerated = (content: string) => {
    setEditingModule(prev => ({
      ...prev,
      description: content
    }));
  };
  
  const handleAddModule = () => {
    setSelectedModule(null);
    setEditingModule({
      title: '',
      description: '',
      week: Math.max(0, ...modules.map(m => m.week)) + 1
    });
    setErrors({});
    setIsModalOpen(true);
  };
  
  const handleEditModule = (module: Module) => {
    setSelectedModule(module);
    setEditingModule({
      title: module.title,
      description: module.description,
      week: module.week
    });
    setErrors({});
    setIsModalOpen(true);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingModule(prev => ({
      ...prev,
      [name]: name === 'week' ? parseInt(value) || 1 : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!editingModule.title?.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!editingModule.description?.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!editingModule.week || editingModule.week < 1) {
      newErrors.week = 'Week must be a positive number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSaveModule = async () => {
    if (!validateForm()) return;
    
    try {
      if (selectedModule) {
        const { data, error } = await supabase
          .from('modules')
          .update({
            title: editingModule.title,
            description: editingModule.description,
            week: editingModule.week
          })
          .eq('id', selectedModule.id)
          .select()
          .single();
        
        if (error) throw error;
        
        setModules(modules.map(m => m.id === selectedModule.id ? data : m));
        
        toast({
          title: 'Success',
          description: 'Module updated successfully',
        });
      } else {
        const { data, error } = await supabase
          .from('modules')
          .insert({
            title: editingModule.title,
            description: editingModule.description,
            week: editingModule.week,
            course_id: courseId
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setModules([...modules, data]);
        
        toast({
          title: 'Success',
          description: 'Module created successfully',
        });
      }
      
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving module:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save module',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteModule = async (moduleId: string) => {
    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);
      
      if (error) throw error;
      
      setModules(modules.filter(m => m.id !== moduleId));
      
      toast({
        title: 'Success',
        description: 'Module deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting module:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete module',
        variant: 'destructive',
      });
    }
  };
  
  const handleAddLesson = (moduleId: string) => {
    setSelectedLesson(null);
    const currentLessons = lessons[moduleId] || [];
    setEditingLesson({
      title: '',
      description: '',
      content: '',
      duration: '',
      order_num: currentLessons.length + 1,
      module_id: moduleId
    });
    setIsLessonModalOpen(true);
  };
  
  const handleEditLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setEditingLesson({
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      duration: lesson.duration,
      order_num: lesson.order_num,
      module_id: lesson.module_id
    });
    setIsLessonModalOpen(true);
  };
  
  const handleLessonChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingLesson(prev => ({
      ...prev,
      [name]: name === 'order_num' ? parseInt(value) || 1 : value
    }));
  };
  
  const handleSaveLesson = async () => {
    if (!editingLesson.title?.trim() || !editingLesson.module_id) return;
    
    try {
      if (selectedLesson) {
        const { data, error } = await supabase
          .from('lessons')
          .update({
            title: editingLesson.title,
            description: editingLesson.description,
            content: editingLesson.content,
            duration: editingLesson.duration,
            order_num: editingLesson.order_num
          })
          .eq('id', selectedLesson.id)
          .select()
          .single();
        
        if (error) throw error;
        
        setLessons(prev => ({
          ...prev,
          [editingLesson.module_id as string]: (prev[editingLesson.module_id as string] || [])
            .map(l => l.id === selectedLesson.id ? data : l)
        }));
        
        toast({
          title: 'Success',
          description: 'Lesson updated successfully',
        });
      } else {
        const { data, error } = await supabase
          .from('lessons')
          .insert({
            title: editingLesson.title,
            description: editingLesson.description,
            content: editingLesson.content,
            duration: editingLesson.duration,
            order_num: editingLesson.order_num,
            module_id: editingLesson.module_id
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setLessons(prev => ({
          ...prev,
          [editingLesson.module_id as string]: [...(prev[editingLesson.module_id as string] || []), data]
        }));
        
        toast({
          title: 'Success',
          description: 'Lesson created successfully',
        });
      }
      
      setIsLessonModalOpen(false);
    } catch (error: any) {
      console.error('Error saving lesson:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save lesson',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteLesson = async (lessonId: string, moduleId: string) => {
    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lessonId);
      
      if (error) throw error;
      
      setLessons(prev => ({
        ...prev,
        [moduleId]: (prev[moduleId] || []).filter(l => l.id !== lessonId)
      }));
      
      toast({
        title: 'Success',
        description: 'Lesson deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting lesson:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save lesson',
        variant: 'destructive',
      });
    }
  };
  
  const handleAddAssignment = (moduleId: string) => {
    setSelectedAssignment(null);
    setEditingAssignment({
      title: '',
      description: '',
      due_date: '',
      points: 100,
      module_id: moduleId
    });
    setIsAssignmentModalOpen(true);
  };
  
  const handleEditAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setEditingAssignment({
      title: assignment.title,
      description: assignment.description,
      due_date: assignment.due_date,
      points: assignment.points,
      module_id: assignment.module_id
    });
    setIsAssignmentModalOpen(true);
  };
  
  const handleAssignmentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingAssignment(prev => ({
      ...prev,
      [name]: name === 'points' ? parseInt(value) || 0 : value
    }));
  };
  
  const handleSaveAssignment = async () => {
    if (!editingAssignment.title?.trim() || !editingAssignment.module_id) return;
    
    try {
      if (selectedAssignment) {
        const { data, error } = await supabase
          .from('assignments')
          .update({
            title: editingAssignment.title,
            description: editingAssignment.description,
            due_date: editingAssignment.due_date,
            points: editingAssignment.points
          })
          .eq('id', selectedAssignment.id)
          .select()
          .single();
        
        if (error) throw error;
        
        setAssignments(prev => ({
          ...prev,
          [editingAssignment.module_id as string]: (prev[editingAssignment.module_id as string] || [])
            .map(a => a.id === selectedAssignment.id ? data : a)
        }));
        
        toast({
          title: 'Success',
          description: 'Assignment updated successfully',
        });
      } else {
        const { data, error } = await supabase
          .from('assignments')
          .insert({
            title: editingAssignment.title,
            description: editingAssignment.description,
            due_date: editingAssignment.due_date,
            points: editingAssignment.points,
            module_id: editingAssignment.module_id
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setAssignments(prev => ({
          ...prev,
          [editingAssignment.module_id as string]: [...(prev[editingAssignment.module_id as string] || []), data]
        }));
        
        toast({
          title: 'Success',
          description: 'Assignment created successfully',
        });
      }
      
      setIsAssignmentModalOpen(false);
    } catch (error: any) {
      console.error('Error saving assignment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save assignment',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteAssignment = async (assignmentId: string, moduleId: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);
      
      if (error) throw error;
      
      setAssignments(prev => ({
        ...prev,
        [moduleId]: (prev[moduleId] || []).filter(a => a.id !== assignmentId)
      }));
      
      toast({
        title: 'Success',
        description: 'Assignment deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete assignment',
        variant: 'destructive',
      });
    }
  };
  
  const handleAddQuiz = (moduleId: string) => {
    setSelectedQuiz(null);
    setEditingQuiz({
      title: '',
      description: '',
      questions: [],
      time_limit: 30,
      passing_score: 70,
      module_id: moduleId
    });
    setEditingQuestion({
      text: '',
      options: ['', '', '', ''],
      correctOption: 0,
      points: 10
    });
    setIsQuizModalOpen(true);
  };
  
  const handleEditQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setEditingQuiz({
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions || [],
      time_limit: quiz.time_limit,
      passing_score: quiz.passing_score,
      due_date: quiz.due_date,
      module_id: quiz.module_id
    });
    setIsQuizModalOpen(true);
  };
  
  const handleQuizChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingQuiz(prev => ({
      ...prev,
      [name]: ['time_limit', 'passing_score'].includes(name) ? parseInt(value) || 0 : value
    }));
  };
  
  const handleQuestionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingQuestion(prev => ({
      ...prev,
      [name]: name === 'points' ? parseInt(value) || 0 : value
    }));
  };
  
  const handleOptionChange = (index: number, value: string) => {
    setEditingQuestion(prev => ({
      ...prev,
      options: prev.options?.map((opt, i) => i === index ? value : opt) || []
    }));
  };
  
  const handleCorrectOptionChange = (index: number) => {
    setEditingQuestion(prev => ({
      ...prev,
      correctOption: index
    }));
  };
  
  const handleAddQuestion = () => {
    if (!editingQuestion.text) return;
    
    const newQuestion: QuizQuestion = {
      id: Date.now().toString(),
      text: editingQuestion.text,
      options: editingQuestion.options || ['', '', '', ''],
      correctOption: editingQuestion.correctOption || 0,
      points: editingQuestion.points || 10
    };
    
    setEditingQuiz(prev => ({
      ...prev,
      questions: [...(prev.questions || []), newQuestion]
    }));
    
    setEditingQuestion({
      text: '',
      options: ['', '', '', ''],
      correctOption: 0,
      points: 10
    });
  };
  
  const handleRemoveQuestion = (questionId: string) => {
    setEditingQuiz(prev => ({
      ...prev,
      questions: (prev.questions || []).filter(q => q.id !== questionId)
    }));
  };
  
  const handleSaveQuiz = async () => {
    if (!editingQuiz.title?.trim() || !editingQuiz.module_id || !(editingQuiz.questions?.length > 0)) return;
    
    try {
      const quizData = {
        title: editingQuiz.title,
        description: editingQuiz.description,
        questions: editingQuiz.questions,
        time_limit: editingQuiz.time_limit,
        passing_score: editingQuiz.passing_score,
        due_date: editingQuiz.due_date,
        module_id: editingQuiz.module_id
      };
      
      if (selectedQuiz) {
        const { data, error } = await supabase
          .from('quizzes')
          .update(quizData)
          .eq('id', selectedQuiz.id)
          .select()
          .single();
        
        if (error) throw error;
        
        setQuizzes(prev => ({
          ...prev,
          [editingQuiz.module_id as string]: (prev[editingQuiz.module_id as string] || [])
            .map(q => q.id === selectedQuiz.id ? data : q)
        }));
        
        toast({
          title: 'Success',
          description: 'Quiz updated successfully',
        });
      } else {
        const { data, error } = await supabase
          .from('quizzes')
          .insert(quizData)
          .select()
          .single();
        
        if (error) throw error;
        
        setQuizzes(prev => ({
          ...prev,
          [editingQuiz.module_id as string]: [...(prev[editingQuiz.module_id as string] || []), data]
        }));
        
        toast({
          title: 'Success',
          description: 'Quiz created successfully',
        });
      }
      
      setIsQuizModalOpen(false);
    } catch (error: any) {
      console.error('Error saving quiz:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save quiz',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteQuiz = async (quizId: string, moduleId: string) => {
    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);
      
      if (error) throw error;
      
      setQuizzes(prev => ({
        ...prev,
        [moduleId]: (prev[moduleId] || []).filter(q => q.id !== quizId)
      }));
      
      toast({
        title: 'Success',
        description: 'Quiz deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting quiz:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete quiz',
        variant: 'destructive',
      });
    }
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Course Modules</CardTitle>
          <CardDescription>
            Loading modules...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-10">
          <Progress value={30} className="w-1/2 animate-pulse" />
        </CardContent>
      </Card>
    );
  }
  
  const modulesByWeek = modules.reduce((acc, module) => {
    const week = module.week;
    if (!acc[week]) {
      acc[week] = [];
    }
    acc[week].push(module);
    return acc;
  }, {} as Record<number, Module[]>);
  
  const sortedWeeks = Object.keys(modulesByWeek)
    .map(Number)
    .sort((a, b) => a - b);
  
  return (
    <div className="space-y-4 container mx-auto px-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Course Modules</CardTitle>
            <CardDescription>
              Manage the modules and content for this course
            </CardDescription>
          </div>
          <Button onClick={handleAddModule}>
            <Plus className="h-4 w-4 mr-2" />
            Add Module
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading modules...</p>
            </div>
          ) : modules.length === 0 ? (
            <div className="py-8 text-center border rounded-md">
              <p className="text-muted-foreground">No modules yet. Create your first module to get started.</p>
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              className="w-full"
              value={activeModuleId || undefined}
              onValueChange={setActiveModuleId}
            >
              {modules.map((module) => (
                <AccordionItem value={module.id} key={module.id}>
                  <AccordionTrigger className="hover:bg-muted px-4 rounded-md">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center">
                        <span className="text-muted-foreground mr-2">Week {module.week}:</span>
                        <span>{module.title}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditModule(module);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Module</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this module? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                variant="destructive"
                                onClick={() => handleDeleteModule(module.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 p-2">
                      <Tabs defaultValue="lessons" className="w-full">
                        <TabsList className="grid grid-cols-3 mb-4">
                          <TabsTrigger value="lessons">
                            <BookOpen className="h-4 w-4 mr-2" />
                            Lessons
                          </TabsTrigger>
                          <TabsTrigger value="assignments">
                            <ClipboardCheck className="h-4 w-4 mr-2" />
                            Assignments
                          </TabsTrigger>
                          <TabsTrigger value="quizzes">
                            <HelpCircle className="h-4 w-4 mr-2" />
                            Quizzes
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="lessons" className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold">Lessons</h4>
                            <Button
                              size="sm"
                              onClick={() => handleAddLesson(module.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Lesson
                            </Button>
                          </div>
                          
                          {(lessons[module.id]?.length ?? 0) > 0 ? (
                            <div className="space-y-3">
                              {(lessons[module.id] || []).map((lesson) => (
                                <Card key={lesson.id} className="overflow-hidden">
                                  <div className="flex justify-between items-center p-4">
                                    <div>
                                      <h5 className="font-medium">{lesson.title}</h5>
                                      <p className="text-sm text-muted-foreground">{lesson.description || 'No description'}</p>
                                    </div>
                                    <div className="flex space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditLesson(lesson)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive"
                                        onClick={() => handleDeleteLesson(lesson.id, module.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6 bg-muted/20 rounded-md">
                              <p className="text-sm text-muted-foreground">No lessons created yet</p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="assignments" className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold">Assignments</h4>
                            <Button
                              size="sm"
                              onClick={() => handleAddAssignment(module.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Assignment
                            </Button>
                          </div>
                          
                          {(assignments[module.id]?.length ?? 0) > 0 ? (
                            <div className="space-y-3">
                              {(assignments[module.id] || []).map((assignment) => (
                                <Card key={assignment.id} className="overflow-hidden">
                                  <div className="flex justify-between items-center p-4">
                                    <div>
                                      <h5 className="font-medium">{assignment.title}</h5>
                                      <p className="text-sm text-muted-foreground">{assignment.description || 'No description'}</p>
                                      <div className="flex space-x-4 mt-2">
                                        <span className="text-xs text-muted-foreground">Due: {assignment.due_date || 'Not set'}</span>
                                        <span className="text-xs text-muted-foreground">Points: {assignment.points}</span>
                                      </div>
                                    </div>
                                    <div className="flex space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditAssignment(assignment)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive"
                                        onClick={() => handleDeleteAssignment(assignment.id, module.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6 bg-muted/20 rounded-md">
                              <p className="text-sm text-muted-foreground">No assignments created yet</p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="quizzes" className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold">Quizzes</h4>
                            <Button
                              size="sm"
                              onClick={() => handleAddQuiz(module.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Quiz
                            </Button>
                          </div>
                          
                          {(quizzes[module.id]?.length ?? 0) > 0 ? (
                            <div className="space-y-3">
                              {(quizzes[module.id] || []).map((quiz) => (
                                <Card key={quiz.id} className="overflow-hidden">
                                  <div className="flex justify-between items-center p-4">
                                    <div>
                                      <h5 className="font-medium">{quiz.title}</h5>
                                      <p className="text-sm text-muted-foreground">{quiz.description || 'No description'}</p>
                                      <div className="flex space-x-4 mt-2">
                                        <span className="text-xs text-muted-foreground">Questions: {quiz.questions?.length || 0}</span>
                                        <span className="text-xs text-muted-foreground">Time: {quiz.time_limit || 0} min</span>
                                      </div>
                                    </div>
                                    <div className="flex space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditQuiz(quiz)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive"
                                        onClick={() => handleDeleteQuiz(quiz.id, module.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6 bg-muted/20 rounded-md">
                              <p className="text-sm text-muted-foreground">No quizzes created yet</p>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isLessonModalOpen} onOpenChange={setIsLessonModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedLesson ? 'Edit Lesson' : 'Add New Lesson'}</DialogTitle>
            <DialogDescription>
              {selectedLesson ? 'Update the lesson information.' : 'Create a new lesson for this module.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="lesson-title">Title</Label>
              <Input
                id="lesson-title"
                name="title"
                value={editingLesson.title || ''}
                onChange={handleLessonChange}
                placeholder="Enter lesson title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lesson-description">Description</Label>
              <Textarea
                id="lesson-description"
                name="description"
                value={editingLesson.description || ''}
                onChange={handleLessonChange}
                placeholder="Enter lesson description"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lesson-content">Content</Label>
              <Textarea
                id="lesson-content"
                name="content"
                value={editingLesson.content || ''}
                onChange={handleLessonChange}
                placeholder="Enter lesson content"
                rows={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="lesson-duration">Duration (e.g., "30 min")</Label>
                <Input
                  id="lesson-duration"
                  name="duration"
                  value={editingLesson.duration || ''}
                  onChange={handleLessonChange}
                  placeholder="e.g., 30 min"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lesson-order">Order</Label>
                <Input
                  id="lesson-order"
                  name="order_num"
                  type="number"
                  min="1"
                  value={editingLesson.order_num || 1}
                  onChange={handleLessonChange}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLessonModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLesson}>
              {selectedLesson ? 'Update Lesson' : 'Create Lesson'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAssignmentModalOpen} onOpenChange={setIsAssignmentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAssignment ? 'Edit Assignment' : 'Add New Assignment'}</DialogTitle>
            <DialogDescription>
              {selectedAssignment ? 'Update the assignment information.' : 'Create a new assignment for this module.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="assignment-title">Title</Label>
              <Input
                id="assignment-title"
                name="title"
                value={editingAssignment.title || ''}
                onChange={handleAssignmentChange}
                placeholder="Enter assignment title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignment-description">Description</Label>
              <Textarea
                id="assignment-description"
                name="description"
                value={editingAssignment.description || ''}
                onChange={handleAssignmentChange}
                placeholder="Enter assignment description"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="assignment-due-date">Due Date</Label>
                <Input
                  id="assignment-due-date"
                  name="due_date"
                  type="date"
                  value={editingAssignment.due_date || ''}
                  onChange={handleAssignmentChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="assignment-points">Points</Label>
                <Input
                  id="assignment-points"
                  name="points"
                  type="number"
                  min="0"
                  value={editingAssignment.points || 0}
                  onChange={handleAssignmentChange}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignmentModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAssignment}>
              {selectedAssignment ? 'Update Assignment' : 'Create Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isQuizModalOpen} onOpenChange={setIsQuizModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedQuiz ? 'Edit Quiz' : 'Add New Quiz'}</DialogTitle>
            <DialogDescription>
              {selectedQuiz ? 'Update the quiz information and questions.' : 'Create a new quiz for this module.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quiz-title">Title</Label>
              <Input
                id="quiz-title"
                name="title"
                value={editingQuiz.title || ''}
                onChange={handleQuizChange}
                placeholder="Enter quiz title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quiz-description">Description</Label>
              <Textarea
                id="quiz-description"
                name="description"
                value={editingQuiz.description || ''}
                onChange={handleQuizChange}
                placeholder="Enter quiz description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quiz-time-limit">Time Limit (minutes)</Label>
                <Input
                  id="quiz-time-limit"
                  name="time_limit"
                  type="number"
                  min="1"
                  value={editingQuiz.time_limit || 30}
                  onChange={handleQuizChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quiz-passing-score">Passing Score (%)</Label>
                <Input
                  id="quiz-passing-score"
                  name="passing_score"
                  type="number"
                  min="0"
                  max="100"
                  value={editingQuiz.passing_score || 70}
                  onChange={handleQuizChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quiz-due-date">Due Date (optional)</Label>
                <Input
                  id="quiz-due-date"
                  name="due_date"
                  type="date"
                  value={editingQuiz.due_date || ''}
                  onChange={handleQuizChange}
                />
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium">Quiz Questions</h4>
                <Badge variant="outline" className="ml-2">
                  {editingQuiz.questions?.length || 0} Questions
                </Badge>
              </div>
              
              {(editingQuiz.questions?.length ?? 0) > 0 && (
                <div className="space-y-4 mb-4">
                  {editingQuiz.questions?.map((question, index) => (
                    <Card key={question.id} className="p-4">
                      <div className="flex justify-between mb-2">
                        <h5 className="font-medium">Question {index + 1}</h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => handleRemoveQuestion(question.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mb-2">{question.text}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {question.options.map((option, optIndex) => (
                          <div 
                            key={optIndex} 
                            className={`p-2 border rounded-md ${
                              optIndex === question.correctOption ? 'bg-green-50 border-green-300' : ''
                            }`}
                          >
                            {optIndex === question.correctOption && (
                              <Badge className="mb-1 bg-green-500">Correct</Badge>
                            )}
                            <p className="text-sm">{option}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              
              <Card className="p-4">
                <h5 className="font-medium mb-3">Add New Question</h5>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="question-text">Question Text</Label>
                    <Textarea
                      id="question-text"
                      name="text"
                      value={editingQuestion.text || ''}
                      onChange={handleQuestionChange}
                      placeholder="Enter question text"
                      rows={2}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>Answer Options</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {editingQuestion.options?.map((option, index) => (
                        <div key={index} className="flex space-x-2">
                          <Input
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                            className={index === editingQuestion.correctOption ? 'border-green-500' : ''}
                          />
                          <Button
                            type="button"
                            variant={index === editingQuestion.correctOption ? 'default' : 'outline'}
                            className="shrink-0 w-24"
                            onClick={() => handleCorrectOptionChange(index)}
                          >
                            {index === editingQuestion.correctOption ? 'Correct' : 'Make Correct'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="question-points">Points</Label>
                      <Input
                        id="question-points"
                        name="points"
                        type="number"
                        min="1"
                        value={editingQuestion.points || 10}
                        onChange={handleQuestionChange}
                      />
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    className="w-full mt-2"
                    onClick={handleAddQuestion}
                    disabled={!editingQuestion.text || editingQuestion.options?.some(o => !o)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Question
                  </Button>
                </div>
              </Card>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuizModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveQuiz}
              disabled={!editingQuiz.title || (editingQuiz.questions?.length || 0) < 1}
            >
              {selectedQuiz ? 'Update Quiz' : 'Create Quiz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedModule ? 'Edit Module' : 'Add New Module'}</DialogTitle>
            <DialogDescription>
              {selectedModule
                ? 'Update the module information.'
                : 'Create a new module for your course.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={editingModule.title || ''}
                onChange={handleChange}
                placeholder="Enter module title"
              />
              {errors.title && (
                <p className="text-destructive text-sm">{errors.title}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="description">Description</Label>
                <AIContentGenerator onGenerate={handleAIContentGenerated} />
              </div>
              <Textarea
                id="description"
                name="description"
                value={editingModule.description || ''}
                onChange={handleChange}
                placeholder="Enter module description"
                rows={5}
              />
              {errors.description && (
                <p className="text-destructive text-sm">{errors.description}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="week">Week Number</Label>
              <Input
                id="week"
                name="week"
                type="number"
                min="1"
                value={editingModule.week || 1}
                onChange={handleChange}
              />
              {errors.week && (
                <p className="text-destructive text-sm">{errors.week}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveModule}>
              {selectedModule ? 'Update Module' : 'Create Module'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModuleManager;
