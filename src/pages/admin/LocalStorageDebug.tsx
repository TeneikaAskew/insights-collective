// ABOUTME: Admin-only debug page for inspecting and managing browser localStorage data.
// ABOUTME: Provides search, filter, export, and test-item creation for localStorage entries.

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import { useToast } from '@/hooks/use-toast';
import { 
  Unlock, RefreshCw, ChevronDown, ChevronUp, 
  Search, Copy, FileText, Filter, Download, Plus, Trash 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('refreshItems');

const LocalStorageDebugPage: React.FC = () => {
  const [items, setItems] = useState<{ key: string; value: string | null }[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [testKey, setTestKey] = useState<string>('');
  
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const searchRef = useRef<HTMLInputElement>(null);

  const refreshItems = () => {
    setIsRefreshing(true);
    try {
      logger.log('Refreshing localStorage items...');
      
      // Log all items to console first
      LocalStorageUtils.logAllItems();
      
      // Get items as array
      const allItems = LocalStorageUtils.getAllItemsAsArray();
      logger.log(`Found ${allItems.length} items in localStorage`);
      
      // Debug each localStorage key-value pair
      allItems.forEach(item => {
        logger.log(`LocalStorage item - Key: ${item.key}, Value length: ${item.value?.length || 0}`);
      });
      
      setItems(allItems);
      
      toast({
        title: "Refreshed",
        description: `${allItems.length} items loaded from localStorage`,
        variant: "default"
      });
    } catch (error) {
      logger.error('Error refreshing items:', error);
      toast({
        title: "Refresh error",
        description: "Could not refresh localStorage items",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleItemExpand = (key: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const clearResumeData = () => {
    if (!user?.id) {
      toast({
        title: "No user session",
        description: "Cannot clear resume data without an authenticated user.",
        variant: "destructive"
      });
      return;
    }
    LocalStorageUtils.clearResumeItems(user.id);
    refreshItems();
    toast({
      title: "Resume data cleared",
      description: "All resume data has been removed from local storage.",
      variant: "default"
    });
  };
  
  const clearAllResumeAndJobData = () => {
    LocalStorageUtils.clearItemsByPatterns(['resume', 'analysis', 'job']);
    LocalStorageUtils.clearJobItems();
    refreshItems();
    toast({
      title: "Data cleared",
      description: "All resume and job data has been removed from local storage.",
      variant: "default"
    });
  };

  const exportData = () => {
    const data = LocalStorageUtils.exportToJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'localStorage-data.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Data exported",
      description: "Local storage data has been exported to a JSON file.",
      variant: "default"
    });
  };
  
  const dumpToConsole = () => {
    LocalStorageUtils.dumpToConsole();
    toast({
      title: "Data dumped to console",
      description: "Local storage data has been logged to the browser console.",
      variant: "default"
    });
  };
  
  const createTestItem = () => {
    const key = LocalStorageUtils.createTestItem();
    setTestKey(key);
    refreshItems();
    toast({
      title: "Test item created",
      description: `Created test item with key: ${key}`,
      variant: "default"
    });
  };
  
  const removeTestItem = () => {
    if (testKey) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(testKey);
        toast({
          title: "Test item removed",
          description: `Removed test item with key: ${testKey}`,
          variant: "default"
        });
        setTestKey('');
        refreshItems();
      }
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Value copied to clipboard",
      variant: "default"
    });
  };

  // Filter and search functionality
  const getFilteredItems = () => {
    let filteredItems = [...items];
    
    // Apply category filter
    if (filterCategory !== 'all') {
      filteredItems = filteredItems.filter(item => 
        item.key.toLowerCase().includes(filterCategory.toLowerCase())
      );
    }
    
    // Apply search term filter
    if (searchTerm.trim()) {
      filteredItems = filteredItems.filter(item => 
        item.key.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.value && item.value.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    return filteredItems;
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">LocalStorage Debug</h2>
            <p className="text-sm text-muted-foreground">View and manage localStorage data</p>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Unlock className="h-4 w-4 text-ss-good" />
                <span className="text-sm font-medium text-ss-good">
                  {user?.email ? `Authenticated — ${user.email}` : 'Authenticated'}
                </span>
              </>
            ) : (
              <span className="text-sm font-medium text-destructive">Not authenticated</span>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button onClick={refreshItems} variant="secondary" disabled={isRefreshing}>
            {isRefreshing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
          <Button onClick={dumpToConsole} variant="secondary">
            <FileText className="h-4 w-4 mr-2" />
            Dump to Console
          </Button>
          <Button onClick={clearResumeData} variant="destructive">
            Clear Resume Data
          </Button>
          <Button onClick={clearAllResumeAndJobData} variant="destructive">
            Clear All Resume/Job Data
          </Button>
          <Button onClick={exportData} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
        
        {/* Test item creation section */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Test LocalStorage Access</CardTitle>
            <CardDescription>Create test items to verify localStorage access</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Button onClick={createTestItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Test Item
              </Button>
              {testKey && (
                <Button onClick={removeTestItem} variant="outline" size="sm">
                  <Trash className="h-4 w-4 mr-2" />
                  Remove Test Item
                </Button>
              )}
            </div>
            {testKey && (
              <div className="text-sm bg-secondary/20 p-2 rounded">
                <strong>Test key created:</strong> {testKey}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Search and filter */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search keys or values..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                className="bg-background border rounded px-2 py-2 text-sm outline-none"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All items</option>
                <option value="resume">Resume items</option>
                <option value="job">Job items</option>
                <option value="auth">Auth items</option>
                <option value="test">Test items</option>
              </select>
            </div>
          </div>
        </div>

        {/* LocalStorage data display */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Storage Contents</CardTitle>
            <CardDescription>
              {getFilteredItems().length} of {items.length} items shown
              {searchTerm && ` (filtered by "${searchTerm}")`}
              {filterCategory !== 'all' && ` in category "${filterCategory}"`}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-auto">
            <div className="space-y-2">
              {getFilteredItems().map(({ key, value }) => (
                <div 
                  key={key} 
                  className={`text-sm break-all border-b pb-2 last:border-0 ${
                    testKey === key ? 'bg-green-100/10 border-green-200' : ''
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <strong className="font-medium text-primary">{key}:</strong>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard(value || '')}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleItemExpand(key)}
                        className="h-6 w-6 p-0"
                      >
                        {expandedItems[key] ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="text-muted-foreground">
                    {!expandedItems[key] ? (
                      <div className="flex items-center justify-between">
                        <div>
                          {value ? value.substring(0, 100) : 'null'}
                          {value && value.length > 100 ? '...' : ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {value ? `${value.length} chars` : '0 chars'}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 p-2 bg-secondary/20 rounded whitespace-pre-wrap">
                        {value ? value : 'null'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {getFilteredItems().length === 0 && items.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  No items match your search criteria.
                </div>
              )}
              {items.length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  <div className="mb-2">No items found in localStorage</div>
                  <Button onClick={createTestItem} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Test Item to Verify Storage Access
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Browser storage context info */}
        <div className="bg-secondary/10 p-4 rounded-md text-sm">
          <h3 className="font-medium mb-2">Storage Context Information</h3>
          <div className="space-y-1">
            <p>• Current URL: {typeof window !== 'undefined' ? window.location.href : 'Unknown'}</p>
            <p>• Domain: {typeof window !== 'undefined' ? window.location.hostname : 'Unknown'}</p>
            <p>• Storage access status: {typeof window !== 'undefined' && window.localStorage ? 'Available' : 'Restricted'}</p>
            <p>• Environment: {import.meta.env.MODE}</p>
            <p>• Total localStorage items detected: {items.length}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LocalStorageDebugPage;
