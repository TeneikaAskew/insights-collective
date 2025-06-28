
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Edit, Check } from 'lucide-react';

interface Experience {
  id: string;
  role: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface ExperienceSectionProps {
  experiences: Experience[];
  onUpdate: (experiences: Experience[]) => void;
}

export function ExperienceSection({ experiences, onUpdate }: ExperienceSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newExperience, setNewExperience] = useState({
    role: '',
    company: '',
    startDate: '',
    endDate: '',
    description: ''
  });

  const handleAdd = () => {
    if (newExperience.role && newExperience.company) {
      const experience: Experience = {
        id: Date.now().toString(),
        ...newExperience
      };
      onUpdate([...experiences, experience]);
      setNewExperience({ role: '', company: '', startDate: '', endDate: '', description: '' });
      setIsAdding(false);
    }
  };

  const handleEdit = (id: string, updatedExperience: Partial<Experience>) => {
    const updated = experiences.map(exp => 
      exp.id === id ? { ...exp, ...updatedExperience } : exp
    );
    onUpdate(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onUpdate(experiences.filter(exp => exp.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Experience
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardTitle>
        <CardDescription>Add your work experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {experiences.map((exp) => (
          <ExperienceCard
            key={exp.id}
            experience={exp}
            isEditing={editingId === exp.id}
            onEdit={(updated) => handleEdit(exp.id, updated)}
            onDelete={() => handleDelete(exp.id)}
            onStartEdit={() => setEditingId(exp.id)}
            onCancelEdit={() => setEditingId(null)}
          />
        ))}
        
        {isAdding && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={newExperience.role}
                  onChange={(e) => setNewExperience(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="Software Engineer"
                />
              </div>
              <div>
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={newExperience.company}
                  onChange={(e) => setNewExperience(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="Google"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="month"
                  value={newExperience.startDate}
                  onChange={(e) => setNewExperience(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="month"
                  value={newExperience.endDate}
                  onChange={(e) => setNewExperience(prev => ({ ...prev, endDate: e.target.value }))}
                  placeholder="Leave blank if current"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newExperience.description}
                onChange={(e) => setNewExperience(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of your role and achievements..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} size="sm">
                <Check className="h-4 w-4 mr-1" />
                Add
              </Button>
              <Button onClick={() => setIsAdding(false)} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ExperienceCardProps {
  experience: Experience;
  isEditing: boolean;
  onEdit: (updated: Partial<Experience>) => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}

function ExperienceCard({ experience, isEditing, onEdit, onDelete, onStartEdit, onCancelEdit }: ExperienceCardProps) {
  const [editData, setEditData] = useState(experience);

  if (isEditing) {
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Role</Label>
            <Input
              value={editData.role}
              onChange={(e) => setEditData(prev => ({ ...prev, role: e.target.value }))}
            />
          </div>
          <div>
            <Label>Company</Label>
            <Input
              value={editData.company}
              onChange={(e) => setEditData(prev => ({ ...prev, company: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Date</Label>
            <Input
              type="month"
              value={editData.startDate}
              onChange={(e) => setEditData(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <Label>End Date</Label>
            <Input
              type="month"
              value={editData.endDate}
              onChange={(e) => setEditData(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={editData.description}
            onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onEdit(editData)} size="sm">
            <Check className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button onClick={onCancelEdit} variant="outline" size="sm">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold">{experience.role}</h3>
          <p className="text-gray-600">{experience.company}</p>
          <p className="text-sm text-gray-500">
            {experience.startDate} - {experience.endDate || 'Present'}
          </p>
          {experience.description && (
            <p className="text-sm text-gray-700 mt-2">{experience.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={onStartEdit} variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
          <Button onClick={onDelete} variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
