
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useProfileUpdate } from '@/hooks/useProfileUpdate';
import { useState } from 'react';

interface NotificationSettings {
  email: boolean;
  browser: boolean;
  frequency: 'daily' | 'weekly' | 'never';
}

export const NotificationSettings = ({ 
  initialSettings 
}: { 
  initialSettings: NotificationSettings 
}) => {
  const [settings, setSettings] = useState(initialSettings);
  const { updateProfile, loading } = useProfileUpdate();

  const handleChange = async (newSettings: Partial<NotificationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    await updateProfile({ notification_settings: updatedSettings });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="email-notifications">Email Notifications</Label>
          <Switch
            id="email-notifications"
            checked={settings.email}
            onCheckedChange={(checked) => handleChange({ email: checked })}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="browser-notifications">Browser Notifications</Label>
          <Switch
            id="browser-notifications"
            checked={settings.browser}
            onCheckedChange={(checked) => handleChange({ browser: checked })}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label>Notification Frequency</Label>
          <RadioGroup
            value={settings.frequency}
            onValueChange={(value: 'daily' | 'weekly' | 'never') => 
              handleChange({ frequency: value })
            }
            disabled={loading}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="daily" id="daily" />
              <Label htmlFor="daily">Daily</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="weekly" id="weekly" />
              <Label htmlFor="weekly">Weekly</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="never" id="never" />
              <Label htmlFor="never">Never</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
};
