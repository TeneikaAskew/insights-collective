import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { NewConversationDialog } from './NewConversationDialog';
export function NewConversationButton() {
  const [open, setOpen] = useState(false);
  return <>
      <Button onClick={() => setOpen(true)} className="flex items-right gap-2 bg-ss-peach-deep hover:bg-ss-peach-deep/90 mx-[130px]">
        <Plus className="h-4 w-4" />
        New Conversation
      </Button>

      <NewConversationDialog open={open} onOpenChange={setOpen} />
    </>;
}