
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Eye, Settings } from 'lucide-react';
import { BlogFormData } from '@/types/blog';
import { UseFormReturn } from 'react-hook-form';
import { BlogFormFields } from './BlogFormFields';
import { PreviewTab } from './PreviewTab';
import { SeoTab } from './SeoTab';

interface FormTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  form: UseFormReturn<BlogFormData>;
  showImagePreview: boolean;
  toggleImagePreview: () => void;
  generateSlug: () => void;
}

export function FormTabs({ 
  activeTab, 
  onTabChange,
  form,
  showImagePreview,
  toggleImagePreview,
  generateSlug
}: FormTabsProps) {
  // Get watched values for preview
  const content = form.watch('content');
  const title = form.watch('title');
  const imageUrl = form.watch('imageUrl');

  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
      className="w-full"
    >
      <TabsList>
        <TabsTrigger value="edit" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Editor
        </TabsTrigger>
        <TabsTrigger value="preview" className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Preview
        </TabsTrigger>
        <TabsTrigger value="settings" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </TabsTrigger>
      </TabsList>

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
  );
}
