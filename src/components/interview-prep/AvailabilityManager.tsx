
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Plus, Trash2 } from 'lucide-react';

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
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [userTimezone, setUserTimezone] = useState<string>('');
  const [activeDays, setActiveDays] = useState<number[]>([]);

  useEffect(() => {
    if (user) {
      loadAvailability();
    }
    // Get user's timezone
    setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
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

            // Track active days
            if (existingSlot.is_available && !activeDays.includes(day.id)) {
              setActiveDays(prev => [...prev, day.id]);
            }
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

  const toggleDay = (dayId: number) => {
    if (activeDays.includes(dayId)) {
      // Remove this day from active days
      setActiveDays(activeDays.filter(id => id !== dayId));
      
      // Set all slots for this day as unavailable
      setAvailability(prev => {
        return prev.map(slot => {
          if (slot.weekday === dayId) {
            return { ...slot, is_available: false };
          }
          return slot;
        });
      });
    } else {
      // Add this day to active days
      setActiveDays([...activeDays, dayId]);
    }
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
      const slotsToInsert = availability
        .filter(slot => slot.is_available) // Only insert available slots
        .map(slot => ({
          user_id: user.id,
          weekday: slot.weekday,
          time_slot: slot.time_slot,
          is_available: true
      }));
      
      if (slotsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('availability_slots')
          .insert(slotsToInsert);
          
        if (insertError) throw insertError;
      }
      
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

  // Group available time slots by day for easier rendering
  const timeSlotsByDay: Record<number, string[]> = {};
  DAYS_OF_WEEK.forEach(day => {
    timeSlotsByDay[day.id] = availability
      .filter(slot => slot.weekday === day.id && slot.is_available)
      .map(slot => slot.time_slot);
  });

  return (
    <div className="space-y-6">
      <div className="text-xl font-semibold mb-4">Set your availability</div>
      <div className="text-sm text-muted-foreground mb-6">
        <p>Let peers know when you're typically available for mock interviews.</p>
        <p className="mt-2">
          <Badge variant="outline" className="mr-2">Time Zone</Badge>
          {userTimezone}
        </p>
      </div>
      
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium mb-4">Available days</h3>
          <div className="grid grid-cols-7 gap-2">
            {DAYS_OF_WEEK.map(day => (
              <div 
                key={day.id} 
                onClick={() => toggleDay(day.id)}
                className={`
                  relative flex flex-col items-center justify-center p-3 border rounded-md cursor-pointer
                  ${activeDays.includes(day.id) 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'}
                `}
              >
                {activeDays.includes(day.id) && (
                  <div className="absolute top-1 right-1">
                    <Check className="h-4 w-4 text-blue-500" />
                  </div>
                )}
                <span className="text-sm font-medium">{day.name.substring(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-medium mb-4">Available hours</h3>
          
          {/* For each active day, show time slot selection */}
          <div className="space-y-6">
            {DAYS_OF_WEEK.filter(day => activeDays.includes(day.id)).map(day => (
              <div key={day.id} className="border rounded-md p-4">
                <h4 className="text-md font-medium mb-3">{day.name}</h4>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {timeBlocks.map(slot => {
                    const isChecked = availability.find(
                      s => s.weekday === day.id && s.time_slot === slot.id
                    )?.is_available || false;
                    
                    return (
                      <div key={slot.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`slot-${day.id}-${slot.id}`}
                          checked={isChecked}
                          onCheckedChange={() => toggleAvailability(day.id, slot.id)}
                        />
                        <label
                          htmlFor={`slot-${day.id}-${slot.id}`}
                          className="text-sm cursor-pointer whitespace-nowrap"
                        >
                          {slot.startTime} - {slot.endTime}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {activeDays.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <p>Select at least one day to set available hours</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-8 pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          All times are shown in your local timezone.
        </div>
        <Button onClick={saveAvailability} disabled={saving || activeDays.length === 0} className="ml-auto">
          {saving ? <Spinner size="sm" className="mr-2" /> : null}
          Save Availability
        </Button>
      </div>
    </div>
  );
}
