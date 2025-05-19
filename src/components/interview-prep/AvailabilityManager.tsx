
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
}

interface AvailabilityManagerProps {
  timeBlocks: TimeSlot[];
  onAvailabilityChange?: () => void;
}

interface AvailabilitySlot {
  id?: string;
  weekday: number;
  time_slot: string;
  is_available: boolean;
}

const DAYS_OF_WEEK = [
  { id: 0, name: 'Sunday' },
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
];

export function AvailabilityManager({ timeBlocks, onAvailabilityChange }: AvailabilityManagerProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    if (user) {
      loadAvailability();
    }
  }, [user]);

  const loadAvailability = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Get existing availability slots
      const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Create a complete set of availability slots for all days and time slots
      const completeAvailability: AvailabilitySlot[] = [];
      
      // For each day of the week
      DAYS_OF_WEEK.forEach(day => {
        // For each time slot
        timeBlocks.forEach(slot => {
          // Find if there's an existing record
          const existingSlot = data?.find(
            record => record.weekday === day.id && record.time_slot === slot.id
          );
          
          if (existingSlot) {
            // Use existing data
            completeAvailability.push({
              id: existingSlot.id,
              weekday: existingSlot.weekday,
              time_slot: existingSlot.time_slot,
              is_available: existingSlot.is_available
            });
          } else {
            // Create new entry with default value (not available)
            completeAvailability.push({
              weekday: day.id,
              time_slot: slot.id,
              is_available: false
            });
          }
        });
      });
      
      setAvailability(completeAvailability);
    } catch (error: any) {
      console.error('Error loading availability:', error);
      toast({
        title: 'Error',
        description: 'Failed to load availability: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = (weekday: number, timeSlotId: string) => {
    setAvailability(prev => {
      return prev.map(slot => {
        if (slot.weekday === weekday && slot.time_slot === timeSlotId) {
          return { ...slot, is_available: !slot.is_available };
        }
        return slot;
      });
    });
  };

  const toggleAllForDay = (weekday: number, value: boolean) => {
    setAvailability(prev => {
      return prev.map(slot => {
        if (slot.weekday === weekday) {
          return { ...slot, is_available: value };
        }
        return slot;
      });
    });
  };

  const toggleAllForTimeSlot = (timeSlotId: string, value: boolean) => {
    setAvailability(prev => {
      return prev.map(slot => {
        if (slot.time_slot === timeSlotId) {
          return { ...slot, is_available: value };
        }
        return slot;
      });
    });
  };

  const saveAvailability = async () => {
    if (!user?.id) return;
    
    try {
      setSaving(true);
      
      // First, delete all existing availability slots
      const { error: deleteError } = await supabase
        .from('availability_slots')
        .delete()
        .eq('user_id', user.id);
        
      if (deleteError) throw deleteError;
      
      // Then, insert all slots with their current status
      const slotsToInsert = availability.map(slot => ({
        user_id: user.id,
        weekday: slot.weekday,
        time_slot: slot.time_slot,
        is_available: slot.is_available
      }));
      
      const { error: insertError } = await supabase
        .from('availability_slots')
        .insert(slotsToInsert);
        
      if (insertError) throw insertError;
      
      toast({
        title: 'Success',
        description: 'Your availability has been saved.',
      });
      
      // Notify parent component of availability change
      if (onAvailabilityChange) {
        onAvailabilityChange();
      }
    } catch (error: any) {
      console.error('Error saving availability:', error);
      toast({
        title: 'Error',
        description: 'Failed to save availability: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground mb-4">
        Select the specific hours you're available to participate in mock interviews. 
        Others will only be able to schedule sessions with you during these times.
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left">Day</th>
              {timeBlocks.map(slot => (
                <th key={slot.id} className="p-2 text-center">
                  <div>{slot.label}</div>
                  <div className="text-xs text-muted-foreground">{slot.startTime}-{slot.endTime}</div>
                  <div className="flex gap-2 justify-center mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAllForTimeSlot(slot.id, true)}
                      className="h-7 text-xs px-2"
                    >
                      All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAllForTimeSlot(slot.id, false)}
                      className="h-7 text-xs px-2"
                    >
                      None
                    </Button>
                  </div>
                </th>
              ))}
              <th className="p-2 w-[100px] text-center">All/None</th>
            </tr>
          </thead>
          <tbody>
            {DAYS_OF_WEEK.map(day => (
              <tr key={day.id} className="border-t">
                <td className="p-4">{day.name}</td>
                {timeBlocks.map(slot => {
                  const availableSlot = availability.find(
                    s => s.weekday === day.id && s.time_slot === slot.id
                  );
                  const isAvailable = availableSlot?.is_available || false;
                  
                  return (
                    <td key={`${day.id}-${slot.id}`} className="p-2 text-center">
                      <Switch 
                        checked={isAvailable} 
                        onCheckedChange={() => toggleAvailability(day.id, slot.id)}
                      />
                    </td>
                  );
                })}
                <td className="p-2">
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAllForDay(day.id, true)}
                      className="h-7 w-7 p-0"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAllForDay(day.id, false)}
                      className="h-7 w-7 p-0"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-end mt-6">
        <Button onClick={saveAvailability} disabled={saving}>
          {saving ? <Spinner size="sm" className="mr-2" /> : null}
          Save Availability
        </Button>
      </div>
      
      <div className="text-sm text-muted-foreground mt-4">
        <p>Time slots are shown in your local timezone.</p>
        <p className="mt-1">
          <Badge variant="outline" className="mr-2">Note</Badge>
          Sessions are always scheduled as one-hour slots.
        </p>
      </div>
    </div>
  );
}
