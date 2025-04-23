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
}

// Usage in your React component or hook:
import { LocalStorageUtils } from './localStorageUtils';

// In your deleteResume function:
const deleteResume = async (): Promise<boolean> => {
  if (!user) {
    console.error("Cannot delete: missing user");
    return false;
  }

  try {
    console.log(`=== RESUME DELETION STARTED ===`);
    console.log(`User ID: ${user.id}`);
    
    // View current localStorage state
    LocalStorageUtils.logAllItems();
    
    // Clear all resume items for this user
    LocalStorageUtils.clearResumeItems(user.id);
    
    // ... rest of your delete code
  } catch (error) {
    // ... error handling
  }
};

// Debug function you can attach to a button or use in console
export const debugLocalStorage = () => {
  const allItems = LocalStorageUtils.getAllItems();
  console.log('All localStorage items:', allItems);
  
  const resumeItems = LocalStorageUtils.findItems('resume');
  console.log('Resume-related items:', resumeItems);
};

// React hook for localStorage debugging
export const useLocalStorageDebug = () => {
  const viewAll = () => {
    LocalStorageUtils.logAllItems();
  };

  const clearUserData = (userId: string) => {
    LocalStorageUtils.clearResumeItems(userId);
  };

  const exportData = () => {
    const data = LocalStorageUtils.exportToJSON();
    console.log('localStorage data:', data);
    return data;
  };

  return { viewAll, clearUserData, exportData };
};
