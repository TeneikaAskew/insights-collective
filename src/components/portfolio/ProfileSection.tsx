import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Upload, CalendarIcon, MapPin } from 'lucide-react';
import { ProfileData } from '@/types/portfolio';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { CityAutocomplete } from './CityAutocomplete';

interface ProfileSectionProps {
  profileData: ProfileData;
  onUpdate: (data: ProfileData) => void;
}

// Countries list
const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
  'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia',
  'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt',
  'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon',
  'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
  'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos',
  'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi',
  'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova',
  'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands',
  'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau',
  'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
  'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal',
  'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea',
  'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
  'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela',
  'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

// US States list
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas',  'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  'District of Columbia', 'American Samoa', 'Guam', 'Northern Mariana Islands', 'Puerto Rico', 'U.S. Virgin Islands'
];

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

  // Helper function to update location fields
  const updateLocationField = (field: 'city' | 'state' | 'country', value: string) => {
    const currentLocation = profileData.location_details || {};
    const updatedLocation = { ...currentLocation, [field]: value };
    updateField('location_details', updatedLocation);
  };

  // Generate display location string
  const getLocationDisplay = () => {
    const location = profileData.location_details;
    if (!location) return '';
    
    const parts = [];
    if (location.city) parts.push(location.city);
    if (location.state) parts.push(location.state);
    if (location.country) parts.push(location.country);
    
    return parts.length > 0 ? `You can find me in ${parts.join(', ')}` : '';
  };

  // Check if United States is selected to show state dropdown
  const isUnitedStatesSelected = profileData.location_details?.country === 'United States';

  return (
    <div className="space-y-6">
      {/* Basic Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Tell the world about yourself</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="avatar-section">Avatar</Label>
            <div className="flex items-start gap-4 mt-2">
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
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
              <div className="flex-1 space-y-3">
                <div>
                  <Label htmlFor="avatar-url" className="text-sm">Avatar URL</Label>
                  <Input
                    id="avatar-url"
                    value={profileData.avatar_url || ''}
                    onChange={(e) => updateField('avatar_url', e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">or</span>
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
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <CityAutocomplete
                value={profileData.location_details?.city || ''}
                onChange={(value) => updateLocationField('city', value)}
                country={profileData.location_details?.country}
                state={profileData.location_details?.state}
                placeholder="New York"
              />
              <div>
                <Label htmlFor="state" className="text-sm">State/Province</Label>
                {isUnitedStatesSelected ? (
                  <Select
                    value={profileData.location_details?.state || ''}
                    onValueChange={(value) => updateLocationField('state', value)}
                  >
                    <SelectTrigger id="state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="state"
                    value={profileData.location_details?.state || ''}
                    onChange={(e) => updateLocationField('state', e.target.value)}
                    placeholder="NY"
                  />
                )}
              </div>
              <div>
                <Label htmlFor="country" className="text-sm">Country</Label>
                <Select
                  value={profileData.location_details?.country || ''}
                  onValueChange={(value) => updateLocationField('country', value)}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="overflow-y-auto max-h-[200px]">
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {getLocationDisplay() && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                Preview: {getLocationDisplay()}
              </div>
            )}
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

      {/* Skills Card */}
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

      {/* Experience Card */}
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
            {(!profileData.experience || profileData.experience.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <p>No experience added yet. Click "Add Experience" to get started.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Education Card */}
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
            {(!profileData.education || profileData.education.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <p>No education added yet. Click "Add Education" to get started.</p>
              </div>
            )}
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
  // Helper function to safely parse and validate dates
  const parseDate = (dateString: string): Date | undefined => {
    if (!dateString) return undefined;
    try {
      // Handle both YYYY-MM format and full ISO dates
      const date = dateString.includes('T') ? parseISO(dateString) : parseISO(`${dateString}-01`);
      return isValid(date) ? date : undefined;
    } catch {
      return undefined;
    }
  };

  const [startDate, setStartDate] = useState<Date | undefined>(
    parseDate(experience.startDate)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    parseDate(experience.endDate)
  );

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    onUpdate('startDate', date ? format(date, 'yyyy-MM') : '');
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    onUpdate('endDate', date ? format(date, 'yyyy-MM') : '');
  };

  // Helper function to safely format dates for display
  const formatDateForDisplay = (date: Date | undefined): string => {
    if (!date || !isValid(date)) return 'Select date';
    try {
      return format(date, 'MMM yyyy');
    } catch {
      return 'Select date';
    }
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
                    {formatDateForDisplay(startDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={handleStartDateChange}
                    initialFocus
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
                    {endDate ? formatDateForDisplay(endDate) : 'Present'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={handleEndDateChange}
                    initialFocus
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
