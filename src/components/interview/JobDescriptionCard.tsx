
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, ExternalLink, Trash2, Brain } from 'lucide-react';
import { format } from 'date-fns';
import { JobDescription } from '@/types/interview';
import { Link } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface JobDescriptionCardProps {
  jobDescription: JobDescription;
  onDelete: (id: string) => void;
  onAnalyze: (id: string) => void;
  hasStudyGuide?: boolean;
}

const JobDescriptionCard: React.FC<JobDescriptionCardProps> = ({
  jobDescription,
  onDelete,
  onAnalyze,
  hasStudyGuide = false
}) => {
  const { id, source_type, source_url, raw_text, parsed_fields, created_at } = jobDescription;
  
  const title = parsed_fields?.title || 'Job Description';
  const truncatedText = raw_text.length > 150 
    ? `${raw_text.substring(0, 150)}...` 
    : raw_text;
  
  const formattedDate = format(new Date(created_at), 'PPP');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg truncate">{title}</CardTitle>
            <CardDescription className="flex items-center mt-1">
              <Calendar className="h-3 w-3 mr-1" />
              {formattedDate}
            </CardDescription>
          </div>
          <Badge variant={source_type === 'url' ? 'default' : 'outline'}>
            {source_type === 'url' ? 'URL' : 'Manual'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-3">{truncatedText}</p>
        
        {parsed_fields?.technical_keywords && parsed_fields.technical_keywords.length > 0 && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1">
              {parsed_fields.technical_keywords.slice(0, 3).map((keyword, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
              {parsed_fields.technical_keywords.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{parsed_fields.technical_keywords.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-3">
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this job description and any associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          {source_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Source
              </a>
            </Button>
          )}
        </div>
        
        <div className="flex gap-2">
          {!hasStudyGuide && (
            <Button size="sm" onClick={() => onAnalyze(id)}>
              <Brain className="h-3 w-3 mr-1" />
              Generate Study Guide
            </Button>
          )}
          
          <Button variant="default" size="sm" asChild>
            <Link to={`/interview/job/${id}`}>
              <FileText className="h-3 w-3 mr-1" />
              View Details
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default JobDescriptionCard;
