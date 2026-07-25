
import { useCallback, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfileUpdate } from '@/hooks/useProfileUpdate';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('ProfileAvatar');

export const ProfileAvatar = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const { updateProfile } = useProfileUpdate();
  const [preview, setPreview] = useState<string | null>(user?.avatar || null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}/${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(filePath);

      await updateProfile({ avatar_url: data.publicUrl });
      setPreview(data.publicUrl);
    } catch (error: any) {
      // A failed upload must not end silently with the old avatar in place.
      logger.error('Error uploading avatar:', error);
      toast({
        title: 'Avatar upload failed',
        description: error?.message || 'Could not upload your avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }, [user, updateProfile, toast]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar className="h-24 w-24">
        <AvatarImage src={preview || undefined} />
        <AvatarFallback>
          {user?.name?.charAt(0) || '?'}
        </AvatarFallback>
      </Avatar>

      <input
        type="file"
        id="avatar-upload"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
        disabled={uploading}
      />
      <label htmlFor="avatar-upload">
        <Button
          variant="outline"
          disabled={uploading}
          className="cursor-pointer"
          asChild
        >
          <span>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? 'Uploading...' : 'Change Avatar'}
          </span>
        </Button>
      </label>
    </div>
  );
};
