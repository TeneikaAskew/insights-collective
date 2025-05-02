
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { BlogFormData } from '@/types/blog';
import { Save } from 'lucide-react';
import { FormTabs } from './form/FormTabs';
import { StatusDropdown } from './form/StatusDropdown';

// Define the form schema with Zod
const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().min(1, 'Excerpt is required'),
  slug: z.string().min(1, 'Slug is required'),
  imageUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  featured: z.boolean().default(false),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

// Props interface
interface BlogPostFormProps {
  onSubmit: (data: BlogFormData) => void;
  isLoading: boolean;
  initialData?: Partial<BlogFormData>;
}

const BlogPostForm: React.FC<BlogPostFormProps> = ({ 
  onSubmit, 
  isLoading,
  initialData 
}) => {
  const [activeTab, setActiveTab] = useState('edit');
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Initialize form with default values or initialData if provided
  const form = useForm<BlogFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      excerpt: initialData?.excerpt || '',
      slug: initialData?.slug || '',
      imageUrl: initialData?.imageUrl || '',
      tags: initialData?.tags || [],
      category: initialData?.category || '',
      status: initialData?.status || 'draft',
      featured: initialData?.featured || false,
      seoTitle: initialData?.seoTitle || '',
      seoDescription: initialData?.seoDescription || '',
    },
  });

  // Generate slug from title
  const generateSlug = () => {
    const titleValue = form.getValues('title');
    if (titleValue) {
      const slug = titleValue
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      form.setValue('slug', slug);
    }
  };

  // Toggle image preview
  const toggleImagePreview = () => {
    setShowImagePreview(prev => !prev);
  };

  // Auto-generate slug when title changes (only if slug is empty or user hasn't modified it)
  useEffect(() => {
    const subscription = form.watch(({ title }, { name }) => {
      if (name === 'title' && (!form.getValues('slug') || form.getValues('slug') === '')) {
        const slug = title
          ?.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        if (slug) form.setValue('slug', slug);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Use the SEO title from the main title if not specified
  useEffect(() => {
    const subscription = form.watch(({ title, seoTitle }) => {
      if (title && !seoTitle) {
        form.setValue('seoTitle', title);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Handler for form submission
  const handleFormSubmit = (data: BlogFormData) => {
    onSubmit(data);
  };

  return (
    <div className="p-6">
      <Form {...form}>
        <form 
          id="blogPostForm" 
          onSubmit={form.handleSubmit(handleFormSubmit)} 
          className="space-y-6"
        >
          <div className="flex justify-between items-center mb-6">
            <FormTabs 
              activeTab={activeTab}
              onTabChange={setActiveTab}
              form={form}
              showImagePreview={showImagePreview}
              toggleImagePreview={toggleImagePreview}
              generateSlug={generateSlug}
            />
            
            <div className="flex items-center gap-2">
              <StatusDropdown 
                status={form.getValues('status') as 'draft' | 'published' | 'archived'}
                onStatusChange={(status) => form.setValue('status', status)}
              />
              
              <Button 
                type="submit" 
                form="blogPostForm"
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-b-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {initialData ? 'Update Post' : 'Create Post'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default BlogPostForm;
