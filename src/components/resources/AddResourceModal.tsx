
import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AddResourceModalProps {
  onAddResource: (resource: any) => void;
}

const resourceCategories = [
  { value: 'training', label: 'Training' },
  { value: 'event', label: 'Event' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'program', label: 'Program' },
];

export function AddResourceModal({ onAddResource }: AddResourceModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [link, setLink] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!name || !description || !category || !link) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const newResource = {
      id: Date.now().toString(),
      name,
      description,
      category,
      link,
      deadline: hasDeadline && deadline ? deadline.toISOString().split('T')[0] : null,
    };

    onAddResource(newResource);
    
    toast({
      title: 'Resource Added',
      description: 'The resource has been successfully added.',
    });
    
    // Reset form
    setName('');
    setDescription('');
    setCategory('');
    setLink('');
    setHasDeadline(false);
    setDeadline(undefined);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="ml-auto">Add Resource</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add New Resource</DialogTitle>
          <DialogDescription>
            Create a new resource to share with users. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="Resource name"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              placeholder="Resource description"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="col-span-3">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {resourceCategories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="link" className="text-right">
              Link
            </Label>
            <Input
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="col-span-3"
              placeholder="https://example.com/resource"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <div className="text-right">
              <Label htmlFor="hasDeadline">Deadline</Label>
            </div>
            <div className="flex items-center space-x-2 col-span-3">
              <Checkbox
                id="hasDeadline"
                checked={hasDeadline}
                onCheckedChange={(checked) => setHasDeadline(!!checked)}
              />
              <label
                htmlFor="hasDeadline"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                This resource has a deadline
              </label>
            </div>
          </div>
          {hasDeadline && (
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right">
                <Label>Date</Label>
              </div>
              <div className="col-span-3">
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !deadline && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deadline ? format(deadline, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={deadline}
                      onSelect={(date) => {
                        setDeadline(date);
                        setCalendarOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save Resource</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
