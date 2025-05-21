
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { v4 as uuidv4 } from 'uuid';

export function useStorageUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  
  const uploadFile = async (
    file: File, 
    bucket: string = 'module-content', 
    folderPath: string = ''
  ) => {
    if (!file) return null;
    
    try {
      setUploading(true);
      setProgress(0);
      
      // Create a unique file path to avoid overwriting
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
      
      // Upload the file
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
          contentDisposition: `inline; filename="${file.name}"`
        });
      
      if (error) throw error;
      
      // Set progress to 100% when upload completes
      setProgress(100);
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);
      
      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });
      
      return {
        path: data.path,
        fullPath: filePath,
        publicUrl: urlData.publicUrl,
        fileName: fileName
      };
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };
  
  const deleteFile = async (filePath: string, bucket: string = 'module-content') => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'File deleted successfully',
      });
      
      return true;
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: 'Error',
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
