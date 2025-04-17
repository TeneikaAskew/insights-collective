import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Inbox, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { unarchiveConversation } from '@/services/conversationService';

interface UnarchiveButtonProps {
  conversationId: string;
  onSuccess?: () => void;
}

const UnarchiveButton: React.FC<UnarchiveButtonProps> = ({
  conversationId,
  onSuccess
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUnarchive = async () => {
    if (!user || !conversationId) return;
    
    setLoading(true);
    try {
      await unarchiveConversation(conversationId, user.id);
      
      toast({
        title: 'Success',
        description: 'Conversation moved back to inbox',
      });
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to unarchive conversation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleUnarchive}
      disabled={loading}
      className="w-full"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Inbox className="h-4 w-4 mr-2" />
      )}
      Move to Inbox
    </Button>
  );
};

export default UnarchiveButton;
