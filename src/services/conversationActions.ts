import { supabase } from '@/integrations/supabase/client';

/**
 * Archive a conversation
 */
export const archiveConversation = async (conversationId: string, userId: string): Promise<void> => {
  console.log('[archiveConversation] Starting for conversation:', conversationId);
  
  try {
    const { error } = await supabase
      .from('conversations')
      .update({ archived: true })
      .eq('id', conversationId);

    if (error) {
      console.error('[archiveConversation] Error:', error);
      throw error;
    }

    console.log('[archiveConversation] Successfully archived conversation:', conversationId);
  } catch (error) {
    console.error('[archiveConversation] Failed:', error);
    throw error;
  }
};

/**
 * Unarchive a conversation
 */
export const unarchiveConversation = async (conversationId: string, userId: string): Promise<void> => {
  console.log('[unarchiveConversation] Starting for conversation:', conversationId);
  
  try {
    const { error } = await supabase
      .from('conversations')
      .update({ archived: false })
      .eq('id', conversationId);

    if (error) {
      console.error('[unarchiveConversation] Error:', error);
      throw error;
    }

    console.log('[unarchiveConversation] Successfully unarchived conversation:', conversationId);
  } catch (error) {
    console.error('[unarchiveConversation] Failed:', error);
    throw error;
  }
};

/**
 * Delete a conversation (soft delete)
 */
export const deleteConversation = async (conversationId: string, userId: string): Promise<void> => {
  console.log('[deleteConversation] Starting for conversation:', conversationId);
  
  try {
    const { error } = await supabase
      .from('conversations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) {
      console.error('[deleteConversation] Error:', error);
      throw error;
    }

    console.log('[deleteConversation] Successfully deleted conversation:', conversationId);
  } catch (error) {
    console.error('[deleteConversation] Failed:', error);
    throw error;
  }
};

/**
 * Restore a deleted conversation
 */
export const restoreConversation = async (conversationId: string, userId: string): Promise<void> => {
  console.log('[restoreConversation] Starting for conversation:', conversationId);
  
  try {
    const { error } = await supabase
      .from('conversations')
      .update({ deleted_at: null })
      .eq('id', conversationId);

    if (error) {
      console.error('[restoreConversation] Error:', error);
      throw error;
    }

    console.log('[restoreConversation] Successfully restored conversation:', conversationId);
  } catch (error) {
    console.error('[restoreConversation] Failed:', error);
    throw error;
  }
};