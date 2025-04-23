// localStorageUtils.ts

interface LocalStorageItem {
  key: string;
  value: string | null;
}

interface LocalStorageMap {
  [key: string]: string | null;
}

export class LocalStorageUtils {
  /**
   * Get all items from localStorage as an object
   */
  static getAllItems(): LocalStorageMap {
    const items: LocalStorageMap = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        items[key] = localStorage.getItem(key);
      }
    }
    return items;
  }

  /**
   * Get all items from localStorage as an array
   */
  static getAllItemsAsArray(): LocalStorageItem[] {
    const items: LocalStorageItem[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        items.push({
          key,
          value: localStorage.getItem(key)
        });
      }
    }
    return items;
  }

  /**
   * Find items that match a pattern
   */
  static findItems(pattern: string): LocalStorageMap {
    const matchingItems: LocalStorageMap = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes(pattern)) {
        matchingItems[key] = localStorage.getItem(key);
      }
    }
    return matchingItems;
  }

  /**
   * Get all resume-related items for a specific user
   */
  static getResumeItems(userId: string): LocalStorageMap {
    const resumeItems: LocalStorageMap = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('resume') || key.includes(userId))) {
        resumeItems[key] = localStorage.getItem(key);
      }
    }
    return resumeItems;
  }

  /**
   * Clear all resume-related items for a specific user
   */
  static clearResumeItems(userId: string): void {
    console.log(`Clearing all resume items for user: ${userId}`);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.includes('resume') || key.includes(userId))) {
        console.log(`Removing: ${key}`);
        localStorage.removeItem(key);
      }
    }
  }

  /**
   * Print all items to console
   */
  static logAllItems(): void {
    console.log('=== All localStorage items ===');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        console.log(`${key}: ${value}`);
      }
    }
    console.log('==============================');
  }

  /**
   * Export all items as JSON
   */
  static exportToJSON(): string {
    return JSON.stringify(this.getAllItems(), null, 2);
  }

  /**
   * Safely store data in localStorage with size checking
   * Returns true if storage succeeded, false if it failed
   */
  static safelyStoreItem(key: string, value: string): boolean {
    try {
      // Check if setting this value would exceed quota
      // First, remove the old value to free up space
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
      
      // Try setting the item
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Error storing item ${key} in localStorage:`, error);
      
      if (error instanceof DOMException && (
        error.name === 'QuotaExceededError' || 
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        console.warn('Storage quota exceeded, attempting to free space and store truncated data');
        return this.handleQuotaExceededError(key, value);
      }
      
      return false;
    }
  }
  
  /**
   * Handle quota exceeded error by trying various strategies
   */
  private static handleQuotaExceededError(key: string, value: string): boolean {
    try {
      // Try to free up space by removing older items
      this.clearOldItems();
      
      // Try to store a truncated version of the data
      if (value.length > 10000) {
        // If it's a JSON string, try to parse, truncate and reserialize
        try {
          const data = JSON.parse(value);
          
          // Special handling for chat data
          if (Array.isArray(data) && key.includes('Chat')) {
            // Keep only the most recent 20 messages
            const truncatedData = data.slice(-20);
            localStorage.setItem(key, JSON.stringify(truncatedData));
            return true;
          }
          
          // Generic object truncation
          const truncatedJson = this.truncateJsonObject(data);
          localStorage.setItem(key, JSON.stringify(truncatedJson));
          return true;
        } catch (parseError) {
          // Not JSON, just truncate the string
          const truncated = value.substring(0, 5000) + "... [truncated due to storage limitations]";
          localStorage.setItem(key, truncated);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Failed to handle quota error:', error);
      return false;
    }
  }
  
  /**
   * Clear old or less important items to make space
   */
  private static clearOldItems(): void {
    // Items that can be safely removed when space is needed
    const lowPriorityPrefixes = [
      'temp',
      'cache',
      'draft',
      'history',
      'log'
    ];
    
    // First try to remove low priority items
    for (const prefix of lowPriorityPrefixes) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.toLowerCase().startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      }
    }
  }
  
  /**
   * Truncate large JSON objects to reduce size
   */
  private static truncateJsonObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      // If array is too large, keep only first and last few items
      if (obj.length > 20) {
        return [
          ...obj.slice(0, 10),
          { truncated: `${obj.length - 20} items removed due to storage limitations` },
          ...obj.slice(-10)
        ];
      }
      
      // Otherwise process each array item
      return obj.map(item => this.truncateJsonObject(item));
    }
    
    // Handle objects
    const result: Record<string, any> = {};
    const keys = Object.keys(obj);
    
    // Process each property
    for (const key of keys) {
      const value = obj[key];
      
      // Truncate long string values
      if (typeof value === 'string' && value.length > 500) {
        result[key] = value.substring(0, 500) + '... [truncated]';
      } 
      // Recursively process nested objects
      else if (typeof value === 'object' && value !== null) {
        result[key] = this.truncateJsonObject(value);
      } 
      // Keep other values as is
      else {
        result[key] = value;
      }
    }
    
    return result;
  }
}
