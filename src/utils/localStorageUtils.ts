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
    // Ensure we're accessing the browser's localStorage object
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          items.push({
            key,
            value: localStorage.getItem(key)
          });
        }
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
   * Clear all items from localStorage that match any of the provided patterns
   */
  static clearItemsByPatterns(patterns: string[]): void {
    console.log(`Clearing all localStorage items matching patterns: ${patterns.join(', ')}`);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key) {
        const keyLower = key.toLowerCase();
        const shouldRemove = patterns.some(pattern => keyLower.includes(pattern.toLowerCase()));
        if (shouldRemove) {
          console.log(`Removing localStorage item: ${key}`);
          localStorage.removeItem(key);
        }
      }
    }
  }

  /**
   * Clear specific job-related items from localStorage
   */
  static clearJobItems(): void {
    console.log('Clearing job-related items from localStorage');
    const jobKeys = [
      'job_description_url',
      'job_description_text',
      'job_analyzer_active_tab', 
      'job_analysis_result',
      'job_analyzer_use_filtering'
    ];
    
    jobKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`Removed job-related key: ${key}`);
    });
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
