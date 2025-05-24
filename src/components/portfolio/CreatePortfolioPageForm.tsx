
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PortfolioTheme } from '@/types/portfolio';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreatePortfolioPageFormProps {
  onSuccess: () => void;
}

export function CreatePortfolioPageForm({ onSuccess }: CreatePortfolioPageFormProps) {
  const { toast } = useToast();
  const { addPortfolioPage } = usePortfolioPages();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    theme: 'default' as PortfolioTheme,
    is_public: false,
    custom_url: '',
  });

  const [errors, setErrors] = useState({
    title: '',
    custom_url: '',
  });

  // Check if custom URL already exists
  const checkUrlExists = async (url: string): Promise<boolean> => {
    if (!url.trim()) return false;
    
    setIsCheckingUrl(true);
    try {
      const { data, error } = await supabase
        .from('portfolio_pages')
        .select('id')
        .eq('custom_url', url)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking URL:', error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error('Error checking URL:', error);
      return false;
    } finally {
      setIsCheckingUrl(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    let valid = true;
    const newErrors = { title: '', custom_url: '' };
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
      valid = false;
    }
    
    if (formData.is_public && !formData.custom_url.trim()) {
      newErrors.custom_url = 'Custom URL is required for public portfolios';
      valid = false;
    }
    
    // Make sure custom URL is URL-friendly
    let urlFriendlyCustomUrl = '';
    if (formData.custom_url) {
      urlFriendlyCustomUrl = formData.custom_url
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      
      if (urlFriendlyCustomUrl !== formData.custom_url.trim().toLowerCase()) {
        newErrors.custom_url = 'URL can only contain letters, numbers, and hyphens';
        valid = false;
      }
      
      // Check if URL already exists
      if (valid && urlFriendlyCustomUrl) {
        const urlExists = await checkUrlExists(urlFriendlyCustomUrl);
        if (urlExists) {
          newErrors.custom_url = 'This URL is already taken. Please choose a different one.';
          valid = false;
        }
      }
    }
    
    setErrors(newErrors);
    
    if (valid) {
      try {
        setIsLoading(true);
        await addPortfolioPage.mutateAsync({
          ...formData,
          custom_url: urlFriendlyCustomUrl,
        });
        toast({
          title: 'Success',
          description: 'Portfolio page created successfully',
        });
        onSuccess();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to create portfolio page',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCancel = () => {
    onSuccess(); // Close the dialog
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when field is changed
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleUrlBlur = async () => {
    if (formData.custom_url && !errors.custom_url) {
      const urlFriendlyCustomUrl = formData.custom_url
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      
      // Update the URL to be URL-friendly
      if (urlFriendlyCustomUrl !== formData.custom_url) {
        setFormData(prev => ({
          ...prev,
          custom_url: urlFriendlyCustomUrl
        }));
      }
      
      // Check if URL exists
      if (urlFriendlyCustomUrl) {
        const urlExists = await checkUrlExists(urlFriendlyCustomUrl);
        if (urlExists) {
          setErrors(prev => ({
            ...prev,
            custom_url: 'This URL is already taken. Please choose a different one.'
          }));
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input 
          id="title" 
          value={formData.title} 
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="My Professional Portfolio"
          className={errors.title ? "border-red-500" : ""}
        />
        {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea 
          id="description" 
          value={formData.description} 
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="A collection of my data analytics projects..."
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="theme">Theme</Label>
        <Select 
          value={formData.theme}
          onValueChange={(value) => handleChange('theme', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="minimal">Minimal</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="creative">Creative</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Switch 
            id="is_public"
            checked={formData.is_public}
            onCheckedChange={(checked) => handleChange('is_public', checked)}
          />
          <Label htmlFor="is_public">Make this portfolio public</Label>
        </div>
        <p className="text-xs text-gray-500">
          Public portfolios can be viewed by anyone with the link.
        </p>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="custom_url">Custom URL</Label>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500">/portfolio/</span>
          <Input 
            id="custom_url" 
            value={formData.custom_url} 
            onChange={(e) => handleChange('custom_url', e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="my-portfolio"
            className={errors.custom_url ? "border-red-500" : ""}
            disabled={isCheckingUrl}
          />
        </div>
        {isCheckingUrl && (
          <p className="text-xs text-blue-500">Checking URL availability...</p>
        )}
        {errors.custom_url ? (
          <p className="text-xs text-red-500">{errors.custom_url}</p>
        ) : (
          <p className="text-xs text-gray-500">
            Use only letters, numbers, and hyphens. No spaces or special characters.
          </p>
        )}
      </div>
      
      <div className="flex justify-end space-x-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleCancel}
          disabled={isLoading || isCheckingUrl}
        >
          Cancel
        </Button>
        <Button 
          type="submit"
          className="bg-[#9b87f5] hover:bg-[#8B5CF6]"
          disabled={isLoading || isCheckingUrl}
        >
          {isLoading ? 'Creating...' : 'Create Portfolio Page'}
        </Button>
      </div>
    </form>
  );
}
