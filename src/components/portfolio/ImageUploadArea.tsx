
import React, { useState, useRef } from 'react';
import { Upload, X, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('ImageUploadArea');

interface ImageUploadAreaProps {
  onImagesUploaded: (imageUrls: string[]) => void;
  existingImages?: string[];
  maxImages?: number;
}

export function ImageUploadArea({ 
  onImagesUploaded, 
  existingImages = [], 
  maxImages = 5 
}: ImageUploadAreaProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile } = useStorageUpload();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload images.",
        variant: "destructive",
      });
      return;
    }

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: "Invalid files",
        description: "Please select only image files.",
        variant: "destructive",
      });
      return;
    }

    if (existingImages.length + imageFiles.length > maxImages) {
      toast({
        title: "Too many images",
        description: `Maximum ${maxImages} images allowed.`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      logger.log(`Uploading ${imageFiles.length} images to project-images bucket`);
      
      for (const file of imageFiles) {
        const result = await uploadFile(file, 'project-images', user.id);
        if (result?.publicUrl) {
          uploadedUrls.push(result.publicUrl);
          logger.log('Image uploaded successfully:', result.publicUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        onImagesUploaded([...existingImages, ...uploadedUrls]);
        
        toast({
          title: "Images uploaded",
          description: `Successfully uploaded ${uploadedUrls.length} image(s).`,
        });
      }
    } catch (error) {
      logger.error('Error uploading images:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (indexToRemove: number) => {
    const updatedImages = existingImages.filter((_, index) => index !== indexToRemove);
    onImagesUploaded(updatedImages);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${uploading ? 'pointer-events-none opacity-50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />
        
        <div className="space-y-2">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div>
            <p className="text-lg font-medium text-gray-900">
              {uploading ? 'Uploading...' : 'Upload project screenshots'}
            </p>
            <p className="text-sm text-gray-500">
              Drag and drop images here, or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PNG, JPG, GIF up to 10MB • Max {maxImages} images
            </p>
          </div>
        </div>
      </div>

      {/* Image Preview Grid */}
      {existingImages.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {existingImages.map((imageUrl, index) => (
            <div key={index} className="relative group">
              <img
                src={imageUrl}
                alt={`Project screenshot ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
