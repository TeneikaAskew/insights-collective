
import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Settings } from 'lucide-react';

interface AssistantControlPanelProps {
  careerFocus: string;
  onCareerFocusChange: (value: string) => void;
  careerPath: string;
  onCareerPathChange: (value: string) => void;
  salaryCap: number;
  onSalaryCapChange: (value: number) => void;
}

const careerAreas = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Marketing',
  'Data Science',
  'Creative',
  'Business',
  'Public Sector',
  'Engineering'
];

// Use the exact values from our CareerTrack type to ensure consistency
const careerPaths = [
  'AI/ML',
  'Analytics',
  'Data Engineering',
  'Business Intelligence'
];

const AssistantControlPanel = ({
  careerFocus,
  onCareerFocusChange,
  careerPath,
  onCareerPathChange,
  salaryCap,
  onSalaryCapChange
}: AssistantControlPanelProps) => {
  const formatSalary = (value: number) => {
    return `$${(value/1000).toFixed(0)}K`;
  };
  
  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      <div className="flex items-center">
        <Settings className="mr-2 h-5 w-5" />
        <h2 className="text-xl font-semibold">Personalize</h2>
      </div>
      
      <Separator />
      
      <div className="space-y-6">
        {/* Career Area Focus */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Career Area Focus</label>
          <Select 
            value={careerFocus} 
            onValueChange={onCareerFocusChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select area" />
            </SelectTrigger>
            <SelectContent>
              {careerAreas.map(area => (
                <SelectItem key={area} value={area}>
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select the industry or sector you're most interested in exploring
          </p>
        </div>
        
        {/* Career Path */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Career Path</label>
          <Select 
            value={careerPath} 
            onValueChange={onCareerPathChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select path" />
            </SelectTrigger>
            <SelectContent>
              {careerPaths.map(path => (
                <SelectItem key={path} value={path}>
                  {path}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose your preferred career path within data science
          </p>
        </div>
        
        {/* Target Salary */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium">Target Salary</label>
            <span className="text-sm">{formatSalary(salaryCap)}</span>
          </div>
          <Slider
            value={[salaryCap]}
            onValueChange={(values) => onSalaryCapChange(values[0])}
            min={40000}
            max={200000}
            step={5000}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>$40K</span>
            <span>$200K+</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Set your target salary range to focus recommendations
          </p>
        </div>
        
        {/* Additional sections could be added here */}
        <div className="p-4 bg-muted rounded-lg">
          <h3 className="text-sm font-medium">Personalization Tips</h3>
          <p className="text-xs text-muted-foreground mt-2">
            Adjusting these settings helps the AI assistant provide more relevant career recommendations tailored to your preferences.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AssistantControlPanel;
