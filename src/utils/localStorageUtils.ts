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
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Direct iteration through localStorage keys
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            items[key] = window.localStorage.getItem(key);
          }
        }
        
        // Double-check using Object.keys as a fallback
        Object.keys(window.localStorage).forEach(key => {
          if (!items[key]) {
            items[key] = window.localStorage.getItem(key);
          }
        });
      } catch (error) {
        console.error('Error accessing localStorage:', error);
      }
    }
    return items;
  }

  /**
   * Get all items from localStorage as an array
   */
  static getAllItemsAsArray(): LocalStorageItem[] {
    const items: LocalStorageItem[] = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Direct iteration through localStorage
        console.log(`Total localStorage items: ${window.localStorage.length}`);
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            items.push({
              key,
              value: window.localStorage.getItem(key)
            });
          }
        }
        
        // Verify if we found all items by comparing with Object.keys
        const objKeys = Object.keys(window.localStorage);
        console.log(`Items found via iteration: ${items.length}, via Object.keys: ${objKeys.length}`);
        
        // Add any keys we might have missed from Object.keys
        objKeys.forEach(key => {
          if (!items.some(item => item.key === key)) {
            items.push({
              key,
              value: window.localStorage.getItem(key)
            });
          }
        });
      } catch (error) {
        console.error('Error accessing localStorage:', error);
      }
    }
    return items;
  }

  /**
   * Find items that match a pattern
   */
  static findItems(pattern: string): LocalStorageMap {
    const matchingItems: LocalStorageMap = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.toLowerCase().includes(pattern.toLowerCase())) {
            matchingItems[key] = window.localStorage.getItem(key);
          }
        }
      } catch (error) {
        console.error('Error finding localStorage items:', error);
      }
    }
    return matchingItems;
  }

  /**
   * Get all resume-related items for a specific user
   */
  static getResumeItems(userId: string): LocalStorageMap {
    const resumeItems: LocalStorageMap = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.includes('resume') || key.includes(userId))) {
            resumeItems[key] = window.localStorage.getItem(key);
          }
        }
      } catch (error) {
        console.error('Error getting resume items:', error);
      }
    }
    return resumeItems;
  }

  /**
   * Clear all resume-related items for a specific user
   */
  static clearResumeItems(userId: string): void {
    console.log(`Clearing all resume items for user: ${userId}`);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && (key.includes('resume') || key.includes(userId))) {
            console.log(`Removing: ${key}`);
            window.localStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.error('Error clearing resume items:', error);
      }
    }
  }

  /**
   * Clear all items from localStorage that match any of the provided patterns
   */
  static clearItemsByPatterns(patterns: string[]): void {
    console.log(`Clearing all localStorage items matching patterns: ${patterns.join(', ')}`);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key) {
            const keyLower = key.toLowerCase();
            const shouldRemove = patterns.some(pattern => keyLower.includes(pattern.toLowerCase()));
            if (shouldRemove) {
              console.log(`Removing localStorage item: ${key}`);
              window.localStorage.removeItem(key);
            }
          }
        }
      } catch (error) {
        console.error('Error clearing items by patterns:', error);
      }
    }
  }

  /**
   * Clear specific job-related items from localStorage
   */
  static clearJobItems(): void {
    console.log('Clearing job-related items from localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      const jobKeys = [
        'job_description_url',
        'job_description_text',
        'job_analyzer_active_tab', 
        'job_analysis_result',
        'job_analyzer_use_filtering'
      ];
      
      try {
        jobKeys.forEach(key => {
          window.localStorage.removeItem(key);
          console.log(`Removed job-related key: ${key}`);
        });
      } catch (error) {
        console.error('Error clearing job items:', error);
      }
    }
  }

  /**
   * Save job study guide to localStorage
   */
  static saveStudyGuide(userId: string, studyGuide: any): void {
    console.log('Saving study guide to localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`study_guide_${userId}`, JSON.stringify(studyGuide));
        console.log('Study guide saved to localStorage');
      } catch (error) {
        console.error('Error saving study guide to localStorage:', error);
      }
    }
  }

  /**
   * Get job study guide from localStorage
   */
  static getStudyGuide(userId: string): any {
    console.log('Getting study guide from localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const studyGuide = window.localStorage.getItem(`study_guide_${userId}`);
        return studyGuide ? JSON.parse(studyGuide) : null;
      } catch (error) {
        console.error('Error getting study guide from localStorage:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Save STAR responses to localStorage
   */
  static saveStarResponses(userId: string, responses: any[]): void {
    console.log('Saving STAR responses to localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`star_responses_${userId}`, JSON.stringify(responses));
        console.log('STAR responses saved to localStorage');
      } catch (error) {
        console.error('Error saving STAR responses to localStorage:', error);
      }
    }
  }

  /**
   * Get STAR responses from localStorage
   */
  static getStarResponses(userId: string): any[] {
    console.log('Getting STAR responses from localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const responses = window.localStorage.getItem(`star_responses_${userId}`);
        return responses ? JSON.parse(responses) : [];
      } catch (error) {
        console.error('Error getting STAR responses from localStorage:', error);
        return [];
      }
    }
    return [];
  }

  /**
   * Add a single STAR response to localStorage
   */
  static addStarResponse(userId: string, response: any): void {
    console.log('Adding STAR response to localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const responses = this.getStarResponses(userId);
        responses.unshift(response); // Add new response at the beginning
        this.saveStarResponses(userId, responses);
        console.log('STAR response added to localStorage');
      } catch (error) {
        console.error('Error adding STAR response to localStorage:', error);
      }
    }
  }

  /**
   * Print all items to console
   */
  static logAllItems(): void {
    console.log('=== All localStorage items ===');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            const value = window.localStorage.getItem(key);
            console.log(`${key}: ${value}`);
          }
        }
        console.log(`Total localStorage items: ${window.localStorage.length}`);
        console.log('Direct object keys:', Object.keys(window.localStorage));
      } catch (error) {
        console.error('Error logging localStorage items:', error);
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
   * Create a test item in localStorage
   */
  static createTestItem(prefix: string = 'test'): string {
    const timestamp = new Date().getTime();
    const key = `${prefix}_${timestamp}`;
    const value = `Test value created at ${new Date().toISOString()}`;
    
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
        console.log(`Test item created: ${key}`);
      } catch (error) {
        console.error('Error creating test item:', error);
      }
    }
    
    return key;
  }
  
  /**
   * Dump all localStorage items to browser console
   */
  static dumpToConsole(): void {
    console.group('LocalStorage Dump');
    console.log('Full localStorage object:', window.localStorage);
    console.log('Total items:', window.localStorage.length);
    
    // Group items by prefix/category for easier reading
    const categorized: Record<string, LocalStorageMap> = {
      'resume': {},
      'job': {},
      'auth': {},
      'preferences': {},
      'other': {}
    };
    
    const allItems = this.getAllItems();
    
    Object.entries(allItems).forEach(([key, value]) => {
      if (key.includes('resume')) {
        categorized.resume[key] = value;
      } else if (key.includes('job')) {
        categorized.job[key] = value;
      } else if (key.includes('auth') || key.includes('supabase')) {
        categorized.auth[key] = value;
      } else if (key.includes('pref') || key.includes('setting')) {
        categorized.preferences[key] = value;
      } else {
        categorized.other[key] = value;
      }
    });
    
    console.log('Categorized localStorage items:', categorized);
    console.groupEnd();
  }
}
