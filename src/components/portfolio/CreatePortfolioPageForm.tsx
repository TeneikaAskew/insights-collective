
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PortfolioTheme } from '@/types/portfolio';

interface CreatePortfolioPageFormProps {
  onSubmit: (formData: {
    title: string;
    description: string;
    theme: PortfolioTheme;
    is_public: boolean;
    custom_url: string;
  }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function CreatePortfolioPageForm({ onSubmit, onCancel, isLoading }: CreatePortfolioPageFormProps) {
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

  const handleSubmit = (e: React.FormEvent) => {
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
    if (formData.custom_url) {
      const urlFriendlyCustomUrl = formData.custom_url
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      
      setFormData(prev => ({...prev, custom_url: urlFriendlyCustomUrl}));
      
      if (urlFriendlyCustomUrl !== formData.custom_url.trim().toLowerCase()) {
        newErrors.custom_url = 'URL can only contain letters, numbers, and hyphens';
        valid = false;
      }
    }
    
    setErrors(newErrors);
    
    if (valid) {
      onSubmit(formData);
    }
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Portfolio Page</CardTitle>
        <CardDescription>
          Create a customized portfolio page to showcase your completed projects.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
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
                placeholder="my-portfolio"
                className={errors.custom_url ? "border-red-500" : ""}
              />
            </div>
            {errors.custom_url ? (
              <p className="text-xs text-red-500">{errors.custom_url}</p>
            ) : (
              <p className="text-xs text-gray-500">
                Use only letters, numbers, and hyphens. No spaces or special characters.
              </p>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-end space-x-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            className="bg-[#9b87f5] hover:bg-[#8B5CF6]"
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Portfolio Page'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
