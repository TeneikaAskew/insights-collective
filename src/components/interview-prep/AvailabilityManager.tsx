
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Checkbox } from '@/components/ui/checkbox';

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
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div className="text-sm text-muted-foreground">
          <p>Select the specific hours you're available to participate in mock interviews.</p>
          <p>Others will only be able to schedule sessions with you during these times.</p>
          <p className="mt-2">
            <Badge variant="outline" className="mr-2">Time Zone</Badge>
            {userTimezone}
          </p>
        </div>
        
        <Button onClick={saveAvailability} disabled={saving} className="whitespace-nowrap">
          {saving ? <Spinner size="sm" className="mr-2" /> : null}
          Save Availability
        </Button>
      </div>
      
      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-[auto_1fr]'} gap-6`}>
        {/* Days column */}
        <div className="min-w-[150px]">
          <div className="mb-4 font-medium">Days</div>
          <div className="space-y-4">
            {DAYS_OF_WEEK.map(day => (
              <div key={day.id} className="flex items-center justify-between">
                <span>{day.name}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAllForDay(day.id, true)}
                    className="h-7 w-7 p-0"
                    title="Select all times for this day"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAllForDay(day.id, false)}
                    className="h-7 w-7 p-0"
                    title="Deselect all times for this day"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Time slots grid */}
        <ScrollArea className="border rounded-md p-4">
          <div className="min-w-max">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-2 mb-4">
              {timeBlocks.map(slot => (
                <div key={slot.id} className="flex flex-col items-center text-center">
                  <div className="text-sm font-medium">{slot.label}</div>
                  <div className="text-xs text-muted-foreground mb-2">{slot.startTime}-{slot.endTime}</div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAllForTimeSlot(slot.id, true)}
                      className="h-6 text-xs px-1"
                      title="Select this time for all days"
                    >
                      All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAllForTimeSlot(slot.id, false)}
                      className="h-6 text-xs px-1"
                      title="Deselect this time for all days"
                    >
                      None
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="space-y-4">
              {DAYS_OF_WEEK.map(day => (
                <div key={day.id} className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-2 items-center">
                  {timeBlocks.map(slot => {
                    const availableSlot = availability.find(
                      s => s.weekday === day.id && s.time_slot === slot.id
                    );
                    const isAvailable = availableSlot?.is_available || false;
                    
                    return (
                      <div 
                        key={`${day.id}-${slot.id}`} 
                        className="flex justify-center py-1"
                      >
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id={`slot-${day.id}-${slot.id}`}
                            checked={isAvailable} 
                            onCheckedChange={() => toggleAvailability(day.id, slot.id)}
                          />
                          <label
                            htmlFor={`slot-${day.id}-${slot.id}`}
                            className="text-sm cursor-pointer"
                          >
                            Available
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
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
