
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import { useToast } from '@/hooks/use-toast';
import { Lock, Key, Unlock, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const LocalStorageDebugPage: React.FC = () => {
  const [items, setItems] = useState<{ key: string; value: string | null }[]>([]);
  const [passcode, setPasscode] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTokenLoading, setIsTokenLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  useEffect(() => {
    const autoAuthenticate = async () => {
      setIsLoading(true);
      try {
        // Only proceed if user is admin
        if (!user?.roles?.includes('admin')) {
          setIsLoading(false);
          return;
        }
        
        // Get the debugging token from Supabase edge function
        const { data, error } = await supabase.functions.invoke('get-debug-token');
        
        if (error) {
          console.error('Error fetching debug token:', error);
          setIsLoading(false);
          return;
        }
        
        // Auto-authenticate if token is retrieved successfully
        if (data && data.token) {
          setIsAuthenticated(true);
          refreshItems();
          toast({
            title: "Access granted",
            description: "You have been authenticated automatically.",
            variant: "default"
          });
        }
      } catch (error) {
        console.error('Error during auto-authentication:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    autoAuthenticate();
  }, [user, toast]);

  const authenticate = async () => {
    setIsTokenLoading(true);
    
    try {
      // Get the debugging token from Supabase edge function
      const { data, error } = await supabase.functions.invoke('get-debug-token');
      
      if (error) {
        throw error;
      }
      
      const correctToken = data.token;
      
      // Compare the entered token with the correct one
      if (passcode === correctToken) {
        setIsAuthenticated(true);
        toast({
          title: "Access granted",
          description: "You have been authenticated to access debug tools.",
          variant: "default"
        });
        refreshItems();
      } else {
        toast({
          title: "Access denied",
          description: "The passcode you entered is incorrect.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error authenticating:', error);
      toast({
        title: "Authentication error",
        description: "Could not verify passcode. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTokenLoading(false);
    }
  };

  const refreshItems = () => {
    const allItems = LocalStorageUtils.getAllItemsAsArray();
    setItems(allItems);
  };

  const clearResumeData = () => {
    const userId = user?.id || '47cf8181-c9a4-4cb9-8aa4-d6967e128c36';
    LocalStorageUtils.clearResumeItems(userId);
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

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-primary mx-auto animate-pulse mb-4" />
          <h2 className="text-2xl font-bold mb-2">Verifying credentials...</h2>
          <p className="text-muted-foreground">Please wait while we verify your access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      {!isAuthenticated ? (
        <Card className="border shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Secure Debugging Tools
            </CardTitle>
            <CardDescription>
              This page contains sensitive debugging tools and requires authentication.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="passcode">Enter debug passcode</Label>
                <div className="flex gap-2">
                  <Input
                    id="passcode"
                    type="password"
                    placeholder="Enter debug token"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={authenticate} disabled={isTokenLoading}>
                    {isTokenLoading ? (
                      "Verifying..."
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-2" />
                        Verify
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Lock className="h-4 w-4 mr-2" />
              Access restricted to authorized personnel
            </div>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">LocalStorage Debug</h2>
              <p className="text-sm text-muted-foreground">View and manage localStorage data</p>
            </div>
            <div className="flex items-center gap-2">
              <Unlock className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">Authenticated</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <Button onClick={refreshItems} variant="secondary">
              Refresh
            </Button>
            <Button onClick={clearResumeData} variant="destructive">
              Clear Resume Data
            </Button>
            <Button onClick={clearAllResumeAndJobData} variant="destructive">
              Clear All Resume/Job Data
            </Button>
            <Button onClick={exportData} variant="outline">
              Export JSON
            </Button>
          </div>

          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Storage Contents</CardTitle>
              <CardDescription>{items.length} items found in localStorage</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-auto">
              <div className="space-y-2">
                {items.map(({ key, value }) => (
                  <div key={key} className="text-sm break-all border-b pb-2 last:border-0">
                    <strong className="font-medium text-primary">{key}:</strong>{" "}
                    <span className="text-muted-foreground">
                      {value ? value.substring(0, 100) : 'null'}
                      {value && value.length > 100 ? '...' : ''}
                    </span>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-sm text-muted-foreground">No items found in localStorage</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LocalStorageDebugPage;
