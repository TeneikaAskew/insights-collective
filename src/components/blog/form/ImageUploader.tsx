
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Image } from 'lucide-react';
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
  const [previewError, setPreviewError] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const result = await uploadFile(file, 'blog-images', 'posts');
      if (result?.publicUrl) {
        onImageChange(result.publicUrl);
        setPreviewError(false);
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

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onImageChange(e.target.value);
    setPreviewError(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input 
          placeholder="https://example.com/image.jpg" 
          value={imageUrl}
          onChange={handleImageUrlChange}
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
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onTogglePreview}
          className="flex-shrink-0"
        >
          <Image className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Always show image preview when URL exists */}
      {imageUrl && (
        <div className={`mt-2 border rounded-md overflow-hidden ${previewError ? 'hidden' : 'block'}`}>
          <img 
            src={imageUrl} 
            alt="Preview" 
            className="max-h-64 object-cover w-full"
            onError={(e) => {
              setPreviewError(true);
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
