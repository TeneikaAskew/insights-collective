
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJobDescriptions } from '@/hooks/useJobDescriptions';
import { useStudyGuides } from '@/hooks/useStudyGuides';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { ChevronLeft, Brain, Calendar, ExternalLink, Check, ListChecks, FileText, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { JobDescription } from '@/types/interview';
import { toast } from '@/hooks/use-toast';

const JobDescriptionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getJobDescription, analyzeJobDescription } = useJobDescriptions();
  const { getStudyGuideForJobDescription, generateStudyGuide, loading: studyGuideLoading } = useStudyGuides();
  const [jobDescription, setJobDescription] = useState<JobDescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [hasStudyGuide, setHasStudyGuide] = useState(false);
  
  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      
      setLoading(true);
      const data = await getJobDescription(id);
      setJobDescription(data);
      
      // Check if there's already a study guide for this job description
      const studyGuide = await getStudyGuideForJobDescription(id);
      setHasStudyGuide(!!studyGuide);
      
      setLoading(false);
    };
    
    loadData();
  }, [id, getJobDescription, getStudyGuideForJobDescription]);
  
  const handleAnalyze = async () => {
    if (!jobDescription) return;
    
    setAnalyzing(true);
    const result = await analyzeJobDescription(jobDescription.id);
    setAnalyzing(false);
    
    if (result) {
      // Update the local state with the analyzed data
      setJobDescription({
        ...jobDescription,
        parsed_fields: result
      });
      
      toast({
        title: "Analysis complete",
        description: "Job description successfully analyzed"
      });
    }
  };
  
  const handleGenerateStudyGuide = async () => {
    if (!jobDescription) return;
    
    // Make sure job description is analyzed first
    if (!jobDescription.parsed_fields.title) {
      toast({
        title: "Analysis required",
        description: "Please analyze the job description first",
        variant: "destructive"
      });
      return;
    }
    
    const studyGuide = await generateStudyGuide(jobDescription.id);
    if (studyGuide) {
      navigate(`/interview/study/${studyGuide.id}`);
    }
  };

  const goToExistingStudyGuide = async () => {
    if (!jobDescription) return;
    
    const studyGuide = await getStudyGuideForJobDescription(jobDescription.id);
    if (studyGuide) {
      navigate(`/interview/study/${studyGuide.id}`);
    } else {
      setHasStudyGuide(false);
      toast({
        title: "Study guide not found",
        description: "We couldn't find the study guide. Let's create a new one.",
        variant: "destructive"
      });
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto py-10 flex justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  
  if (!jobDescription) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-center">Job description not found</h2>
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
  
  const { parsed_fields, source_type, source_url, raw_text, created_at } = jobDescription;
  const formattedDate = format(new Date(created_at), 'PPP');
  const hasAnalysis = !!parsed_fields?.title;
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/interview')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex gap-2">
          {!hasAnalysis && (
            <Button onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? <Spinner className="h-4 w-4 mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
              Analyze Job Description
            </Button>
          )}
          
          {hasAnalysis && (
            hasStudyGuide ? (
              <Button onClick={goToExistingStudyGuide} disabled={studyGuideLoading}>
                <FileText className="h-4 w-4 mr-2" />
                View Study Guide
              </Button>
            ) : (
              <Button onClick={handleGenerateStudyGuide} disabled={studyGuideLoading}>
                {studyGuideLoading ? <Spinner className="h-4 w-4 mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                Generate Study Guide
              </Button>
            )
          )}
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <CardTitle className="text-xl">
                {hasAnalysis ? parsed_fields.title : 'Job Description'}
              </CardTitle>
              <CardDescription className="flex items-center mt-1">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                Added on {formattedDate}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={source_type === 'url' ? 'default' : 'outline'}>
                {source_type === 'url' ? 'URL' : 'Manual'}
              </Badge>
              {hasAnalysis && (
                <Badge variant="success" className="bg-green-500">
                  <Check className="h-3 w-3 mr-1" />
                  Analyzed
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={hasAnalysis ? "analyzed" : "raw"}>
            <TabsList className="mb-4">
              <TabsTrigger value="raw" disabled={!raw_text}>
                <FileText className="h-4 w-4 mr-2" />
                Raw Text
              </TabsTrigger>
              <TabsTrigger value="analyzed" disabled={!hasAnalysis}>
                <ListChecks className="h-4 w-4 mr-2" />
                Analyzed Content
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="raw">
              <div className="rounded-md border p-4 whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                {raw_text}
              </div>
              
              {source_url && (
                <div className="mt-4">
                  <Button variant="outline" size="sm" asChild>
                    <a href={source_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Original Job Posting
                    </a>
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="analyzed">
              {hasAnalysis ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center">
                      <Briefcase className="h-5 w-5 mr-2" />
                      Job Title
                    </h3>
                    <p className="mt-2 text-lg">{parsed_fields.title}</p>
                  </div>
                  
                  {parsed_fields.responsibilities && parsed_fields.responsibilities.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold">Key Responsibilities</h3>
                      <ul className="mt-2 list-disc pl-5 space-y-1">
                        {parsed_fields.responsibilities.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {parsed_fields.required_qualifications && parsed_fields.required_qualifications.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold">Required Qualifications</h3>
                      <ul className="mt-2 list-disc pl-5 space-y-1">
                        {parsed_fields.required_qualifications.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {parsed_fields.preferred_qualifications && parsed_fields.preferred_qualifications.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold">Preferred Qualifications</h3>
                      <ul className="mt-2 list-disc pl-5 space-y-1">
                        {parsed_fields.preferred_qualifications.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {parsed_fields.technical_keywords && parsed_fields.technical_keywords.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold">Technical Keywords</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {parsed_fields.technical_keywords.map((keyword, idx) => (
                          <Badge key={idx} variant="secondary">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    This job description hasn't been analyzed yet.
                  </p>
                  <Button onClick={handleAnalyze} className="mt-4" disabled={analyzing}>
                    {analyzing ? <Spinner className="h-4 w-4 mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                    Analyze Now
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default JobDescriptionDetail;
