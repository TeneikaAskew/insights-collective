import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { QuestionnaireAnswers } from '@/types/portfolio';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const formSchema = z.object({
  interests: z.string().min(3, {
    message: "Please tell us about your interests",
  }),
  currentRole: z.string().min(2, {
    message: "Please enter your current role",
  }),
  hobbies: z.string().min(3, {
    message: "Please share some of your hobbies",
  }),
});

interface ProfileFormProps {
  onSubmit: (data: QuestionnaireAnswers) => void;
  isLoading: boolean;
  initialData?: QuestionnaireAnswers | null;
}

export function ProfileForm({ onSubmit, isLoading, initialData }: ProfileFormProps) {
  const form = useForm<QuestionnaireAnswers>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      interests: "",
      currentRole: "",
      hobbies: "",
    },
  });

  // Update form values when initialData changes
  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Tell us about yourself</CardTitle>
        <CardDescription>
          Help us understand your background and interests so we can recommend relevant portfolio projects
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="interests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Professional interests</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="e.g., data visualization, machine learning, UX/UI design" 
                      {...field} 
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currentRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current role or career stage</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Junior Data Analyst, Recent Graduate, Career Changer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hobbies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What do you enjoy doing in your free time?</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="e.g., I enjoy building personal coding projects, analyzing sports data, designing websites" 
                      {...field} 
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full bg-[#9b87f5] hover:bg-[#8B5CF6]" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Generate Portfolio Recommendations"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}