
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, Plus, Upload, CalendarIcon } from 'lucide-react';
import { ProfileData } from '@/types/portfolio';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ProfileSectionProps {
  profileData: ProfileData;
  onUpdate: (data: ProfileData) => void;
}

export function ProfileSection({ profileData, onUpdate }: ProfileSectionProps) {
  const { user } = useAuth();
  const { uploadFile, uploading } = useStorageUpload();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const updateField = (field: keyof ProfileData, value: any) => {
    const updatedData = { ...profileData, [field]: value };
    onUpdate(updatedData);
  };

  const validateAndFormatUrl = (url: string): string => {
    if (!url.trim()) return url;
    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      return `https://${trimmedUrl}`;
    }
    return trimmedUrl;
  };

  const handleUrlChange = (field: keyof ProfileData, value: string) => {
    const formattedUrl = validateAndFormatUrl(value);
    updateField(field, formattedUrl);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id) return;
    
    setUploadingAvatar(true);
    try {
      const result = await uploadFile(file, 'user-avatars', user.id);
      if (result?.publicUrl) {
        updateField('avatar_url', result.publicUrl);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const addSkill = (skill: string) => {
    if (skill.trim() && !profileData.skills?.includes(skill.trim())) {
      const updatedSkills = [...(profileData.skills || []), skill.trim()];
      updateField('skills', updatedSkills);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    const updatedSkills = profileData.skills?.filter(skill => skill !== skillToRemove) || [];
    updateField('skills', updatedSkills);
  };

  const addExperience = () => {
    const newExperience = {
      id: Date.now().toString(),
      role: '',
      company: '',
      startDate: '',
      endDate: '',
      description: ''
    };
    const updatedExperience = [...(profileData.experience || []), newExperience];
    updateField('experience', updatedExperience);
  };

  const updateExperience = (id: string, field: string, value: string) => {
    const updatedExperience = profileData.experience?.map(exp => 
      exp.id === id ? { ...exp, [field]: value } : exp
    ) || [];
    updateField('experience', updatedExperience);
  };

  const removeExperience = (id: string) => {
    const updatedExperience = profileData.experience?.filter(exp => exp.id !== id) || [];
    updateField('experience', updatedExperience);
  };

  const addEducation = () => {
    const newEducation = {
      id: Date.now().toString(),
      institution: '',
      degree: '',
      graduationYear: ''
    };
    const updatedEducation = [...(profileData.education || []), newEducation];
    updateField('education', updatedEducation);
  };

  const updateEducation = (id: string, field: string, value: string) => {
    const updatedEducation = profileData.education?.map(edu => 
      edu.id === id ? { ...edu, [field]: value } : edu
    ) || [];
    updateField('education', updatedEducation);
  };

  const removeEducation = (id: string) => {
    const updatedEducation = profileData.education?.filter(edu => edu.id !== id) || [];
    updateField('education', updatedEducation);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Tell the world about yourself</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="avatar-url">Avatar</Label>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {profileData.avatar_url ? (
                  <img 
                    src={profileData.avatar_url} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-500 text-sm">No image</span>
                )}
              </div>
              <div className="flex-1">
                <Input
                  id="avatar-url"
                  value={profileData.avatar_url || ''}
                  onChange={(e) => updateField('avatar_url', e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="mb-2"
                />
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                  }}
                  disabled={uploadingAvatar}
                />
                <label htmlFor="avatar-upload">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingAvatar}
                    className="cursor-pointer"
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingAvatar ? 'Uploading...' : 'Upload Image'}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="professional-summary">Professional Summary</Label>
            <Textarea
              id="professional-summary"
              value={profileData.professional_summary || ''}
              onChange={(e) => updateField('professional_summary', e.target.value)}
              placeholder="Describe your professional background and expertise..."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={profileData.location || ''}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="City, Country"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profileData.email || ''}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <Label htmlFor="github">GitHub URL</Label>
            <Input
              id="github"
              value={profileData.github_url || ''}
              onChange={(e) => handleUrlChange('github_url', e.target.value)}
              placeholder="https://github.com/username"
            />
          </div>

          <div>
            <Label htmlFor="linkedin">LinkedIn URL</Label>
            <Input
              id="linkedin"
              value={profileData.linkedin_url || ''}
              onChange={(e) => handleUrlChange('linkedin_url', e.target.value)}
              placeholder="https://linkedin.com/in/username"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>Add your technical and professional skills</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter a skill and press Enter"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const target = e.target as HTMLInputElement;
                    addSkill(target.value);
                    target.value = '';
                  }
                }}
              />
              <Button 
                type="button"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  if (input?.value) {
                    addSkill(input.value);
                    input.value = '';
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {profileData.skills?.map((skill, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {skill}
                  <button
                    onClick={() => removeSkill(skill)}
                    className="ml-1 text-xs hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Experience</CardTitle>
              <CardDescription>Add your work experience</CardDescription>
            </div>
            <Button onClick={addExperience} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Experience
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {profileData.experience?.map((exp) => (
              <ExperienceCard
                key={exp.id}
                experience={exp}
                onUpdate={(field, value) => updateExperience(exp.id, field, value)}
                onRemove={() => removeExperience(exp.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Education</CardTitle>
              <CardDescription>Add your educational background</CardDescription>
            </div>
            <Button onClick={addEducation} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Education
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {profileData.education?.map((edu) => (
              <div key={edu.id} className="border p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label>Institution</Label>
                      <Input
                        value={edu.institution}
                        onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)}
                        placeholder="University Name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Degree</Label>
                        <Input
                          value={edu.degree}
                          onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                          placeholder="Bachelor's in Computer Science"
                        />
                      </div>
                      <div>
                        <Label>Graduation Year</Label>
                        <Input
                          value={edu.graduationYear}
                          onChange={(e) => updateEducation(edu.id, 'graduationYear', e.target.value)}
                          placeholder="2023"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEducation(edu.id)}
                    className="ml-2 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ExperienceCardProps {
  experience: {
    id: string;
    role: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
  };
  onUpdate: (field: string, value: string) => void;
  onRemove: () => void;
}

function ExperienceCard({ experience, onUpdate, onRemove }: ExperienceCardProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(
    experience.startDate ? new Date(experience.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    experience.endDate ? new Date(experience.endDate) : undefined
  );

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    onUpdate('startDate', date ? format(date, 'yyyy-MM') : '');
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    onUpdate('endDate', date ? format(date, 'yyyy-MM') : '');
  };

  return (
    <div className="border p-4 rounded-lg space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Input
                value={experience.role}
                onChange={(e) => onUpdate('role', e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
            <div>
              <Label>Company</Label>
              <Input
                value={experience.company}
                onChange={(e) => onUpdate('company', e.target.value)}
                placeholder="Company Name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM yyyy") : <span>Select date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={handleStartDateChange}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM yyyy") : <span>Current / Select date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={handleEndDateChange}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={experience.description}
              onChange={(e) => onUpdate('description', e.target.value)}
              placeholder="Describe your role and achievements..."
              rows={3}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="ml-2 text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
