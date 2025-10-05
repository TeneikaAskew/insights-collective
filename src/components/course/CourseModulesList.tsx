// ABOUTME: Dedicated component for displaying course modules with proper loading and error states
// ABOUTME: Replaces the inline module display to provide better user experience and code organization

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, HelpCircle, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { EditCourseButton } from '@/components/course/EditCourseButton';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseModulesList');

// Rich text renderer component for module descriptions
const RichTextRenderer: React.FC<{ content: string }> = ({ content }) => {
  const processContent = (text: string): string => {
    if (!text) return '';
    
    // Process video embeds from ModernEditor format [VIDEO:url]
    let processedText = text.replace(/\[VIDEO:([^\]]+)\]/gim, (match, videoUrl) => {
      return `<div class="aspect-video mb-4"><iframe src="${videoUrl}" class="w-full h-full rounded-lg" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    });
    
    // Enhanced YouTube detection and embedding for direct URLs
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?/g;
    processedText = processedText.replace(youtubeRegex, (match, videoId) => {
      return `<div class="aspect-video mb-4"><iframe src="https://www.youtube.com/embed/${videoId}" class="w-full h-full rounded-lg" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    });

    // Convert markdown-style formatting to HTML
    processedText = processedText
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/~~(.*?)~~/gim, '<del>$1</del>')
      .replace(/`([^`]+)`/gim, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-muted-foreground pl-4 italic">$1</blockquote>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4" />')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li>$1. $2</li>')
      .replace(/\n/gim, '<br />');

    // Wrap consecutive <li> tags with <ul> or <ol>
    processedText = processedText.replace(/(<li>.*?<\/li>)/gis, '<ul class="list-disc list-inside space-y-1 my-2">$1</ul>');
    processedText = processedText.replace(/(<li>\d+\..*?<\/li>)/gis, '<ol class="list-decimal list-inside space-y-1 my-2">$1</ol>');

    return processedText;
  };

  return (
    <div 
      className="prose prose-sm max-w-none text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: processContent(content) }}
    />
  );
};

interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  position: number;
  published: boolean;
  contentItems?: any[];
  completionStatus: number;
  estimatedTime?: number;
}

interface CourseModulesListProps {
  courseId: string;
}

export function CourseModulesList({ courseId }: CourseModulesListProps) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchModules = async () => {
      if (!courseId) return;
      
      try {
        setLoading(true);
        
        // Fetch modules
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select('*')
          .eq('course_id', courseId)
          .eq('published', true)
          .order('position', { ascending: true })
          .order('week', { ascending: true });

        if (modulesError) throw modulesError;

        // For each module, fetch content items and calculate progress
        const processedModules = await Promise.all((modulesData || []).map(async (module) => {
          // Fetch content items for this module
          const { data: contentItems } = await supabase
            .from('content_items')
            .select(`
              id,
              type,
              title,
              published,
              assignment:assignments(id),
              quiz:quizzes(id)
            `)
            .eq('module_id', module.id)
            .eq('published', true);

          // Calculate progress if user is logged in
          let completionStatus = 0;
          if (user && contentItems && contentItems.length > 0) {
            const { data: progressData } = await supabase
              .from('content_item_progressions')
              .select('workflow_state')
              .eq('user_id', user.id)
              .in('content_item_id', contentItems.map(item => item.id));

            const completedItems = progressData?.filter(p => p.workflow_state === 'read') || [];
            completionStatus = Math.round((completedItems.length / contentItems.length) * 100);
          }

          // Count content types
          const lessons = contentItems?.filter(item => item.type === 'page') || [];
          const assignments = contentItems?.filter(item => item.type === 'assignment') || [];
          const quizzes = contentItems?.filter(item => item.type === 'quiz') || [];

          // Estimate time based on content
          const estimatedTime = lessons.length * 15 + assignments.length * 30 + quizzes.length * 20; // minutes

          return {
            ...module,
            contentItems,
            lessons,
            assignments,
            quizzes,
            completionStatus,
            estimatedTime
          };
        }));

        setModules(processedModules);
      } catch (error: any) {
        logger.error('Error fetching modules:', error);
        setError(error.message || 'Failed to load modules');
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, [courseId, user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Course Modules</h2>
          <EditCourseButton courseId={courseId} />
        </div>
        <p className="text-muted-foreground mb-6">
          This course contains {modules.length} modules organized by week. Click on any module to view its content.
        </p>
        
        {modules.length > 0 ? (
          <div className="space-y-4">
            {modules.map((module, index) => (
              <Card key={module.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                        {module.week}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{module.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Week {module.week}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {module.contentItems?.length || 0} activities
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm">
                    <RichTextRenderer content={module.description} />
                  </div>
                  
                  {/* Content summary */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {module.contentItems && module.contentItems.length > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <BookOpen className="h-3 w-3" />
                        <span>{module.contentItems.length} activities</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Progress</span>
                      <span>{Math.round(module.completionStatus)}%</span>
                    </div>
                    <Progress value={module.completionStatus} className="h-2" />
                  </div>
                  
                  {/* Action button */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {module.estimatedTime ? (
                          module.estimatedTime >= 60 
                            ? `Est. ${Math.round(module.estimatedTime / 60)} hour${Math.round(module.estimatedTime / 60) !== 1 ? 's' : ''}`
                            : `Est. ${module.estimatedTime} min`
                        ) : (
                          'Est. time varies'
                        )}
                      </span>
                    </div>
                    <Button asChild size="sm">
                      <Link to={`/courses/${courseId}/modules/${module.id}`}>
                        View Activities
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border rounded-lg bg-muted/20">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No modules available for this course yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Check back later or contact your instructor for more information.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}