
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Eye, Settings, Save } from 'lucide-react';
import { BlogFormData } from '@/types/blog';
import { UseFormReturn } from 'react-hook-form';
import { BlogFormFields } from './BlogFormFields';
import { PreviewTab } from './PreviewTab';
import { SeoTab } from './SeoTab';
import { Button } from '@/components/ui/button';
import { StatusDropdown } from './StatusDropdown';

interface FormTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  form: UseFormReturn<BlogFormData>;
  showImagePreview: boolean;
  toggleImagePreview: () => void;
  generateSlug: () => void;
  isLoading: boolean;
  initialData?: Partial<BlogFormData>;
}

export function FormTabs({ 
  activeTab, 
  onTabChange,
  form,
  showImagePreview,
  toggleImagePreview,
  generateSlug,
  isLoading,
  initialData
}: FormTabsProps) {
  // Get watched values for preview
  const content = form.watch('content');
  const title = form.watch('title');
  const imageUrl = form.watch('imageUrl');
  const status = form.watch('status');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

        <StatusDropdown 
          status={status as 'draft' | 'published' | 'archived'}
          onStatusChange={(newStatus) => form.setValue('status', newStatus)}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="w-full"
      >
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="edit" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="edit" className="space-y-6 mt-6">
          <BlogFormFields 
            form={form}
            showImagePreview={showImagePreview}
            toggleImagePreview={toggleImagePreview}
            generateSlug={generateSlug}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <PreviewTab 
            title={title} 
            content={content} 
            imageUrl={imageUrl} 
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 mt-6">
          <SeoTab form={form} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
