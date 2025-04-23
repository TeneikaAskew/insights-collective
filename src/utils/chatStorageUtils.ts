import { Message } from '@/components/assistants/types';
import { MAX_CHAT_MESSAGES, MAX_MESSAGE_SIZE } from '@/data/careerPathwayData';

/**
 * ChatStorageUtils provides utilities for managing chat message data
 * in localStorage, with specific focus on preventing quota errors.
 */
export class ChatStorageUtils {
  /**
   * Stores chat messages in localStorage with optimized storage management
   * to prevent quota exceeded errors.
   * 
   * @param key The localStorage key to use
   * @param messages The array of messages to store
   * @returns True if storage was successful, false otherwise
   */
  static storeMessages(key: string, messages: Message[]): boolean {
    try {
      if (!messages || messages.length === 0) {
        // Clear the storage if no messages
        localStorage.removeItem(key);
        return true;
      }
      
      // Step 1: Optimize storage by trimming messages
      let optimizedMessages = this.optimizeMessages(messages);
      
      try {
        // First attempt to store all messages
        localStorage.setItem(key, JSON.stringify(optimizedMessages));
        return true;
      } catch (storageError) {
        // If we get a quota error, try more aggressive optimization
        if (this.isQuotaError(storageError)) {
          console.warn('Storage quota exceeded on initial save, applying more aggressive optimization');
          
          // Try with half the maximum number of messages
          const reducedMessages = optimizedMessages.slice(
            Math.max(0, optimizedMessages.length - Math.floor(MAX_CHAT_MESSAGES / 2))
          );
          
          try {
            localStorage.setItem(key, JSON.stringify(reducedMessages));
            return true;
          } catch (reducedStorageError) {
            // Last attempt: keep only the latest 5 messages
            if (this.isQuotaError(reducedStorageError)) {
              const minimalMessages = optimizedMessages.slice(Math.max(0, optimizedMessages.length - 5));
              
              try {
                localStorage.setItem(key, JSON.stringify(minimalMessages));
                return true;
              } catch (finalStorageError) {
                console.error('Unable to store even minimal messages', finalStorageError);
                return false;
              }
            }
          }
        }
        
        console.error('Error storing messages:', storageError);
        return false;
      }
    } catch (error) {
      console.error('Error in storeMessages:', error);
      return false;
    }
  }
  
  /**
   * Loads chat messages from localStorage
   * 
   * @param key The localStorage key to use
   * @returns The array of messages, or null if not found or error
   */
  static loadMessages(key: string): Message[] | null {
    try {
      const storedData = localStorage.getItem(key);
      if (!storedData) return null;
      
      const parsedData = JSON.parse(storedData) as Message[];
      
      // Ensure parsed data is an array of messages
      if (!Array.isArray(parsedData)) {
        console.error('Stored chat data is not an array');
        return null;
      }
      
      return parsedData;
    } catch (error) {
      console.error('Error loading messages:', error);
      return null;
    }
  }
  
  /**
   * Optimize messages for storage by:
   * 1. Trimming the array to MAX_CHAT_MESSAGES
   * 2. Truncating content to MAX_MESSAGE_SIZE
   * 3. Simplifying message object structure
   * 
   * @param messages The messages to optimize
   * @returns Optimized message array
   */
  private static optimizeMessages(messages: Message[]): Message[] {
    // Keep only the last N messages
    let trimmedMessages = messages.length > MAX_CHAT_MESSAGES 
      ? messages.slice(messages.length - MAX_CHAT_MESSAGES) 
      : [...messages];
    
    // Optimize each message for storage
    return trimmedMessages.map(message => ({
      id: message.id,
      role: message.role,
      content: this.trimMessageContent(message.content),
      timestamp: message.timestamp
    }));
  }
  
  /**
   * Trim message content to maximum size
   * 
   * @param content The content to trim
   * @returns Trimmed content
   */
  private static trimMessageContent(content: string): string {
    if (content.length <= MAX_MESSAGE_SIZE) {
      return content;
    }
    
    // For long messages, keep the beginning and end
    const halfSize = Math.floor(MAX_MESSAGE_SIZE / 2);
    return content.substring(0, halfSize) + 
           "\n...\n[Content truncated due to storage limitations]\n...\n" + 
           content.substring(content.length - halfSize);
  }
  
  /**
   * Check if an error is a quota exceeded error
   */
  private static isQuotaError(error: any): boolean {
    return (
      error instanceof DOMException && 
      (
        error.name === 'QuotaExceededError' || 
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )
    );
  }
}
