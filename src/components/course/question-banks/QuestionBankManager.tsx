import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sanitizeHTML } from '@/utils/sanitize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Filter, Download, Upload, Edit, Trash2, Copy, ArrowLeft, CircleDot, CheckSquare, FileText, FileEdit, Link2, Type, ListOrdered, ListChecks, Calculator, HelpCircle } from 'lucide-react';
import { useQuestionBankQuestions, useQuestionBankCategories } from '@/hooks/useQuestionBanks';
import { QuestionBank, QuestionBankQuestion, QuestionType } from '@/types/course';
import { Badge } from '@/components/ui/badge';
import { QuestionEditor } from './QuestionEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useConfirm } from '@/components/dialogs/DialogsProvider';

interface QuestionBankManagerProps {
  bank: QuestionBank;
  onBack: () => void;
}

export const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({ bank, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const confirm = useConfirm();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankQuestion | null>(null);

  const filters = {
    question_type: selectedType !== 'all' ? selectedType : undefined,
    difficulty: selectedDifficulty !== 'all' ? selectedDifficulty : undefined,
    category_id: selectedCategory !== 'all' ? selectedCategory : undefined,
  };

  const { questions, isLoading, createQuestion, updateQuestion, deleteQuestion } = useQuestionBankQuestions(bank.id, filters);
  const { categories } = useQuestionBankCategories(bank.id);

  const filteredQuestions = questions?.filter(q => 
    q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.topic_tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const handleSaveQuestion = (questionData: Omit<QuestionBankQuestion, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => {
    if (editingQuestion) {
      updateQuestion({
        id: editingQuestion.id,
        updates: questionData
      });
    } else {
      createQuestion(questionData);
    }
    setShowQuestionEditor(false);
    setEditingQuestion(null);
  };

  const handleEditQuestion = (question: QuestionBankQuestion) => {
    setEditingQuestion(question);
    setShowQuestionEditor(true);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (await confirm({ title: 'Delete question?', description: 'This permanently removes the question.', destructive: true, confirmLabel: 'Delete' })) {
      deleteQuestion(questionId);
    }
  };

  const handleDuplicateQuestion = (question: QuestionBankQuestion) => {
    const { id, created_at, updated_at, usage_count, ...questionData } = question;
    createQuestion({
      ...questionData,
      question_text: `${question.question_text} (Copy)`,
    });
  };

  const questionTypeIcons: Record<QuestionType, React.ComponentType<{ className?: string }>> = {
    multiple_choice: CircleDot,
    true_false: CheckSquare,
    short_answer: FileText,
    essay: FileEdit,
    matching: Link2,
    fill_blank: Type,
    ordering: ListOrdered,
    multiple_answer: ListChecks,
    calculated: Calculator,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Question Banks
          </Button>
          <h2 className="text-2xl font-bold">{bank.title}</h2>
          {bank.description && (
            <p className="text-gray-600">{bank.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" /> Import
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={() => setShowQuestionEditor(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Question
          </Button>
        </div>
      </div>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search questions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Question Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                    <SelectItem value="essay">Essay</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
          </Card>

          {isLoading ? (
            <div>Loading questions...</div>
          ) : filteredQuestions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">No questions found. Create your first question to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map((question) => (
                <Card key={question.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {(() => { const Icon = questionTypeIcons[question.question_type] || HelpCircle; return <Icon className="h-5 w-5 text-muted-foreground" />; })()}
                          <Badge variant="outline">{question.question_type.replace('_', ' ')}</Badge>
                          {question.difficulty_level && (
                            <Badge 
                              variant={
                                question.difficulty_level === 'easy' ? 'secondary' :
                                question.difficulty_level === 'medium' ? 'default' : 'destructive'
                              }
                            >
                              {question.difficulty_level}
                            </Badge>
                          )}
                          <Badge variant="outline">{question.points} pts</Badge>
                        </div>
                        <div 
                          className="prose prose-sm max-w-none mb-2"
                          dangerouslySetInnerHTML={{ __html: sanitizeHTML(question.question_text) }}
                        />
                        {question.topic_tags && question.topic_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {question.topic_tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {(question.usage_count > 0 || question.success_rate !== null) && (
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span>Used {question.usage_count} times</span>
                            {question.success_rate !== null && (
                              <span>Success rate: {Math.round(question.success_rate * 100)}%</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditQuestion(question)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDuplicateQuestion(question)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteQuestion(question.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground" role="status">
                Category management is not yet available.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics">
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground" role="status">
                Question statistics and analytics are not yet available.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showQuestionEditor} onOpenChange={(open) => {
        if (!open) {
          setShowQuestionEditor(false);
          setEditingQuestion(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Edit Question' : 'Create New Question'}
            </DialogTitle>
          </DialogHeader>
          <QuestionEditor
            question={editingQuestion || undefined}
            bankId={bank.id}
            onSave={handleSaveQuestion}
            onCancel={() => {
              setShowQuestionEditor(false);
              setEditingQuestion(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};