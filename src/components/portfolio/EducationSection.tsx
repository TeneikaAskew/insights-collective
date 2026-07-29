
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Edit, Check } from 'lucide-react';

interface Education {
  id: string;
  institution: string;
  degree: string;
  graduationYear: string;
}

interface EducationSectionProps {
  education: Education[];
  onUpdate: (education: Education[]) => void;
}

export function EducationSection({ education, onUpdate }: EducationSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEducation, setNewEducation] = useState({
    institution: '',
    degree: '',
    graduationYear: ''
  });

  const handleAdd = () => {
    if (newEducation.institution && newEducation.degree) {
      const edu: Education = {
        id: Date.now().toString(),
        ...newEducation
      };
      onUpdate([...education, edu]);
      setNewEducation({ institution: '', degree: '', graduationYear: '' });
      setIsAdding(false);
    }
  };

  const handleEdit = (id: string, updatedEducation: Partial<Education>) => {
    const updated = education.map(edu => 
      edu.id === id ? { ...edu, ...updatedEducation } : edu
    );
    onUpdate(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onUpdate(education.filter(edu => edu.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Education
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardTitle>
        <CardDescription>Add your educational background</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {education.map((edu) => (
          <EducationCard
            key={edu.id}
            education={edu}
            isEditing={editingId === edu.id}
            onEdit={(updated) => handleEdit(edu.id, updated)}
            onDelete={() => handleDelete(edu.id)}
            onStartEdit={() => setEditingId(edu.id)}
            onCancelEdit={() => setEditingId(null)}
          />
        ))}
        
        {isAdding && (
          <div className="border rounded-lg p-4 space-y-3">
            <div>
              <Label htmlFor="institution">Institution</Label>
              <Input
                id="institution"
                value={newEducation.institution}
                onChange={(e) => setNewEducation(prev => ({ ...prev, institution: e.target.value }))}
                placeholder="University of California, Berkeley"
              />
            </div>
            <div>
              <Label htmlFor="degree">Degree</Label>
              <Input
                id="degree"
                value={newEducation.degree}
                onChange={(e) => setNewEducation(prev => ({ ...prev, degree: e.target.value }))}
                placeholder="Bachelor of Science in Computer Science"
              />
            </div>
            <div>
              <Label htmlFor="graduationYear">Graduation Year</Label>
              <Input
                id="graduationYear"
                value={newEducation.graduationYear}
                onChange={(e) => setNewEducation(prev => ({ ...prev, graduationYear: e.target.value }))}
                placeholder="2020"
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

interface EducationCardProps {
  education: Education;
  isEditing: boolean;
  onEdit: (updated: Partial<Education>) => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}

function EducationCard({ education, isEditing, onEdit, onDelete, onStartEdit, onCancelEdit }: EducationCardProps) {
  const [editData, setEditData] = useState(education);

  if (isEditing) {
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <div>
          <Label>Institution</Label>
          <Input
            value={editData.institution}
            onChange={(e) => setEditData(prev => ({ ...prev, institution: e.target.value }))}
          />
        </div>
        <div>
          <Label>Degree</Label>
          <Input
            value={editData.degree}
            onChange={(e) => setEditData(prev => ({ ...prev, degree: e.target.value }))}
          />
        </div>
        <div>
          <Label>Graduation Year</Label>
          <Input
            value={editData.graduationYear}
            onChange={(e) => setEditData(prev => ({ ...prev, graduationYear: e.target.value }))}
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
          <h3 className="font-semibold">{education.degree}</h3>
          <p className="text-muted-foreground">{education.institution}</p>
          <p className="text-sm text-muted-foreground">{education.graduationYear}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onStartEdit} variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
          <Button onClick={onDelete} variant="ghost" size="sm" className="text-ss-bad hover:text-ss-bad hover:bg-ss-bad-chip">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
