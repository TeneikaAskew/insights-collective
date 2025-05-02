
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useStorageUpload } from '@/hooks/useStorageUpload';

interface ImageUploaderProps {
  imageUrl: string;
  onImageChange: (url: string) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
}

export function ImageUploader({ 
  imageUrl, 
  onImageChange, 
  showPreview, 
  onTogglePreview 
}: ImageUploaderProps) {
  const { uploadFile, uploading } = useStorageUpload();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const result = await uploadFile(file, 'blog-images', 'posts');
      if (result?.publicUrl) {
        onImageChange(result.publicUrl);
        toast({
          title: "Success",
          description: "Image uploaded successfully"
        });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input 
          placeholder="https://example.com/image.jpg" 
          value={imageUrl}
          onChange={(e) => onImageChange(e.target.value)}
          className="flex-1"
        />
        <Button 
          type="button" 
          variant="outline"
          size="icon"
          className="flex-shrink-0"
          asChild
        >
          <label htmlFor="image-upload" className="cursor-pointer">
            <Upload className="h-4 w-4" />
            <input 
              id="image-upload" 
              type="file" 
              className="hidden" 
              accept="image/*"
              onChange={handleImageUpload}
            />
          </label>
        </Button>
      </div>
      {showPreview && imageUrl && (
        <div className="mt-2 border rounded-md overflow-hidden">
          <img 
            src={imageUrl} 
            alt="Preview" 
            className="max-h-64 object-cover w-full"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder.svg';
              toast({
                title: "Image Error",
                description: "Could not load image. Please check the URL.",
                variant: "destructive"
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
