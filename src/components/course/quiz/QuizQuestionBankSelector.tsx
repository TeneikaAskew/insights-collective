import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sanitizeHTML } from '@/utils/sanitize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Search, Plus, Filter } from 'lucide-react';
import { useQuestionBanks, useQuestionBankQuestions } from '@/hooks/useQuestionBanks';
import { QuestionBank, QuestionBankQuestion } from '@/types/course';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface QuizQuestionBankSelectorProps {
  courseId: string;
  open: boolean;
  onClose: () => void;
  onSelectQuestions: (questions: QuestionBankQuestion[]) => void;
}

export const QuizQuestionBankSelector: React.FC<QuizQuestionBankSelectorProps> = ({
  courseId,
  open,
  onClose,
  onSelectQuestions,
}) => {
  const { banks } = useQuestionBanks(courseId);
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    difficulty: 'all',
    type: 'all',
  });
  const [randomCount, setRandomCount] = useState(10);
  const [activeTab, setActiveTab] = useState<'browse' | 'random'>('browse');

  const { questions } = useQuestionBankQuestions(selectedBank?.id, {
    difficulty: filters.difficulty !== 'all' ? filters.difficulty : undefined,
    question_type: filters.type !== 'all' ? filters.type : undefined,
  });

  const filteredQuestions = questions?.filter(q =>
    q.question_text.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleQuestionToggle = (questionId: string) => {
    setSelectedQuestions(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleSelectAll = () => {
    if (selectedQuestions.length === filteredQuestions.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(filteredQuestions.map(q => q.id));
    }
  };

  const handleAddSelected = () => {
    const questionsToAdd = questions?.filter(q => selectedQuestions.includes(q.id)) || [];
    onSelectQuestions(questionsToAdd);
    handleClose();
  };

  const handleAddRandom = () => {
    if (!questions || questions.length === 0) return;
    
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const randomQuestions = shuffled.slice(0, Math.min(randomCount, shuffled.length));
    onSelectQuestions(randomQuestions);
    handleClose();
  };

  const handleClose = () => {
    setSelectedBank(null);
    setSelectedQuestions([]);
    setSearchTerm('');
    setFilters({ difficulty: 'all', type: 'all' });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Add Questions from Question Bank
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!selectedBank ? (
            <div>
              <h3 className="font-medium mb-3">Select a Question Bank</h3>
              <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                {banks?.map(bank => (
                  <Card
                    key={bank.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedBank(bank)}
                  >
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">{bank.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {bank.description && (
                        <p className="text-sm text-gray-600 mb-2">{bank.description}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        {bank.question_count || 0} questions
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{selectedBank.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedBank(null)}
                >
                  Change Bank
                </Button>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="browse">Browse Questions</TabsTrigger>
                  <TabsTrigger value="random">Random Selection</TabsTrigger>
                </TabsList>

                <TabsContent value="browse" className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search questions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select
                      value={filters.difficulty}
                      onValueChange={(value) => setFilters({ ...filters, difficulty: value })}
                    >
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
                    <Select
                      value={filters.type}
                      onValueChange={(value) => setFilters({ ...filters, type: value })}
                    >
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
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {selectedQuestions.length} of {filteredQuestions.length} questions selected
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      {selectedQuestions.length === filteredQuestions.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {filteredQuestions.map(question => (
                      <Card
                        key={question.id}
                        className={`cursor-pointer transition-colors ${
                          selectedQuestions.includes(question.id) ? 'bg-primary/5 border-primary' : ''
                        }`}
                        onClick={() => handleQuestionToggle(question.id)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedQuestions.includes(question.id)}
                              onCheckedChange={() => handleQuestionToggle(question.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {question.question_type.replace('_', ' ')}
                                </Badge>
                                {question.difficulty_level && (
                                  <Badge
                                    variant={
                                      question.difficulty_level === 'easy' ? 'secondary' :
                                      question.difficulty_level === 'medium' ? 'default' : 'destructive'
                                    }
                                    className="text-xs"
                                  >
                                    {question.difficulty_level}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {question.points} pts
                                </Badge>
                              </div>
                              <div
                                className="text-sm line-clamp-2"
                                dangerouslySetInnerHTML={{ __html: sanitizeHTML(question.question_text) }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="random" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Random Question Selection</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Number of Questions</Label>
                        <Input
                          type="number"
                          value={randomCount}
                          onChange={(e) => setRandomCount(parseInt(e.target.value) || 1)}
                          min="1"
                          max={questions?.length || 1}
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Available: {questions?.length || 0} questions
                        </p>
                      </div>
                      <div>
                        <Label>Filter by Difficulty (Optional)</Label>
                        <Select
                          value={filters.difficulty}
                          onValueChange={(value) => setFilters({ ...filters, difficulty: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All Levels" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Levels</SelectItem>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {selectedBank && (
            <Button
              onClick={activeTab === 'browse' ? handleAddSelected : handleAddRandom}
              disabled={activeTab === 'browse' ? selectedQuestions.length === 0 : !questions || questions.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {activeTab === 'browse' ? `${selectedQuestions.length} Selected` : `${randomCount} Random`} Questions
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};