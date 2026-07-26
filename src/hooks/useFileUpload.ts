
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useFileUpload');

export interface UploadedFile {
  url: string;
  path: string;
  size: number;
  type: string;
  name: string;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const uploadFile = async (
    file: File,
    bucket: 'course-images' | 'course-videos' | 'course-documents',
    courseId: string
  ): Promise<UploadedFile | null> => {
    if (!file) return null;

    if (!courseId) {
      logger.error('uploadFile called without a courseId', { bucket });
      toast({
        title: 'Upload Failed',
        description: 'Could not determine which course this file belongs to.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      setUploading(true);
      setProgress(0);

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      // The course id has to be the first path segment: the bucket policies
      // resolve it with split_part(name, '/', 1)::uuid to decide who may read
      // or write the object.
      const filePath = `${courseId}/${fileName}`;

      // Upload file
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      setProgress(100);

      return {
        url: publicUrl,
        path: data.path,
        size: file.size,
        type: file.type,
        name: file.name
      };

    } catch (error: any) {
      logger.error('Error uploading file:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const deleteFile = async (bucket: string, path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) throw error;
      return true;
    } catch (error: any) {
      logger.error('Error deleting file:', error);
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete file',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    uploadFile,
    deleteFile,
    uploading,
    progress
  };
}
