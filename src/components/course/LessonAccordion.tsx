// ABOUTME: Collapsible lesson display component that shows lessons in an accordion format
// ABOUTME: Each lesson can be expanded to show its content blocks with progress tracking

import React from 'react';
import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, BookOpen, CheckCircle2, PlayCircle } from 'lucide-react';
import { Lesson } from '@/types/lesson';
import { ContentBlock } from '@/types/moduleContent';
import StudentContentRenderer from '@/components/course/content/StudentContentRenderer';

interface LessonAccordionProps {
  lessons: Lesson[];
  contentBlocks: ContentBlock[];
  lessonProgress?: Record<string, any>;
  courseId: string;
  moduleId: string;
}

export function LessonAccordion({ 
  lessons, 
  contentBlocks, 
  lessonProgress = {}, 
  courseId, 
  moduleId 
}: LessonAccordionProps) {
  // Group content blocks by lesson
  const getLessonContentBlocks = (lessonId: string) => {
    return contentBlocks.filter(block => block.lesson_id === lessonId);
  };

  // Calculate lesson progress
  const getLessonProgress = (lessonId: string) => {
    const progress = lessonProgress[lessonId];
    return progress?.completion_percentage || 0;
  };

  const isLessonCompleted = (lessonId: string) => {
    const progress = lessonProgress[lessonId];
    return progress?.completed || false;
  };

  // Sort lessons by order_num
  const sortedLessons = [...lessons].sort((a, b) => a.order_num - b.order_num);

  if (lessons.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No lessons yet</h3>
          <p className="text-muted-foreground">
            This module doesn't have any lessons yet. Check back later or contact your instructor.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Module Lessons</h3>
        <Badge variant="secondary">{lessons.length} lessons</Badge>
      </div>
      
      <Accordion type="multiple" className="space-y-4">
        {sortedLessons.map((lesson, index) => {
          const lessonBlocks = getLessonContentBlocks(lesson.id);
          const progress = getLessonProgress(lesson.id);
          const isCompleted = isLessonCompleted(lesson.id);
          
          return (
            <AccordionItem 
              key={lesson.id} 
              value={lesson.id}
              className="border rounded-lg bg-card"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <PlayCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium text-muted-foreground">
                        Lesson {lesson.order_num}
                      </span>
                    </div>
                    
                    <div className="text-left">
                      <h4 className="font-semibold">{lesson.title}</h4>
                      {lesson.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {lesson.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {lesson.duration && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{lesson.duration}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <div className="w-16">
                        <Progress value={progress} className="h-2" />
                      </div>
                      <span className="text-sm text-muted-foreground min-w-[3rem]">
                        {progress}%
                      </span>
                    </div>
                    
                    <Badge variant={isCompleted ? "default" : "secondary"}>
                      {lessonBlocks.length} items
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  {lesson.content && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h5 className="font-medium mb-2">Lesson Overview</h5>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {lesson.content}
                      </p>
                    </div>
                  )}
                  
                  {lessonBlocks.length > 0 ? (
                    <div className="space-y-4">
                      <h5 className="font-medium">Lesson Content</h5>
                      <div className="space-y-4">
                        {lessonBlocks
                          .sort((a, b) => a.position - b.position)
                          .map((block) => (
                            <div key={block.id} className="border-l-4 border-primary/20 pl-4">
                              <StudentContentRenderer block={block} />
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No content blocks in this lesson yet.</p>
                    </div>
                  )}
                  
                  {lesson.completion_criteria && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 mt-4">
                      <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Completion Requirements
                      </h5>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {lesson.completion_criteria.type === 'all_blocks' 
                          ? 'Complete all content blocks in this lesson'
                          : 'Custom completion criteria apply'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}