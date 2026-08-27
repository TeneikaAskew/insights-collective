
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Plus, Trash2, ChevronDown } from 'lucide-react';

import { createLogger } from '@/utils/logger';

const logger = createLogger('AvailabilityManager');

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
  user_id: string; // Added user_id to the interface to fix the TypeScript error
  weekday: number;
  time_slot: string;
  is_available: boolean;
}

interface TimeRange {
  startTime: string;
  endTime: string;
  id: string;
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
  const [userTimezone, setUserTimezone] = useState<string>('');
  const [activeDays, setActiveDays] = useState<number[]>([]);
  // Whether any rows exist for this user in availability_slots — including
  // is_available=false rows and stale slot ids the UI no longer renders. Save
  // clears-then-inserts, and a clear issued when no rows exist is a DELETE that
  // affects 0 rows: a real no-op the Supabase instrumentation reports as an
  // empty write. Tracking this lets a first-time save skip the pointless DELETE.
  const [hasPersistedSlots, setHasPersistedSlots] = useState(false);
  
  // State to track selected time slots for each day
  const [selectedTimesByDay, setSelectedTimesByDay] = useState<Record<number, TimeRange[]>>({});

  useEffect(() => {
    if (user) {
      loadAvailability();
    }
    // Get user's timezone
    setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    // Keyed on the id, not the object: useUser emits a NEW user object for
    // every auth event (getUser resolving, INITIAL_SESSION, TOKEN_REFRESHED),
    // and each one re-ran loadAvailability, which resets activeDays and
    // selectedTimesByDay to what the database holds — silently wiping the
    // selections someone was in the middle of making.
     
  }, [user?.id]);

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

      // Initialize the selected times data structure
      const timesByDay: Record<number, TimeRange[]> = {};
      const activeDaysList: number[] = [];
      
      // Group the data by weekday
      if (data && data.length > 0) {
        data.forEach(slot => {
          // Find the corresponding time block
          const timeBlock = timeBlocks.find(tb => tb.id === slot.time_slot);
          
          if (timeBlock && slot.is_available) {
            // If this day isn't in activeDaysList yet, add it
            if (!activeDaysList.includes(slot.weekday)) {
              activeDaysList.push(slot.weekday);
            }
            
            // Initialize the day's array if it doesn't exist
            if (!timesByDay[slot.weekday]) {
              timesByDay[slot.weekday] = [];
            }
            
            // Add this time slot
            timesByDay[slot.weekday].push({
              id: timeBlock.id,
              startTime: timeBlock.startTime,
              endTime: timeBlock.endTime
            });
          }
        });
      }
      
      setSelectedTimesByDay(timesByDay);
      setActiveDays(activeDaysList);
      setHasPersistedSlots((data?.length ?? 0) > 0);
    } catch (error: any) {
      logger.error('Error loading availability:', error);
      toast({
        title: 'Error',
        description: 'Failed to load availability: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayId: number) => {
    if (activeDays.includes(dayId)) {
      // Remove this day
      setActiveDays(activeDays.filter(id => id !== dayId));
      
      // Clear all time slots for this day
      const updatedTimes = { ...selectedTimesByDay };
      delete updatedTimes[dayId];
      setSelectedTimesByDay(updatedTimes);
    } else {
      // Add this day
      setActiveDays([...activeDays, dayId]);
    }
  };

  const addTimeSlot = (dayId: number) => {
    // Find the first available time slot that's not already selected
    const existingSlots = selectedTimesByDay[dayId] || [];
    const existingSlotIds = existingSlots.map(slot => slot.id);
    
    const availableTimeBlock = timeBlocks.find(tb => !existingSlotIds.includes(tb.id));
    
    if (availableTimeBlock) {
      setSelectedTimesByDay({
        ...selectedTimesByDay,
        [dayId]: [
          ...(selectedTimesByDay[dayId] || []),
          {
            id: availableTimeBlock.id,
            startTime: availableTimeBlock.startTime,
            endTime: availableTimeBlock.endTime
          }
        ]
      });
    }
  };

  const removeTimeSlot = (dayId: number, timeSlotId: string) => {
    const updatedSlots = selectedTimesByDay[dayId].filter(slot => slot.id !== timeSlotId);
    
    if (updatedSlots.length === 0) {
      // If removing the last time slot, also remove the day
      const updatedTimes = { ...selectedTimesByDay };
      delete updatedTimes[dayId];
      setSelectedTimesByDay(updatedTimes);
      setActiveDays(activeDays.filter(id => id !== dayId));
    } else {
      // Otherwise just update the time slots for this day
      setSelectedTimesByDay({
        ...selectedTimesByDay,
        [dayId]: updatedSlots
      });
    }
  };

  const updateTimeSlot = (dayId: number, oldSlotId: string, field: 'startTime' | 'endTime', newTimeBlock: TimeSlot) => {
    const daySlots = [...(selectedTimesByDay[dayId] || [])];
    const slotIndex = daySlots.findIndex(slot => slot.id === oldSlotId);
    
    if (slotIndex !== -1) {
      daySlots[slotIndex] = {
        ...daySlots[slotIndex],
        id: newTimeBlock.id,
        [field]: field === 'startTime' ? newTimeBlock.startTime : newTimeBlock.endTime,
        [field === 'startTime' ? 'endTime' : 'startTime']: 
          field === 'startTime' ? daySlots[slotIndex].endTime : daySlots[slotIndex].startTime
      };
      
      setSelectedTimesByDay({
        ...selectedTimesByDay,
        [dayId]: daySlots
      });
    }
  };

  const saveAvailability = async () => {
    if (!user?.id) return;
    
    try {
      setSaving(true);
      
      // Prepare the data for saving
      const availabilitySlots: Omit<AvailabilitySlot, 'id'>[] = [];
      
      // For each active day
      Object.entries(selectedTimesByDay).forEach(([dayIdStr, timeSlots]) => {
        const dayId = parseInt(dayIdStr, 10);
        
        // For each time slot on this day
        timeSlots.forEach(timeSlot => {
          availabilitySlots.push({
            user_id: user.id,
            weekday: dayId,
            time_slot: timeSlot.id,
            is_available: true
          });
        });
      });
      
      // First, delete all existing slots — but only when there are rows to
      // delete. On a first-time save the table holds nothing for this user, and
      // an unconditional DELETE affecting 0 rows is exactly the silent no-op
      // write the Supabase instrumentation flags as a defect.
      if (hasPersistedSlots) {
        const { error: deleteError } = await supabase
          .from('availability_slots')
          .delete()
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;
      }

      // Then insert the new slots
      if (availabilitySlots.length > 0) {
        const { error: insertError } = await supabase
          .from('availability_slots')
          .insert(availabilitySlots);

        if (insertError) throw insertError;
      }
      setHasPersistedSlots(availabilitySlots.length > 0);
      
      toast({
        title: 'Success',
        description: 'Your availability has been saved.',
      });
      
      // Notify parent component of availability change
      if (onAvailabilityChange) {
        onAvailabilityChange();
      }
    } catch (error: any) {
      logger.error('Error saving availability:', error);
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
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {DAYS_OF_WEEK.map(day => (
              <div 
                key={day.id} 
                onClick={() => toggleDay(day.id)}
                className={`
                  relative flex flex-col items-center justify-center p-2 sm:p-3 border rounded-md cursor-pointer
                  ${activeDays.includes(day.id) 
                    ? 'border-primary bg-accent text-accent-foreground ' 
                    : 'border-border hover:border-muted-foreground '}
                `}
              >
                {activeDays.includes(day.id) && (
                  <div className="absolute top-1 right-1">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                  </div>
                )}
                <span className="text-xs sm:text-sm font-medium">{day.name.substring(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-medium mb-4">Available hours</h3>
          
          {activeDays.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground border border-dashed rounded-md">
              <p>Select at least one day to set available hours</p>
            </div>
          ) : (
            <div className="space-y-6">
              {DAYS_OF_WEEK.filter(day => activeDays.includes(day.id)).map(day => (
                <div key={day.id} className="border rounded-md p-4">
                  <h4 className="text-md font-medium mb-3">{day.name}</h4>
                  
                  <div className="space-y-3">
                    {/* Time slots for this day */}
                    {(selectedTimesByDay[day.id] || []).map((timeRange, index) => (
                      <div key={`${day.id}-${timeRange.id}-${index}`} className="flex flex-wrap items-center gap-2">
                        <div className="flex-grow max-w-[180px] sm:max-w-[220px]">
                          <Select 
                            value={timeRange.id}
                            onValueChange={(value) => {
                              const selectedTimeBlock = timeBlocks.find(tb => tb.id === value);
                              if (selectedTimeBlock) {
                                updateTimeSlot(day.id, timeRange.id, 'startTime', selectedTimeBlock);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Start time">{timeRange.startTime}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {timeBlocks.map(block => (
                                <SelectItem key={`start-${block.id}`} value={block.id}>
                                  {block.startTime}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <span className="text-sm">to</span>
                        
                        <div className="flex-grow max-w-[180px] sm:max-w-[220px]">
                          <Select 
                            value={timeRange.id}
                            onValueChange={(value) => {
                              const selectedTimeBlock = timeBlocks.find(tb => tb.id === value);
                              if (selectedTimeBlock) {
                                updateTimeSlot(day.id, timeRange.id, 'endTime', selectedTimeBlock);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="End time">{timeRange.endTime}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {timeBlocks.map(block => (
                                <SelectItem key={`end-${block.id}`} value={block.id}>
                                  {block.endTime}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeTimeSlot(day.id, timeRange.id)}
                          className="h-9 w-9"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    {/* Add time slot button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => addTimeSlot(day.id)}
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add time
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
