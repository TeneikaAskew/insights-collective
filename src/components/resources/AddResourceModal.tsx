
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export interface ResourceData {
  title: string;
  description: string;
  type: string;
  url: string;
  tags: string[];
  hasDeadline: boolean;
  deadline: Date | null;
}

export interface AddResourceModalProps {
  onAddResource: (resourceData: ResourceData) => void;
}

const AddResourceModal = ({ onAddResource }: AddResourceModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || !type || !url) {
      toast("Error", {
        description: 'Please fill in all required fields'
      });
      return;
    }

    const resourceData: ResourceData = {
      title,
      description,
      type,
      url,
      tags: tags.split(',').map(tag => tag.trim()),
      hasDeadline,
      deadline: hasDeadline ? new Date(deadline) : null,
    };

    onAddResource(resourceData);
    toast("Success", {
      description: 'Resource added successfully'
    });
    
    // Reset form
    setTitle('');
    setDescription('');
    setType('');
    setUrl('');
    setTags('');
    setHasDeadline(false);
    setDeadline('');
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add New Resource</DialogTitle>
      </DialogHeader>
      
      <form onSubmit={handleSubmit} className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Enter resource title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Enter resource description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Resource Type</Label>
            <Select value={type} onValueChange={setType} required>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="link">External Link</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              placeholder="Enter resource URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input
            id="tags"
            placeholder="E.g. python, data science, beginner"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="has-deadline" 
            checked={hasDeadline} 
            onCheckedChange={(checked) => {
              if (typeof checked === 'boolean') {
                setHasDeadline(checked);
              }
            }}
          />
          <Label htmlFor="has-deadline">Resource has deadline</Label>
        </div>
        
        {hasDeadline && (
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline Date</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required={hasDeadline}
            />
          </div>
        )}
        
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit">Add Resource</Button>
        </DialogFooter>
      </form>
    </>
  );
};

export default AddResourceModal;
