
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';
import { ProjectStatus } from '@/types/portfolio';

interface AddProjectDialogProps {
  onAddProject: (project: any) => void;
}

export function AddProjectDialog({ onAddProject }: AddProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState({
    title: '',
    description: '',
    required_skills: [] as string[],
    effort_level: 'Medium',
    impact: '',
    status: 'Idea' as ProjectStatus
  });
  const [skillInput, setSkillInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.title.trim()) return;
    
    onAddProject(project);
    setProject({
      title: '',
      description: '',
      required_skills: [],
      effort_level: 'Medium',
      impact: '',
      status: 'Idea'
    });
    setOpen(false);
  };

  const handleSkillAdd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!project.required_skills.includes(skillInput.trim())) {
        setProject({
          ...project,
          required_skills: [...project.required_skills, skillInput.trim()]
        });
      }
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setProject({
      ...project,
      required_skills: project.required_skills.filter(skill => skill !== skillToRemove)
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
          <PlusCircle className="h-4 w-4 mr-2" /> Add Custom Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Portfolio Project</DialogTitle>
            <DialogDescription>
              Create a custom project to add to your portfolio
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title*</Label>
              <Input
                id="title"
                value={project.title}
                onChange={(e) => setProject({ ...project, title: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={project.description}
                onChange={(e) => setProject({ ...project, description: e.target.value })}
                placeholder="What will you build in this project?"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="skills">Required Skills (press Enter to add)</Label>
              <Input
                id="skills"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillAdd}
                placeholder="e.g., React, Python, SQL"
              />
              {project.required_skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {project.required_skills.map((skill, index) => (
                    <div 
                      key={index} 
                      className="bg-gray-100 px-2 py-1 rounded-md text-xs flex items-center"
                    >
                      {skill}
                      <button 
                        type="button"
                        className="ml-1 text-gray-500 hover:text-red-500"
                        onClick={() => removeSkill(skill)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effort">Effort Level</Label>
                <Select
                  value={project.effort_level}
                  onValueChange={(value) => setProject({ ...project, effort_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select effort level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low (< 10 hours)</SelectItem>
                    <SelectItem value="Medium">Medium (10-30 hours)</SelectItem>
                    <SelectItem value="High">High (30+ hours)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Initial Status</Label>
                <Select
                  value={project.status}
                  onValueChange={(value: ProjectStatus) => setProject({ ...project, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Idea">Idea</SelectItem>
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="impact">Impact Statement</Label>
              <Textarea
                id="impact"
                value={project.impact}
                onChange={(e) => setProject({ ...project, impact: e.target.value })}
                placeholder="Why is this project valuable to showcase?"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!project.title.trim()}>
              Add Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
