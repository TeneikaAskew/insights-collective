
import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UseFormReturn } from 'react-hook-form';
import { BlogFormData } from '@/types/blog';
import { TagInput } from './TagInput';
import { ImageUploader } from './ImageUploader';

interface BlogFormFieldsProps {
  form: UseFormReturn<BlogFormData>;
  showImagePreview: boolean;
  toggleImagePreview: () => void;
  generateSlug: () => void;
}

export function BlogFormFields({ 
  form, 
  showImagePreview, 
  toggleImagePreview, 
  generateSlug 
}: BlogFormFieldsProps) {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input 
                placeholder="Enter blog post title" 
                {...field}
                className="text-lg font-semibold" 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="excerpt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Excerpt</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Write a brief summary of your blog post" 
                rows={2}
                {...field} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="content"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Content (Markdown)</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Write your blog post content in Markdown format" 
                className="min-h-[300px] font-mono"
                {...field} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-full sm:w-1/2">
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between">
                  <FormLabel>Slug</FormLabel>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={generateSlug}
                  >
                    Generate from title
                  </Button>
                </div>
                <FormControl>
                  <Input placeholder="blog-post-url-slug" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="w-full sm:w-1/2">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Fundamentals">Fundamentals</SelectItem>
                    <SelectItem value="Career">Career</SelectItem>
                    <SelectItem value="Technical">Technical</SelectItem>
                    <SelectItem value="Industry">Industry</SelectItem>
                    <SelectItem value="Case Studies">Case Studies</SelectItem>
                    <SelectItem value="Tools">Tools</SelectItem>
                    <SelectItem value="Ethics">Ethics</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <FormField
        control={form.control}
        name="tags"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tags</FormLabel>
            <FormControl>
              <TagInput 
                tags={field.value} 
                onTagsChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="imageUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Featured Image</FormLabel>
            <FormControl>
              <ImageUploader
                imageUrl={field.value || ''}
                onImageChange={field.onChange}
                showPreview={showImagePreview}
                onTogglePreview={toggleImagePreview}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
