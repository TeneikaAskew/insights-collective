
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Image, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import {

import { createLogger } from '@/utils/logger';

const logger = createLogger('ImageUploader');
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
      logger.error('Error uploading image:', error);
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

  const handleImageSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      // This is a mock implementation, in a real app you would connect to an image search API
      // For now, let's just simulate a search with some placeholder images
      setTimeout(() => {
        setSearchResults([
          "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=400",
          "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?q=80&w=400",
          "https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=400",
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=400"
        ]);
        setIsSearching(false);
      }, 1000);
    } catch (error) {
      logger.error('Error searching for images:', error);
      toast({
        title: "Error",
        description: "Failed to search for images",
        variant: "destructive"
      });
      setIsSearching(false);
    }
  };

  const selectSearchResult = (url: string) => {
    onImageChange(url);
    setIsDialogOpen(false);
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
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="flex-shrink-0"
            >
              <Search className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Find Images</DialogTitle>
              <DialogDescription>
                Search for free images to use in your blog post
              </DialogDescription>
            </DialogHeader>
            <div className="flex w-full items-center space-x-2 mt-4">
              <Input 
                placeholder="Search for images..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button type="button" onClick={handleImageSearch} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {searchResults.map((url, index) => (
                  <img 
                    key={index} 
                    src={url} 
                    alt={`Search result ${index + 1}`} 
                    className="cursor-pointer rounded-md hover:ring-2 hover:ring-primary"
                    onClick={() => selectSearchResult(url)}
                  />
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

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
