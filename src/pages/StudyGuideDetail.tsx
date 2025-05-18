
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStudyGuides } from '@/hooks/useStudyGuides';
import { useJobDescriptions } from '@/hooks/useJobDescriptions';
import { JobDescription, StudyGuide, TechnicalChecklistItem } from '@/types/interview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { ChevronLeft, Calendar, Lightbulb, ListChecks, Star, CheckCircle2, BarChart } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

const StudyGuideDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getStudyGuide, updateStudyGuideChecklist } = useStudyGuides();
  const { getJobDescription } = useJobDescriptions();
  const [studyGuide, setStudyGuide] = useState<StudyGuide | null>(null);
  const [jobDescription, setJobDescription] = useState<JobDescription | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      
      setLoading(true);
      const guideData = await getStudyGuide(id);
      setStudyGuide(guideData);
      
      if (guideData?.job_description_id) {
        const jobData = await getJobDescription(guideData.job_description_id);
        setJobDescription(jobData);
      }
      
      setLoading(false);
    };
    
    loadData();
  }, [id, getStudyGuide, getJobDescription]);
  
  const handleToggleChecklistItem = async (itemId: string) => {
    if (!studyGuide) return;
    
    // Create a deep copy of the checklist
    const updatedChecklist = studyGuide.technical_checklist.map(item => {
      if (item.id === itemId) {
        return { ...item, is_reviewed: !item.is_reviewed };
      }
      return item;
    });
    
    // Update the local state optimistically
    setStudyGuide({
      ...studyGuide,
      technical_checklist: updatedChecklist
    });
    
    // Save to the database
    const success = await updateStudyGuideChecklist(studyGuide.id, updatedChecklist);
    if (!success) {
      // If the update failed, revert the local state
      toast({
        title: "Update failed",
        description: "Failed to update checklist item",
        variant: "destructive"
      });
      // Reset the study guide by re-fetching it
      const freshData = await getStudyGuide(studyGuide.id);
      setStudyGuide(freshData);
    }
  };
  
  const getChecklistProgress = (): { completed: number; total: number; percent: number } => {
    if (!studyGuide) return { completed: 0, total: 0, percent: 0 };
    
    const total = studyGuide.technical_checklist.length;
    const completed = studyGuide.technical_checklist.filter(item => item.is_reviewed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percent };
  };
  
  // Group checklist items by category
  const groupedChecklist = studyGuide?.technical_checklist.reduce<Record<string, TechnicalChecklistItem[]>>(
    (groups, item) => {
      const category = item.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
      return groups;
    },
    {}
  ) || {};
  
  if (loading) {
    return (
      <div className="container mx-auto py-10 flex justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  
  if (!studyGuide) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-center">Study guide not found</h2>
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => navigate('/interview')}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Interview Prep
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const jobTitle = jobDescription?.parsed_fields?.title || 'Job Position';
  const formattedDate = format(new Date(studyGuide.created_at), 'PPP');
  const progress = getChecklistProgress();
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => navigate('/interview')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <CardTitle className="text-xl">Study Guide: {jobTitle}</CardTitle>
              <CardDescription className="flex items-center mt-1">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                Created on {formattedDate}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="competencies">
            <TabsList className="mb-6">
              <TabsTrigger value="competencies">
                <Lightbulb className="h-4 w-4 mr-2" />
                Competencies
              </TabsTrigger>
              <TabsTrigger value="questions">
                <Star className="h-4 w-4 mr-2" />
                Questions
              </TabsTrigger>
              <TabsTrigger value="checklist">
                <ListChecks className="h-4 w-4 mr-2" />
                Technical Checklist
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="competencies">
              <div className="space-y-6">
                {studyGuide.competencies.map(competency => (
                  <Card key={competency.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{competency.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{competency.description}</p>
                      
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Related Questions:</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {studyGuide.questions
                            .filter(q => q.competency_id === competency.id)
                            .map(q => (
                              <li key={q.id}>{q.question}</li>
                            ))
                          }
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="questions">
              <div className="space-y-6">
                <Accordion type="multiple" className="w-full">
                  {studyGuide.questions.map(question => {
                    const competency = studyGuide.competencies.find(c => c.id === question.competency_id);
                    return (
                      <AccordionItem key={question.id} value={question.id}>
                        <AccordionTrigger>
                          <div className="flex flex-col items-start text-left">
                            <span>{question.question}</span>
                            {competency && (
                              <Badge variant="outline" className="mt-1">
                                {competency.name}
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {question.sample_answer ? (
                            <div className="space-y-4 p-2">
                              <div>
                                <h4 className="font-semibold">Situation</h4>
                                <p className="mt-1">{question.sample_answer.situation}</p>
                              </div>
                              <div>
                                <h4 className="font-semibold">Task</h4>
                                <p className="mt-1">{question.sample_answer.task}</p>
                              </div>
                              <div>
                                <h4 className="font-semibold">Action</h4>
                                <p className="mt-1">{question.sample_answer.action}</p>
                              </div>
                              <div>
                                <h4 className="font-semibold">Result</h4>
                                <p className="mt-1">{question.sample_answer.result}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-center text-muted-foreground py-4">
                              No sample answer available
                            </p>
                          )}
                          
                          <div className="mt-4 pt-4 border-t">
                            <Button variant="outline" disabled>
                              Practice Answer (Coming Soon)
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </TabsContent>
            
            <TabsContent value="checklist">
              <div className="space-y-6">
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium flex items-center">
                        <BarChart className="h-4 w-4 mr-2" />
                        Study Progress
                      </h3>
                      <span className="font-semibold">
                        {progress.completed} of {progress.total} topics ({progress.percent}%)
                      </span>
                    </div>
                    
                    <div className="w-full h-2 bg-muted rounded-full">
                      <div 
                        className="h-2 bg-primary rounded-full" 
                        style={{ width: `${progress.percent}%` }}
                      ></div>
                    </div>
                  </CardContent>
                </Card>
                
                {Object.entries(groupedChecklist).map(([category, items]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="font-medium text-lg">{category}</h3>
                    
                    <div className="grid gap-2">
                      {items
                        .sort((a, b) => {
                          const priorityOrder = { high: 0, medium: 1, low: 2 };
                          return priorityOrder[a.priority] - priorityOrder[b.priority];
                        })
                        .map(item => (
                          <div 
                            key={item.id} 
                            className={`flex items-center justify-between p-3 rounded-md border ${
                              item.is_reviewed ? 'border-green-200 bg-green-50' : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center">
                              <Badge
                                variant={
                                  item.priority === 'high' ? 'destructive' : 
                                  item.priority === 'medium' ? 'default' : 'outline'
                                }
                                className="mr-3"
                              >
                                {item.priority}
                              </Badge>
                              <span className={item.is_reviewed ? 'line-through text-muted-foreground' : ''}>
                                {item.name}
                              </span>
                            </div>
                            
                            <Button 
                              variant={item.is_reviewed ? 'default' : 'outline'} 
                              size="sm"
                              className={item.is_reviewed ? 'bg-green-500 hover:bg-green-600' : ''}
                              onClick={() => handleToggleChecklistItem(item.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              {item.is_reviewed ? 'Reviewed' : 'Mark as Reviewed'}
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudyGuideDetail;
