import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StudyGuide } from '@/types/interview';
import { cn } from '@/lib/utils';
import { Book, CheckCircle2, GraduationCap, Code2 } from 'lucide-react';

interface StudyGuideListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function StudyGuideList({ className, ...props }: StudyGuideListProps) {
  const [activeTab, setActiveTab] = useState('competencies');
  const [studyGuide] = useState<StudyGuide>({
    id: '1',
    job_description_id: '1',
    user_id: '1',
    competencies: [
      {
        name: 'Problem Solving',
        description: 'Ability to analyze complex problems and develop effective solutions.',
        key_indicators: [
          'Break down complex problems into manageable parts',
          'Consider multiple approaches before implementing a solution',
          'Validate solutions against requirements',
        ],
      },
    ],
    questions: [
      {
        id: '1',
        question: 'Tell me about a time you solved a complex technical problem.',
        competency: 'Problem Solving',
        sample_answer: {
          situation: 'While working on a high-traffic e-commerce platform...',
          task: 'I needed to optimize the checkout process...',
          action: 'I analyzed the performance bottlenecks...',
          result: 'The changes resulted in a 40% reduction in checkout time...',
        },
      },
    ],
    technical_checklist: [
      {
        topic: 'Frontend Development',
        subtopics: ['React', 'TypeScript', 'Next.js'],
        status: 'in_progress',
      },
    ],
    created_at: '2024-03-20T10:00:00Z',
  });

  if (!studyGuide) {
    return (
      <Card className={className} {...props}>
        <CardHeader>
          <CardTitle>No Study Guide Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add a job description to generate a personalized study guide.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('col-span-4', className)} {...props}>
      <CardHeader>
        <CardTitle>Frontend Developer Study Guide</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="competencies">
              <GraduationCap className="mr-2 h-4 w-4" />
              Competencies
            </TabsTrigger>
            <TabsTrigger value="questions">
              <Book className="mr-2 h-4 w-4" />
              Questions
            </TabsTrigger>
            <TabsTrigger value="technical">
              <Code2 className="mr-2 h-4 w-4" />
              Technical
            </TabsTrigger>
          </TabsList>

          <TabsContent value="competencies" className="mt-6">
            <div className="space-y-6">
              {studyGuide.competencies.map((competency) => (
                <div key={competency.name} className="space-y-2">
                  <h3 className="font-semibold">{competency.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {competency.description}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {competency.key_indicators.map((indicator, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />
                        {indicator}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="questions" className="mt-6">
            <div className="space-y-6">
              {studyGuide.questions.map((question) => (
                <div key={question.id} className="space-y-4">
                  <div>
                    <h3 className="font-semibold">{question.question}</h3>
                    <p className="text-sm text-muted-foreground">
                      Competency: {question.competency}
                    </p>
                  </div>
                  {question.sample_answer && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Sample STAR Response:</p>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="font-medium">Situation:</span>{' '}
                          {question.sample_answer.situation}
                        </p>
                        <p>
                          <span className="font-medium">Task:</span>{' '}
                          {question.sample_answer.task}
                        </p>
                        <p>
                          <span className="font-medium">Action:</span>{' '}
                          {question.sample_answer.action}
                        </p>
                        <p>
                          <span className="font-medium">Result:</span>{' '}
                          {question.sample_answer.result}
                        </p>
                      </div>
                    </div>
                  )}
                  <Button variant="outline" size="sm">
                    Practice Response
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="technical" className="mt-6">
            <div className="space-y-6">
              {studyGuide.technical_checklist.map((item) => (
                <div key={item.topic} className="space-y-2">
                  <h3 className="font-semibold">{item.topic}</h3>
                  <ul className="grid gap-2">
                    {item.subtopics.map((subtopic, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle2
                          className={cn(
                            'h-4 w-4',
                            item.status === 'completed'
                              ? 'text-green-500'
                              : 'text-muted-foreground'
                          )}
                        />
                        <span className="text-sm">{subtopic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 