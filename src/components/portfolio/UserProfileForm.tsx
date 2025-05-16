
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface UserProfileFormProps {
  onSubmit: (data: {
    interests: string[];
    currentRole: string;
    hobbies: string;
  }) => void;
  isLoading: boolean;
}

const UserProfileForm: React.FC<UserProfileFormProps> = ({ onSubmit, isLoading }) => {
  const [interests, setInterests] = useState<string>('');
  const [currentRole, setCurrentRole] = useState<string>('');
  const [hobbies, setHobbies] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Split interests by commas into an array
    const interestsArray = interests
      .split(',')
      .map(i => i.trim())
      .filter(i => i !== '');
    
    onSubmit({
      interests: interestsArray,
      currentRole,
      hobbies
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="currentRole">Current Role</Label>
            <Input
              id="currentRole"
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              placeholder="e.g., Data Analyst, Software Developer, Marketing Specialist"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="interests">Professional Interests (comma-separated)</Label>
            <Textarea
              id="interests"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g., Data visualization, Machine learning, UX design, Cloud architecture"
              rows={3}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="hobbies">
              What do you enjoy doing in your free time or when you're bored?
            </Label>
            <Textarea
              id="hobbies"
              value={hobbies}
              onChange={(e) => setHobbies(e.target.value)}
              placeholder="e.g., I enjoy solving puzzles, tinkering with home automation, analyzing sports statistics..."
              rows={4}
              required
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Analyzing...' : 'Analyze My Profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default UserProfileForm;
