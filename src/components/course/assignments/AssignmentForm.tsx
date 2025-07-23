import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Calendar, Clock, FileText, Settings, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CanvasEditor } from '@/components/ui/canvas-editor';
import { EnhancedAssignment, Rubric } from '@/types/course';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useRubrics } from '@/hooks/useRubrics';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RubricList } from '@/components/course/rubrics/RubricList';

const assignmentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  content: z.string().optional(),
  instructions: z.string().optional(),
  points: z.number().min(0).optional(),
  due_date: z.string().optional(),
  module_id: z.string().optional(),
  submission_types: z.array(z.string()).min(1, 'At least one submission type is required'),
  allowed_file_extensions: z.array(z.string()).optional(),
  max_attempts: z.number().min(1).default(1),
  grading_type: z.enum(['points', 'percentage', 'complete_incomplete', 'letter_grade', 'gpa_scale', 'not_graded']),
  is_published: z.boolean().default(false),
  peer_review_enabled: z.boolean().default(false),
  peer_review_due_date: z.string().optional(),
  anonymous_grading: z.boolean().default(false),
  late_policy: z.object({
    deduction_per_day: z.number().optional(),
    maximum_deduction: z.number().optional(),
    grace_period_hours: z.number().optional(),
  }).optional(),
  rubric_id: z.string().optional(),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

interface AssignmentFormProps {
  assignment?: EnhancedAssignment;
  courseId: string;
  modules?: Array<{ id: string; title: string }>;
  onSubmit: (values: AssignmentFormValues) => void;
  onCancel: () => void;
}

const submissionTypes = [
  { value: 'file_upload', label: 'File Upload' },
  { value: 'text_entry', label: 'Text Entry' },
  { value: 'url', label: 'Website URL' },
  { value: 'media_recording', label: 'Media Recording' },
];

const fileExtensions = [
  { value: 'pdf', label: 'PDF (.pdf)' },
  { value: 'doc,docx', label: 'Word (.doc, .docx)' },
  { value: 'ppt,pptx', label: 'PowerPoint (.ppt, .pptx)' },
  { value: 'xls,xlsx', label: 'Excel (.xls, .xlsx)' },
  { value: 'jpg,jpeg,png,gif', label: 'Images (.jpg, .png, .gif)' },
  { value: 'mp4,mov,avi', label: 'Video (.mp4, .mov, .avi)' },
  { value: 'mp3,wav', label: 'Audio (.mp3, .wav)' },
  { value: 'zip,rar', label: 'Archives (.zip, .rar)' },
];

export const AssignmentForm: React.FC<AssignmentFormProps> = ({
  assignment,
  courseId,
  modules = [],
  onSubmit,
  onCancel,
}) => {
  const [selectedSubmissionTypes, setSelectedSubmissionTypes] = useState<string[]>(
    assignment?.submission_types || ['file_upload']
  );
  const [selectedRubric, setSelectedRubric] = useState<Rubric | null>(null);
  const [showRubricDialog, setShowRubricDialog] = useState(false);
  const { rubrics } = useRubrics(courseId);

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: assignment?.title || '',
      description: assignment?.description || '',
      content: assignment?.content || '',
      instructions: assignment?.instructions || '',
      points: assignment?.points || 0,
      due_date: assignment?.due_date || '',
      module_id: assignment?.module_id || '',
      submission_types: assignment?.submission_types || ['file_upload'],
      allowed_file_extensions: assignment?.allowed_file_extensions || [],
      max_attempts: assignment?.max_attempts || 1,
      grading_type: assignment?.grading_type || 'points',
      is_published: assignment?.is_published || false,
      peer_review_enabled: assignment?.peer_review_enabled || false,
      peer_review_due_date: assignment?.peer_review_due_date || '',
      anonymous_grading: assignment?.anonymous_grading || false,
      late_policy: assignment?.late_policy || {},
    },
  });

  const handleSubmit = (values: AssignmentFormValues) => {
    onSubmit({
      ...values,
      course_id: courseId,
      rubric_id: selectedRubric?.id,
    } as any);
  };

  return (
    <>
      <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="submission">Submission</TabsTrigger>
            <TabsTrigger value="grading">Grading</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Assignment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Assignment title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="module_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Module</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a module" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No module</SelectItem>
                          {modules.map((module) => (
                            <SelectItem key={module.id} value={module.id}>
                              {module.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of the assignment"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions</FormLabel>
                      <FormControl>
                        <CanvasEditor
                          content={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Enter detailed assignment instructions..."
                        />
                      </FormControl>
                      <FormDescription>
                        Provide clear instructions for students
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submission" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Submission Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="submission_types"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Submission Types</FormLabel>
                      <div className="space-y-2">
                        {submissionTypes.map((type) => (
                          <div key={type.value} className="flex items-center space-x-2">
                            <Checkbox
                              checked={field.value?.includes(type.value)}
                              onCheckedChange={(checked) => {
                                const newValue = checked
                                  ? [...(field.value || []), type.value]
                                  : field.value?.filter((v) => v !== type.value) || [];
                                field.onChange(newValue);
                                setSelectedSubmissionTypes(newValue);
                              }}
                            />
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              {type.label}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedSubmissionTypes.includes('file_upload') && (
                  <FormField
                    control={form.control}
                    name="allowed_file_extensions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allowed File Types</FormLabel>
                        <div className="space-y-2">
                          {fileExtensions.map((ext) => (
                            <div key={ext.value} className="flex items-center space-x-2">
                              <Checkbox
                                checked={field.value?.includes(ext.value)}
                                onCheckedChange={(checked) => {
                                  const newValue = checked
                                    ? [...(field.value || []), ext.value]
                                    : field.value?.filter((v) => v !== ext.value) || [];
                                  field.onChange(newValue);
                                }}
                              />
                              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {ext.label}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormDescription>
                          Select which file types students can upload
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="max_attempts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Attempts</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of times students can submit
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grading" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Grading Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="grading_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grading Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select grading type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="points">Points</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="complete_incomplete">Complete/Incomplete</SelectItem>
                          <SelectItem value="letter_grade">Letter Grade</SelectItem>
                          <SelectItem value="gpa_scale">GPA Scale</SelectItem>
                          <SelectItem value="not_graded">Not Graded</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('grading_type') === 'points' && (
                  <FormField
                    control={form.control}
                    name="points"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Points</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="anonymous_grading"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Anonymous Grading</FormLabel>
                        <FormDescription>
                          Hide student names while grading
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="space-y-4 border rounded-lg p-4">
                  <h4 className="font-medium">Late Policy</h4>
                  
                  <FormField
                    control={form.control}
                    name="late_policy.deduction_per_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deduction per Day (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="late_policy.maximum_deduction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Deduction (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="late_policy.grace_period_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grace Period (hours)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 border rounded-lg p-4">
                  <h4 className="font-medium">Rubric</h4>
                  {selectedRubric ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedRubric.title}</p>
                        {selectedRubric.description && (
                          <p className="text-sm text-gray-500">{selectedRubric.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowRubricDialog(true)}
                        >
                          Change
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRubric(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRubricDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Attach Rubric
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Additional Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="peer_review_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Peer Review</FormLabel>
                        <FormDescription>
                          Enable students to review each other's work
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('peer_review_enabled') && (
                  <FormField
                    control={form.control}
                    name="peer_review_due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peer Review Due Date</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="is_published"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Published</FormLabel>
                        <FormDescription>
                          Make this assignment visible to students
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {assignment ? 'Update' : 'Create'} Assignment
          </Button>
        </div>
      </form>
    </Form>

    <Dialog open={showRubricDialog} onOpenChange={setShowRubricDialog}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Rubric</DialogTitle>
        </DialogHeader>
        <RubricList
          courseId={courseId}
          selectable
          onSelectRubric={(rubric) => {
            setSelectedRubric(rubric);
            setShowRubricDialog(false);
          }}
        />
      </DialogContent>
    </Dialog>
    </>
  );
};