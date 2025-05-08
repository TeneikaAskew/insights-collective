import React, { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, ArrowRight, Zap, Lightbulb, BookOpen, Briefcase, TrendingUp, Target, Award, Edit3, Save, X, PlusCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CareerAIRecommendations } from '@/components/career/CareerAIRecommendations';
import { PageTitle } from '@/components/PageTitle';

interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  interests?: string[];
  current_skills?: { name: string; level: number }[];
  career_goals?: string;
  learning_style?: string;
  time_commitment?: string;
}

interface CareerPathwayData {
  id: string;
  user_id: string;
  pathway_title: string;
  current_role?: string;
  target_role: string;
  motivation?: string;
  created_at?: string;
  updated_at?: string;
  jobs: JobRole[];
  skills: Skill[];
  projects: ProjectIdea[];
  resources: LearningResource[];
  custom_tasks: CustomTask[];
  progress_overview: {
    total_items: number;
    completed_items: number;
    percentage: number;
  };
  career_suggestions?: string[];
  network_contacts?: { name: string; linkedIn?: string; notes?: string }[];
  achievements?: { title: string; date: string; description?: string }[];
}

interface JobRole {
  title: string;
  description: string;
  requirements: string[];
  level: string;
}

interface Skill {
  name: string;
  level: number;
  category: string;
}

interface ProjectIdea {
  title: string;
  description: string;
  skills_to_apply: string[];
}

interface LearningResource {
  title: string;
  type: string;
  url: string;
  estimated_time?: string;
}

interface CustomTask {
  id: string;
  description: string;
  due_date?: string;
  completed: boolean;
  category?: string;
}


const examplePathwayId = "user123-example-pathway";

const sampleData: CareerPathwayData = {
  id: examplePathwayId,
  user_id: "user123",
  pathway_title: "Aspiring Data Scientist",
  current_role: "Student",
  target_role: "Data Scientist",
  motivation: "Passionate about solving complex problems with data and AI.",
  jobs: [
    { title: "Data Analyst Intern", description: "Entry-level role focusing on data collection and basic analysis.", requirements: ["Basic Excel", "SQL fundamentals"], level: "Internship" },
    { title: "Junior Data Scientist", description: "Role involving model building and data visualization under supervision.", requirements: ["Python (pandas, scikit-learn)", "Statistics"], level: "Entry-level" },
    { title: "Data Scientist", description: "Independently lead projects, develop advanced models, and present findings.", requirements: ["Machine Learning", "Big Data Technologies", "Communication Skills"], level: "Mid-level" },
  ],
  skills: [
    { name: "SQL", level: 3, category: "Technical" },
    { name: "Python", level: 2, category: "Technical" },
    { name: "Machine Learning", level: 1, category: "Technical" },
    { name: "Communication", level: 3, category: "Soft Skill" },
    { name: "Problem Solving", level: 4, category: "Soft Skill" },
    { name: "Tableau", level: 2, category: "Tool" },
  ],
  projects: [
    { title: "Customer Churn Prediction", description: "Build a model to predict customer churn for a telecom company.", skills_to_apply: ["Python", "Machine Learning", "SQL"] },
    { title: "Sales Dashboard", description: "Create an interactive dashboard to visualize sales performance.", skills_to_apply: ["Tableau", "SQL", "Data Visualization"] },
  ],
  resources: [
    { title: "Andrew Ng's Machine Learning Course", type: "Course", url: "https://www.coursera.org/learn/machine-learning", estimated_time: "60 hours" },
    { title: "Python for Data Analysis by Wes McKinney", type: "Book", url: "#", estimated_time: "40 hours" },
    { title: "3Blue1Brown Essence of Linear Algebra", type: "Video Series", url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab", estimated_time: "10 hours" },
  ],
  custom_tasks: [
    { id: "task1", description: "Attend a local data science meetup.", completed: false, category: "Networking" },
    { id: "task2", description: "Update LinkedIn profile with new skills.", completed: true, category: "Career Development" },
  ],
  progress_overview: {
    total_items: 20,
    completed_items: 5,
    percentage: 25,
  },
  career_suggestions: [
    "Focus on building a strong portfolio with diverse projects.",
    "Network actively with professionals in the field.",
    "Consider specializing in an industry like healthcare or finance after gaining general experience."
  ],
  network_contacts: [
    { name: "Jane Doe", linkedIn: "linkedin.com/in/janedoe", notes: "Met at conference, works at Google."}
  ],
  achievements: [
    { title: "Completed Data Science Bootcamp", date: "2023-12-01", description: "Intensive 3-month program."}
  ]
};

const CareerPathway: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pathwayData, setPathwayData] = useState<CareerPathwayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<Partial<Record<keyof CareerPathwayData | 'jobs' | 'skills' | 'projects' | 'resources' | 'custom_tasks', boolean | Record<string, boolean>>>>({});
  const [editData, setEditData] = useState<Partial<CareerPathwayData>>({});

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [currentEditItem, setCurrentEditItem] = useState<any>(null);
  const [editItemType, setEditItemType] = useState<string | null>(null);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (error) throw error;
          setUserProfile(data);
        } catch (error: any) {
          toast({ title: "Error fetching profile", description: error.message, variant: "destructive" });
        }
      }
    };

    const fetchPathwayData = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('career_pathways')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) throw error;

          if (data) {
            setPathwayData(data as CareerPathwayData);
          } else {
            setPathwayData({ ...sampleData, user_id: user.id, id: examplePathwayId });
             toast({ title: "No pathway found", description: "Displaying sample pathway. AI generation coming soon!", variant: "default" });
          }
        } catch (error: any) {
          toast({ title: "Error fetching pathway data", description: error.message, variant: "destructive" });
          setPathwayData({ ...sampleData, user_id: user.id, id: examplePathwayId });
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    fetchUserProfile();
    fetchPathwayData();
  }, [user, toast]);

  const calculatedProgress = useMemo(() => {
    if (!pathwayData) return { completed_items: 0, total_items: 0, percentage: 0 };
    
    const skillLevels = pathwayData.skills.reduce((acc, skill) => acc + (skill.level || 0), 0);
    const totalSkillLevelsPossible = pathwayData.skills.length * 5;

    const completedProjects = pathwayData.projects.filter(p => {
        return false;
    }).length;
    const totalProjects = pathwayData.projects.length;

    const completedResources = pathwayData.resources.filter(r => {
        return false;
    }).length;
    const totalResources = pathwayData.resources.length;

    const completedCustomTasks = pathwayData.custom_tasks.filter(t => t.completed).length;
    const totalCustomTasks = pathwayData.custom_tasks.length;

    const completedItems = (skillLevels / (totalSkillLevelsPossible || 1)) * 50 +
                           (completedProjects / (totalProjects || 1)) * 20 +
                           (completedResources / (totalResources || 1)) * 15 +
                           (completedCustomTasks / (totalCustomTasks || 1)) * 15;
    
    const allTasks = pathwayData.custom_tasks;
    const completed = allTasks.filter(t => t.completed).length;
    const total = allTasks.length;
    
    return {
      completed_items: completed,
      total_items: total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [pathwayData]);


  const handleEdit = (section: keyof CareerPathwayData | 'jobs' | 'skills' | 'projects' | 'resources' | 'custom_tasks', index?: number) => {
    setIsEditing(prev => ({ ...prev, [section]: index !== undefined ? { ...(prev[section] as Record<string,boolean>), [index]: true } : true }));
    if (pathwayData) {
        if (index !== undefined && Array.isArray(pathwayData[section as keyof CareerPathwayData])) {
            setCurrentEditItem((pathwayData[section as keyof CareerPathwayData] as any[])[index]);
            setEditItemType(section.toString().slice(0, -1));
        } else {
             setCurrentEditItem({ value: pathwayData[section as keyof CareerPathwayData] });
            setEditItemType(section.toString());
        }
        setEditingSection(section.toString() + (index !== undefined ? `[${index}]` : ''));
    }
  };
  
  const handleSaveEdit = async () => {
    if (!user || !pathwayData || !editingSection || !currentEditItem) return;

    let updatedPathwayData = { ...pathwayData };

    if (editingSection.includes('[')) {
        const [sectionName, indexStr] = editingSection.replace(']', '').split('[');
        const index = parseInt(indexStr);
        if (Array.isArray(updatedPathwayData[sectionName as keyof CareerPathwayData])) {
            (updatedPathwayData[sectionName as keyof CareerPathwayData] as any[])[index] = currentEditItem;
        }
    } else {
        (updatedPathwayData as any)[editingSection] = currentEditItem.value;
    }
    
    setPathwayData(updatedPathwayData);
    
    try {
        const { data, error } = await supabase
            .from('career_pathways')
            .update(updatedPathwayData)
            .eq('id', pathwayData.id)
            .select()
            .single();

        if (error) throw error;
        setPathwayData(data as CareerPathwayData);
        toast({ title: "Success", description: `${editItemType || 'Pathway'} updated successfully.` });
    } catch (error: any) {
        toast({ title: "Error updating pathway", description: error.message, variant: "destructive" });
    } finally {
        setEditingSection(null);
        setCurrentEditItem(null);
        setEditItemType(null);
    }
};


  const handleCancelEdit = () => {
    setEditingSection(null);
    setCurrentEditItem(null);
    setEditItemType(null);
  };

  const handleInputChange = (field: string, value: any) => {
    setCurrentEditItem((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleAddItem = (type: 'job' | 'skill' | 'project' | 'resource' | 'custom_task') => {
    setNewItemType(type);
    let newItem: any = {};
    switch (type) {
        case 'job': newItem = { title: '', description: '', requirements: [], level: '' }; break;
        case 'skill': newItem = { name: '', level: 0, category: '' }; break;
        case 'project': newItem = { title: '', description: '', skills_to_apply: [] }; break;
        case 'resource': newItem = { title: '', type: '', url: '' }; break;
        case 'custom_task': newItem = { id: `task-${Date.now()}`, description: '', completed: false }; break;
    }
    setCurrentEditItem(newItem);
    setIsAddItemDialogOpen(true);
  };

  const handleSaveNewItem = async () => {
    if (!user || !pathwayData || !newItemType || !currentEditItem) return;

    const sectionMap = {
        job: 'jobs', skill: 'skills', project: 'projects', resource: 'resources', custom_task: 'custom_tasks'
    };
    const sectionKey = sectionMap[newItemType as keyof typeof sectionMap] as keyof CareerPathwayData;
    
    const updatedSectionArray = [...(pathwayData[sectionKey] as any[] || []), currentEditItem];
    const updatedPathwayData = { ...pathwayData, [sectionKey]: updatedSectionArray };

    setPathwayData(updatedPathwayData);

    try {
        const { data, error } = await supabase
            .from('career_pathways')
            .update({ [sectionKey]: updatedSectionArray, updated_at: new Date().toISOString() })
            .eq('id', pathwayData.id)
            .select()
            .single();
        if (error) throw error;
        setPathwayData(data as CareerPathwayData);
        toast({ title: "Success", description: `${newItemType} added successfully.`});
    } catch (error: any) {
        toast({ title: `Error adding ${newItemType}`, description: error.message, variant: "destructive" });
    } finally {
        setIsAddItemDialogOpen(false);
        setNewItemType(null);
        setCurrentEditItem(null);
    }
  };
  
  const handleDeleteItem = async (type: 'job' | 'skill' | 'project' | 'resource' | 'custom_task', index: number) => {
    if (!pathwayData) return;

    const sectionMap = {
        job: 'jobs', skill: 'skills', project: 'projects', resource: 'resources', custom_task: 'custom_tasks'
    };
    const sectionKey = sectionMap[type as keyof typeof sectionMap] as keyof CareerPathwayData;

    const currentArray = pathwayData[sectionKey] as any[];
    const updatedArray = currentArray.filter((_, i) => i !== index);
    const updatedPathwayData = { ...pathwayData, [sectionKey]: updatedArray };

    setPathwayData(updatedPathwayData);

     try {
        const { data, error } = await supabase
            .from('career_pathways')
            .update({ [sectionKey]: updatedArray, updated_at: new Date().toISOString() })
            .eq('id', pathwayData.id)
            .select()
            .single();
        if (error) throw error;
        setPathwayData(data as CareerPathwayData);
        toast({ title: "Success", description: `${type} deleted successfully.`});
    } catch (error: any) {
        toast({ title: `Error deleting ${type}`, description: error.message, variant: "destructive" });
    }
  };

  const renderEditDialogFields = () => {
    if (!currentEditItem || (!editingSection && !isAddItemDialogOpen)) return null;

    const itemType = editItemType || newItemType;

    switch (itemType) {
      case 'pathway_title':
      case 'current_role':
      case 'target_role':
      case 'motivation':
        return <Input value={currentEditItem.value || ''} onChange={(e) => handleInputChange('value', e.target.value)} />;
      case 'job':
        return (
          <>
            <Input placeholder="Job Title" value={currentEditItem.title || ''} onChange={(e) => handleInputChange('title', e.target.value)} className="mb-2"/>
            <Textarea placeholder="Description" value={currentEditItem.description || ''} onChange={(e) => handleInputChange('description', e.target.value)} className="mb-2"/>
            <Input placeholder="Requirements (comma-separated)" value={(currentEditItem.requirements || []).join(', ')} onChange={(e) => handleInputChange('requirements', e.target.value.split(',').map(s => s.trim()))} className="mb-2"/>
            <Input placeholder="Level (e.g. Entry, Mid, Senior)" value={currentEditItem.level || ''} onChange={(e) => handleInputChange('level', e.target.value)} />
          </>
        );
      case 'skill':
        return (
          <>
            <Input placeholder="Skill Name" value={currentEditItem.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} className="mb-2"/>
            <Input type="number" placeholder="Level (0-5)" value={currentEditItem.level || 0} onChange={(e) => handleInputChange('level', parseInt(e.target.value))} className="mb-2"/>
            <Input placeholder="Category (e.g. Technical, Soft)" value={currentEditItem.category || ''} onChange={(e) => handleInputChange('category', e.target.value)} />
          </>
        );
      case 'project':
         return (
            <>
                <Input placeholder="Project Title" value={currentEditItem.title || ''} onChange={(e) => handleInputChange('title', e.target.value)} className="mb-2"/>
                <Textarea placeholder="Description" value={currentEditItem.description || ''} onChange={(e) => handleInputChange('description', e.target.value)} className="mb-2"/>
                <Input placeholder="Skills to Apply (comma-separated)" value={(currentEditItem.skills_to_apply || []).join(', ')} onChange={(e) => handleInputChange('skills_to_apply', e.target.value.split(',').map(s => s.trim()))} />
            </>
         );
      case 'resource':
          return (
            <>
                <Input placeholder="Resource Title" value={currentEditItem.title || ''} onChange={(e) => handleInputChange('title', e.target.value)} className="mb-2"/>
                <Input placeholder="Type (e.g. Course, Article)" value={currentEditItem.type || ''} onChange={(e) => handleInputChange('type', e.target.value)} className="mb-2"/>
                <Input placeholder="URL" value={currentEditItem.url || ''} onChange={(e) => handleInputChange('url', e.target.value)} className="mb-2"/>
                <Input placeholder="Est. Time (e.g. 10 hours)" value={currentEditItem.estimated_time || ''} onChange={(e) => handleInputChange('estimated_time', e.target.value)} />
            </>
          );
      case 'custom_task':
          return (
            <>
                <Textarea placeholder="Task Description" value={currentEditItem.description || ''} onChange={(e) => handleInputChange('description', e.target.value)} className="mb-2"/>
                 <div className="flex items-center space-x-2">
                    <input type="checkbox" id="taskCompleted" checked={currentEditItem.completed || false} onChange={(e) => handleInputChange('completed', e.target.checked)} />
                    <label htmlFor="taskCompleted">Completed</label>
                </div>
            </>
          );
      default:
        return <p>Unsupported item type for editing.</p>;
    }
  };
  
  if (isLoading) return <AppLayout><div className="container mx-auto p-4 text-center">Loading pathway...</div></AppLayout>;
  if (!user) return <AppLayout><div className="container mx-auto p-4 text-center">Please log in to view your career pathway.</div></AppLayout>;
  if (!pathwayData) return <AppLayout><div className="container mx-auto p-4 text-center">Could not load career pathway data. AI generation coming soon.</div></AppLayout>;

  const { pathway_title, current_role, target_role, motivation, jobs, skills, projects, resources, custom_tasks } = pathwayData;
  const progress = calculatedProgress;


  return (
    <AppLayout>
      <PageTitle title={pathway_title || "My Career Pathway"} description="Your personalized roadmap to professional success." />
      <div className="container mx-auto p-4 space-y-8">
        
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-3xl font-bold text-primary">
                {editingSection === 'pathway_title' ? (
                    <Input value={currentEditItem?.value || ''} onChange={(e) => handleInputChange('value', e.target.value)} className="text-3xl font-bold"/>
                ) : pathway_title}
              </CardTitle>
              {editingSection === 'pathway_title' ? (
                 <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} size="sm"><Save className="h-4 w-4 mr-2"/>Save</Button>
                    <Button onClick={handleCancelEdit} variant="outline" size="sm"><X className="h-4 w-4 mr-2"/>Cancel</Button>
                 </div>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => handleEdit('pathway_title')}>
                  <Edit3 className="h-5 w-5 text-muted-foreground hover:text-primary" />
                </Button>
              )}
            </div>
            <CardDescription className="text-lg text-muted-foreground">
              Your personalized roadmap from {editingSection === 'current_role' ? <Input value={currentEditItem?.value || ''} onChange={(e) => handleInputChange('value', e.target.value)} /> : (current_role || "your current position")} to {editingSection === 'target_role' ? <Input value={currentEditItem?.value || ''} onChange={(e) => handleInputChange('value', e.target.value)} /> : (target_role || "your dream job")}.
              { (editingSection === 'current_role' || editingSection === 'target_role') ? (
                 <div className="flex gap-2 mt-1">
                    <Button onClick={handleSaveEdit} size="sm"><Save className="h-4 w-4 mr-2"/>Save</Button>
                    <Button onClick={handleCancelEdit} variant="outline" size="sm"><X className="h-4 w-4 mr-2"/>Cancel</Button>
                 </div>
              ) : (
                <>
                <Button variant="ghost" size="icon" onClick={() => handleEdit('current_role')} className="ml-1"><Edit3 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleEdit('target_role')}><Edit3 className="h-4 w-4" /></Button>
                </>
              )}
            </CardDescription>
            {motivation && (
              <p className="mt-2 text-sm italic">
                <span className="font-semibold">Motivation: </span> 
                {editingSection === 'motivation' ? <Textarea value={currentEditItem?.value || ''} onChange={(e) => handleInputChange('value', e.target.value)} /> : motivation}
                {editingSection === 'motivation' ? (
                    <div className="flex gap-2 mt-1">
                        <Button onClick={handleSaveEdit} size="sm"><Save className="h-4 w-4 mr-2"/>Save</Button>
                        <Button onClick={handleCancelEdit} variant="outline" size="sm"><X className="h-4 w-4 mr-2"/>Cancel</Button>
                    </div>
                ) : (
                    <Button variant="ghost" size="icon" onClick={() => handleEdit('motivation')} className="ml-1"><Edit3 className="h-4 w-4" /></Button>
                )}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Progress value={progress.percentage} className="w-full h-3" />
              <span className="text-sm font-medium text-primary">{progress.percentage}% Complete</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{progress.completed_items} of {progress.total_items} tasks/milestones achieved.</p>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
            <TabsTrigger value="overview"><Target className="h-4 w-4 mr-2" />Overview</TabsTrigger>
            <TabsTrigger value="jobs"><Briefcase className="h-4 w-4 mr-2" />Job Roles</TabsTrigger>
            <TabsTrigger value="skills"><Zap className="h-4 w-4 mr-2" />Skills</TabsTrigger>
            <TabsTrigger value="projects"><Lightbulb className="h-4 w-4 mr-2" />Projects</TabsTrigger>
            <TabsTrigger value="resources"><BookOpen className="h-4 w-4 mr-2" />Resources</TabsTrigger>
            <TabsTrigger value="tasks"><CheckCircle className="h-4 w-4 mr-2" />Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Pathway Overview</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p><span className="font-semibold">Target Role:</span> {target_role}</p>
                <p><span className="font-semibold">Key Milestones:</span> The pathway includes {jobs.length} job progression stages, developing {skills.length} core skills, completing {projects.length} portfolio projects, and utilizing {resources.length} learning resources.</p>
                <p className="text-muted-foreground">This is a dynamic plan. Feel free to adjust it as you learn and grow. Use the edit buttons to customize sections or items.</p>
                {pathwayData.career_suggestions && pathwayData.career_suggestions.length > 0 && (
                    <div>
                        <h4 className="font-semibold mt-4 mb-2">AI Career Suggestions:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            {pathwayData.career_suggestions.map((suggestion, idx) => <li key={idx}>{suggestion}</li>)}
                        </ul>
                    </div>
                )}
              </CardContent>
            </Card>
            <CareerAIRecommendations pathway={pathwayData} userProfile={userProfile} onUpdatePathway={setPathwayData} />
          </TabsContent>

          <TabsContent value="jobs" className="mt-6">
            <div className="flex justify-between items-center mb-4">
                <CardTitle>Job Roles Progression</CardTitle>
                <Button onClick={() => handleAddItem('job')} size="sm"><PlusCircle className="h-4 w-4 mr-2"/>Add Job Role</Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job, index) => (
                <Card key={index} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-xl">{job.title}</CardTitle>
                        <Badge variant="outline">{job.level}</Badge>
                    </div>
                    <CardDescription>{job.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <h4 className="font-semibold mb-1 text-sm">Key Requirements:</h4>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {job.requirements.map((req, i) => <li key={i}>{req}</li>)}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm" onClick={() => { setCurrentEditItem(job); setEditItemType('job'); setEditingSection(`jobs[${index}]`); setIsAddItemDialogOpen(true); }}><Edit3 className="h-4 w-4 mr-2" />Edit</Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 ml-2" onClick={() => handleDeleteItem('job', index)}><Trash2 className="h-4 w-4 mr-2"/>Delete</Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="skills" className="mt-6">
            <div className="flex justify-between items-center mb-4">
                <CardTitle>Skills to Develop</CardTitle>
                <Button onClick={() => handleAddItem('skill')} size="sm"><PlusCircle className="h-4 w-4 mr-2"/>Add Skill</Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">{skill.name}</CardTitle>
                        <Badge>{skill.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                        <span>Proficiency Level:</span>
                        <div className="flex items-center">
                            {[1,2,3,4,5].map(l => (
                                <Zap key={l} className={`h-5 w-5 ${l <= skill.level ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                            ))}
                            <span className="ml-2">({skill.level}/5)</span>
                        </div>
                    </div>
                  </CardContent>
                   <CardFooter>
                    <Button variant="outline" size="sm" onClick={() => { setCurrentEditItem(skill); setEditItemType('skill'); setEditingSection(`skills[${index}]`); setIsAddItemDialogOpen(true); }}><Edit3 className="h-4 w-4 mr-2" />Edit</Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 ml-2" onClick={() => handleDeleteItem('skill', index)}><Trash2 className="h-4 w-4 mr-2"/>Delete</Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="mt-6">
            <div className="flex justify-between items-center mb-4">
                <CardTitle>Portfolio Projects</CardTitle>
                <Button onClick={() => handleAddItem('project')} size="sm"><PlusCircle className="h-4 w-4 mr-2"/>Add Project</Button>
            </div>
            <div className="space-y-6">
              {projects.map((project, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle>{project.title}</CardTitle>
                    <CardDescription>{project.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <h4 className="font-semibold text-sm mb-1">Skills to Apply:</h4>
                    <div className="flex flex-wrap gap-2">
                      {project.skills_to_apply.map((skill, i) => <Badge key={i} variant="secondary">{skill}</Badge>)}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm" onClick={() => { setCurrentEditItem(project); setEditItemType('project'); setEditingSection(`projects[${index}]`); setIsAddItemDialogOpen(true); }}><Edit3 className="h-4 w-4 mr-2" />Edit</Button>
                    <Button variant="ghost
