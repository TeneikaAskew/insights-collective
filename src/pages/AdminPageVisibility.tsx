
import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Info, 
  Shield, 
  CheckCircle, 
  UserCheck,
  Users,
  RefreshCw,
  AlertCircle,
  Database
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

import { createLogger } from '@/utils/logger';

const logger = createLogger('AdminPageVisibility');

const AdminPageVisibility = () => {
  const { pageVisibility, isLoading, updatePageVisibility, syncAvailablePages, isSyncing } = usePageVisibility();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hasSynced, setHasSynced] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Log user role information on component load
  useEffect(() => {
    logger.log('Current user in AdminPageVisibility:', user);
    logger.log('User roles:', user?.roles);
    logger.log('User metadata:', user?.user_metadata);
    logger.log('Current page visibility data:', pageVisibility);
    
    // If no data is loaded initially, trigger a sync
    if (pageVisibility.length === 0 && !isLoading && !isSyncing && !hasSynced) {
      logger.log('No page visibility data found, triggering initial sync');
      handleSyncPages();
    }
  }, [user, pageVisibility, isLoading, isSyncing, hasSynced]);

  const filteredPages = pageVisibility.filter(page => 
    page.page_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.page_path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVisibilityChange = async (id: string, field: 'visible_to_users' | 'visible_to_instructors', value: boolean) => {
    try {
      setErrorMessage(null);
      setUpdating(prev => ({ ...prev, [id + field]: true }));
      await updatePageVisibility(id, { [field]: value });
      
      toast({
        title: "Visibility updated",
        description: "The page visibility settings have been updated successfully.",
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to update visibility: ${errorMsg}`);
      toast({
        title: "Update failed",
        description: "There was an error updating the page visibility.",
        variant: "destructive",
      });
      logger.error("Failed to update visibility:", error);
    } finally {
      setUpdating(prev => ({ ...prev, [id + field]: false }));
    }
  };

  const handleSyncPages = async () => {
    try {
      setErrorMessage(null);
      setSyncStatus('idle');
      logger.log("Starting page sync...");
      await syncAvailablePages();
      setHasSynced(true);

      setSyncStatus('success');
      // No page-level success toast here: syncAvailablePages itself reports
      // the real per-page outcome (success / partial / failed) — an
      // unconditional "All pages synced" toast on top of it could contradict
      // a partial failure.
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to sync pages: ${errorMsg}`);
      setSyncStatus('error');
      // Mark the auto-sync as attempted even on failure — otherwise the
      // effect above re-fires forever, looping destructive "Sync failed"
      // toasts. The admin can still retry via the Sync button.
      setHasSynced(true);
      toast({
        title: "Sync failed",
        description: "There was an error syncing the page visibility.",
        variant: "destructive",
      });
      logger.error("Failed to sync pages:", error);
    }
  };

  const manualCheckDatabase = async () => {
    try {
      setErrorMessage(null);
      logger.log("Manually checking database content");
      const { data, error } = await supabase.from('page_visibility').select('*');
      
      if (error) {
        setErrorMessage(`Database query error: ${error.message}`);
        logger.error("Database query error:", error);
        toast({
          title: "Database query error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      logger.log("Database page_visibility records:", data);
      toast({
        title: "Database checked",
        description: `Found ${data?.length || 0} page visibility records.`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMessage(`Error checking database: ${errorMsg}`);
      logger.error("Error checking database:", err);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Page Visibility Manager</h1>
          <p className="text-muted-foreground">
            Control which pages are visible to different user roles across the platform.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Page Visibility Settings</CardTitle>
                <CardDescription>
                  <strong>All Users</strong> = visible to every signed-in user (students and instructors). 
                  <strong>Instructors</strong> = instructor-only access when "All Users" is off. 
                  Admins always see all pages regardless of these settings.
                </CardDescription>
              </div>
              <div className="flex flex-col md:flex-row gap-2 items-end">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search pages..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleSyncPages} 
                  disabled={isSyncing}
                  className={`whitespace-nowrap ${syncStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : syncStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Pages'}
                </Button>
                <Button 
                  onClick={manualCheckDatabase} 
                  variant="outline" 
                  size="sm"
                  className="flex"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Check DB
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-md border border-red-200">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
                  <p className="font-medium">Error</p>
                </div>
                <p className="mt-1 text-sm">{errorMessage}</p>
              </div>
            )}
            
            {pageVisibility.length === 0 && !isLoading && !isSyncing ? (
              <div className="p-8 text-center">
                <div className="mb-4">
                  <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
                </div>
                <h3 className="text-xl font-medium mb-2">No pages found</h3>
                <p className="text-muted-foreground mb-4">
                  There are no pages configured in the visibility system. Click "Sync Pages" to detect all available pages in the application.
                </p>
                <Button onClick={handleSyncPages}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Pages
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Page</TableHead>
                      <TableHead className="w-[150px]">Path</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center">
                          <Users className="h-4 w-4 mr-2" />
                          <span>All Users</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center">
                          <UserCheck className="h-4 w-4 mr-2" />
                          <span>Instructors</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center">
                          <Shield className="h-4 w-4 mr-2" />
                          <span>Admins</span>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading || isSyncing ? (
                      // Skeleton loader when data is loading
                      Array.from({ length: 6 }).map((_, index) => (
                        <TableRow key={`skeleton-${index}`}>
                          <TableCell>
                            <Skeleton className="h-4 w-[250px]" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-[100px]" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-6 w-10 mx-auto" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-6 w-10 mx-auto" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-6 w-10 mx-auto" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredPages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                          No pages match your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPages.map((page) => (
                        <TableRow key={page.id}>
                          <TableCell className="font-medium">
                            {page.page_name}
                            {page.page_path.includes(':') && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Info className="h-4 w-4 inline ml-2 text-muted-foreground" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Dynamic route with parameters</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <Button 
                              variant="link" 
                              className="p-0 h-auto font-mono text-xs text-blue-600 hover:text-blue-800"
                              asChild
                            >
                              <a href={page.page_path} target="_blank" rel="noopener noreferrer">
                                {page.page_path}
                              </a>
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={page.visible_to_users}
                                disabled={updating[page.id + 'visible_to_users']}
                                onCheckedChange={(checked) => 
                                  handleVisibilityChange(page.id, 'visible_to_users', checked)
                                }
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={page.visible_to_instructors}
                                disabled={updating[page.id + 'visible_to_instructors']}
                                onCheckedChange={(checked) => 
                                  handleVisibilityChange(page.id, 'visible_to_instructors', checked)
                                }
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Always
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="mt-4 text-sm text-muted-foreground">
              <p>
                <strong>Notes:</strong> Pages not visible to a user role will show a "Coming Soon" overlay. 
                Admin users will always have access to all pages regardless of these settings.
                Click "Sync Pages" to detect newly added pages in the application.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminPageVisibility;
