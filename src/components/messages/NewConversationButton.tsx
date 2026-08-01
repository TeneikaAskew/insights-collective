import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { NewConversationDialog } from './NewConversationDialog';
export function NewConversationButton() {
  const [open, setOpen] = useState(false);
  return <>
      {/* `mx-[130px]` used to sit here — 260px of fixed horizontal margin, which
          on a 390px viewport made this button 430px wide and pushed /messages
          72px off-screen. Its parent already handles placement
          (`self-start sm:self-auto` inside a `sm:justify-between` row), so the
          margin was both the cause and unnecessary.
          `items-right` is not a Tailwind class and never did anything. */}
      <Button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-ss-peach-deep hover:bg-ss-peach-deep/90">
        <Plus className="h-4 w-4" />
        New Conversation
      </Button>

      <NewConversationDialog open={open} onOpenChange={setOpen} />
    </>;
}