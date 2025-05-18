
import React, { useState } from 'react';
import { useJobDescriptions } from '@/hooks/useJobDescriptions';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, Upload, Link as LinkIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import LoginWall from '@/components/common/LoginWall';

const JobDescriptionForm = () => {
  const { createJobDescription, scrapeJobUrl, loading } = useJobDescriptions();
  const [jobText, setJobText] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('manual');
  const { isAuthenticated } = useAuth();

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!jobText.trim()) {
      setError('Please enter a job description');
      return;
    }
    
    setError(null);
    const result = await createJobDescription(jobText, 'manual');
    if (result) {
      // Reset form on success
      setJobText('');
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!jobUrl.trim()) {
      setError('Please enter a job posting URL');
      return;
    }
    
    setError(null);
    
    // First scrape the URL to get the job text
    const scrapedText = await scrapeJobUrl(jobUrl);
    if (scrapedText) {
      // Then create the job description with the scraped text
      const result = await createJobDescription(scrapedText, 'url', jobUrl);
      if (result) {
        // Reset form on success
        setJobUrl('');
      }
    } else {
      setError('Failed to extract job description from the URL');
    }
  };

  if (!isAuthenticated) {
    return (
      <LoginWall message="Sign in to save job descriptions and prepare for interviews" />
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="manual">
              <Upload className="h-4 w-4 mr-2" /> Manual Entry
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon className="h-4 w-4 mr-2" /> Job URL
            </TabsTrigger>
          </TabsList>
          
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <TabsContent value="manual">
            <form onSubmit={handleManualSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jobText">Paste Job Description</Label>
                  <Textarea
                    id="jobText"
                    placeholder="Copy and paste the full job description here..."
                    value={jobText}
                    onChange={(e) => setJobText(e.target.value)}
                    className="min-h-[200px]"
                    required
                  />
                </div>
                
                <Button type="submit" disabled={loading}>
                  {loading ? <Spinner className="mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Save Job Description
                </Button>
              </div>
            </form>
          </TabsContent>
          
          <TabsContent value="url">
            <form onSubmit={handleUrlSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jobUrl">Job Posting URL</Label>
                  <Input
                    id="jobUrl"
                    type="url"
                    placeholder="https://example.com/job/software-engineer"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the URL of the job posting and we'll extract the description for you.
                  </p>
                </div>
                
                <Button type="submit" disabled={loading}>
                  {loading ? <Spinner className="mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                  Extract & Save
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default JobDescriptionForm;
