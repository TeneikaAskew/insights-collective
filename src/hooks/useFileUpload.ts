
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
    courseId: string,
    opts?: { submissionUserId?: string }
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
      // Path layout is load-bearing — the storage policies parse it with
      // split_part(name, '/', n). Course materials live at <courseId>/<file>
      // (writable only by course staff); student assignment attachments live at
      // submissions/<courseId>/<userId>/<file>, which the course_submission_*
      // policies authorize for the enrolled owner without granting general
      // course-material writes.
      const filePath = opts?.submissionUserId
        ? `submissions/${courseId}/${opts.submissionUserId}/${fileName}`
        : `${courseId}/${fileName}`;

      // Upload file
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // These buckets are private, so a public URL would not load. Hand back a
      // signed URL for immediate preview; the object path is stored alongside it
      // and render paths re-sign from that at read time (see utils/storageAssets).
      const { data: signed, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(data.path, 60 * 60);
      if (signError) throw signError;

      setProgress(100);

      return {
        url: signed.signedUrl,
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
