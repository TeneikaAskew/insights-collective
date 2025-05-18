
import React, { useEffect, useState } from 'react';
import { useJobDescriptions } from '@/hooks/useJobDescriptions';
import { useStudyGuides } from '@/hooks/useStudyGuides';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import JobDescriptionForm from '@/components/interview/JobDescriptionForm';
import JobDescriptionCard from '@/components/interview/JobDescriptionCard';
import { JobDescription } from '@/types/interview';
import { PlusCircle, FileText, Briefcase } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const InterviewPrep: React.FC = () => {
  const { fetchJobDescriptions, analyzeJobDescription, deleteJobDescription } = useJobDescriptions();
  const { getStudyGuideForJobDescription, generateStudyGuide } = useStudyGuides();
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    const loadData = async () => {
      if (isAuthenticated) {
        const data = await fetchJobDescriptions();
        setJobDescriptions(data);
      }
      setLoading(false);
    };
    
    loadData();
  }, [fetchJobDescriptions, isAuthenticated]);
  
  const handleDeleteJobDescription = async (id: string) => {
    const success = await deleteJobDescription(id);
    if (success) {
      setJobDescriptions(jobDescriptions.filter(job => job.id !== id));
    }
  };
  
  const handleGenerateStudyGuide = async (jobDescriptionId: string) => {
    // First check if a study guide already exists
    const existingStudyGuide = await getStudyGuideForJobDescription(jobDescriptionId);
    
    if (existingStudyGuide) {
      // If it exists, navigate to it
      navigate(`/interview/study/${existingStudyGuide.id}`);
      return;
    }
    
    // If not, first ensure the job description is analyzed
    const jobDescription = jobDescriptions.find(job => job.id === jobDescriptionId);
    
    if (!jobDescription?.parsed_fields?.title) {
      // Job description hasn't been analyzed yet, do it now
      await analyzeJobDescription(jobDescriptionId);
    }
    
    // Generate the study guide
    const studyGuide = await generateStudyGuide(jobDescriptionId);
    
    // Navigate to the new study guide
    if (studyGuide) {
      navigate(`/interview/study/${studyGuide.id}`);
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageTitle 
        title="Interview Preparation" 
        subtitle="Prepare for your interviews with AI-powered tools" 
      />
      
      <Tabs defaultValue="job-descriptions">
        <div className="flex justify-between items-center mb-6">
          <TabsList>
            <TabsTrigger value="job-descriptions" className="px-4">
              <FileText className="h-4 w-4 mr-2" />
              Job Descriptions
            </TabsTrigger>
          </TabsList>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Job Description
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add Job Description</DialogTitle>
                <DialogDescription>
                  Enter a job description manually or provide a URL to a job posting
                </DialogDescription>
              </DialogHeader>
              <JobDescriptionForm />
            </DialogContent>
          </Dialog>
        </div>
        
        <TabsContent value="job-descriptions">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Spinner className="h-8 w-8" />
            </div>
          ) : jobDescriptions.length === 0 ? (
            <Card className="p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">No Job Descriptions Yet</h3>
              <p className="text-muted-foreground mb-6">
                Add your first job description to start preparing for your interview.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Job Description
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobDescriptions.map((jobDescription) => (
                <JobDescriptionCard
                  key={jobDescription.id}
                  jobDescription={jobDescription}
                  onDelete={handleDeleteJobDescription}
                  onAnalyze={handleGenerateStudyGuide}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InterviewPrep;
