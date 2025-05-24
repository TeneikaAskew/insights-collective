
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Plus } from 'lucide-react';

interface ProfileSectionProps {
  profileData: {
    avatar_url?: string;
    professional_summary?: string;
    skills?: string[];
    location?: string;
    experience?: Array<{
      role: string;
      company: string;
      startDate: string;
      endDate: string;
      description: string;
    }>;
    education?: Array<{
      institution: string;
      degree: string;
      graduationYear: string;
    }>;
  };
  onUpdate: (data: any) => void;
}

export function ProfileSection({ profileData, onUpdate }: ProfileSectionProps) {
  const [newSkill, setNewSkill] = useState('');
  const [showExperience, setShowExperience] = useState(false);
  const [showEducation, setShowEducation] = useState(false);

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real implementation, this would upload to Supabase Storage
      const reader = new FileReader();
      reader.onload = (e) => {
        onUpdate({
          ...profileData,
          avatar_url: e.target?.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !profileData.skills?.includes(newSkill.trim())) {
      onUpdate({
        ...profileData,
        skills: [...(profileData.skills || []), newSkill.trim()]
      });
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    onUpdate({
      ...profileData,
      skills: profileData.skills?.filter(skill => skill !== skillToRemove) || []
    });
  };

  return (
    <div className="space-y-6">
      {/* Avatar Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>Upload a professional headshot</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              {profileData.avatar_url ? (
                <img 
                  src={profileData.avatar_url} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Upload className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <div>
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </span>
                </Button>
              </Label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <p className="text-xs text-gray-500 mt-1">JPEG or PNG, max 5MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professional Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Professional Summary</CardTitle>
          <CardDescription>A brief 3-4 sentence overview of your expertise</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={profileData.professional_summary || ''}
            onChange={(e) => onUpdate({
              ...profileData,
              professional_summary: e.target.value
            })}
            placeholder="Data Scientist focused on urban analytics and civic impact using Python, R, and geospatial tools. Experienced in building machine learning models and interactive dashboards..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>Your current location</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={profileData.location || ''}
            onChange={(e) => onUpdate({
              ...profileData,
              location: e.target.value
            })}
            placeholder="San Francisco, CA"
          />
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle>Skills & Technologies</CardTitle>
          <CardDescription>Add your technical skills and tools</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="e.g., Python, React, AWS"
              onKeyPress={(e) => e.key === 'Enter' && addSkill()}
            />
            <Button onClick={addSkill} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {profileData.skills && profileData.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profileData.skills.map((skill, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {skill}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-red-500"
                    onClick={() => removeSkill(skill)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Experience (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Experience
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExperience(!showExperience)}
            >
              {showExperience ? 'Hide' : 'Add'}
            </Button>
          </CardTitle>
          <CardDescription>Add your work experience (optional)</CardDescription>
        </CardHeader>
        {showExperience && (
          <CardContent>
            <p className="text-sm text-gray-500">Experience editing coming soon...</p>
          </CardContent>
        )}
      </Card>

      {/* Education (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Education
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEducation(!showEducation)}
            >
              {showEducation ? 'Hide' : 'Add'}
            </Button>
          </CardTitle>
          <CardDescription>Add your educational background (optional)</CardDescription>
        </CardHeader>
        {showEducation && (
          <CardContent>
            <p className="text-sm text-gray-500">Education editing coming soon...</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
