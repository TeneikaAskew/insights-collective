import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AvailabilitySlot } from '@/types/interview';
import { format } from 'date-fns';

interface AvailabilityCalendarProps extends React.HTMLAttributes<HTMLDivElement> {}

const timeBlocks = [
  { id: 'morning', label: 'Morning (9 AM - 12 PM)' },
  { id: 'afternoon', label: 'Afternoon (1 PM - 5 PM)' },
  { id: 'evening', label: 'Evening (6 PM - 9 PM)' },
];

const weekdays = [
  { id: 0, name: 'Sunday' },
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
];

export function AvailabilityCalendar({ className, ...props }: AvailabilityCalendarProps) {
  const [availability] = useState<AvailabilitySlot[]>([
    {
      id: '1',
      user_id: '1',
      weekday: 1,
      time_block: 'morning',
      is_available: true,
      created_at: '2024-03-20T10:00:00Z',
    },
    {
      id: '2',
      user_id: '1',
      weekday: 3,
      time_block: 'afternoon',
      is_available: true,
      created_at: '2024-03-20T10:00:00Z',
    },
  ]);

  const isAvailable = (weekday: number, timeBlock: string) => {
    return availability.some(
      (slot) => slot.weekday === weekday && slot.time_block === timeBlock && slot.is_available
    );
  };

  const toggleAvailability = (weekday: number, timeBlock: string) => {
    // Implement toggle functionality
    console.log('Toggle availability:', weekday, timeBlock);
  };

  return (
    <Card className={cn('col-span-3', className)} {...props}>
      <CardHeader>
        <CardTitle>Your Availability</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-8 gap-2 text-sm">
            <div className="col-span-2"></div>
            {weekdays.map((day) => (
              <div key={day.id} className="text-center font-medium">
                {day.name.slice(0, 3)}
              </div>
            ))}
          </div>
          {timeBlocks.map((block) => (
            <div key={block.id} className="grid grid-cols-8 gap-2">
              <div className="col-span-2 flex items-center text-sm">
                {block.label}
              </div>
              {weekdays.map((day) => (
                <Button
                  key={day.id}
                  variant={isAvailable(day.id, block.id) ? 'default' : 'outline'}
                  className="h-8 w-full"
                  onClick={() => toggleAvailability(day.id, block.id)}
                >
                  <span className="sr-only">
                    {isAvailable(day.id, block.id) ? 'Available' : 'Unavailable'}
                  </span>
                </Button>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-medium">Next Available Slots</h3>
          <div className="space-y-2">
            {availability.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <div>
                  <p className="font-medium">{weekdays[slot.weekday].name}</p>
                  <p className="text-muted-foreground">
                    {timeBlocks.find((block) => block.id === slot.time_block)?.label}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 