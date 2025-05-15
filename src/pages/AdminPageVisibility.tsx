
import { useState } from 'react';
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
  Eye,
  EyeOff,
  UsersRound
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { UserPresence } from '@/components/common/UserPresence';

const AdminPageVisibility = () => {
  const { pageVisibility, isLoading, updatePageVisibility, syncAvailablePages, activeUsers } = usePageVisibility();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [showSystemPages, setShowSystemPages] = useState(false);

  const filteredPages = pageVisibility.filter(page => {
    // Filter by search query
    const matchesSearch = 
      page.page_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.page_path.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter system pages (those starting with /admin) unless showSystemPages is true
    const isSystemPage = page.page_path.startsWith('/admin');
    
    return matchesSearch && (showSystemPages || !isSystemPage);
  });

  const handleVisibilityChange = async (id: string, field: 'visible_to_users' | 'visible_to_instructors', value: boolean) => {
    try {
      setUpdating(prev => ({ ...prev, [id + field]: true }));
      await updatePageVisibility(id, { [field]: value });
      
      toast({
        title: "Visibility updated",
        description: "The page visibility settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "There was an error updating the page visibility.",
        variant: "destructive",
      });
      console.error("Failed to update visibility:", error);
    } finally {
      setUpdating(prev => ({ ...prev, [id + field]: false }));
    }
  };

  const handleSyncPages = async () => {
    try {
      setSyncing(true);
      await syncAvailablePages();
      
      toast({
        title: "Pages synced",
        description: "All available pages have been synced with the visibility settings.",
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "There was an error syncing the page visibility.",
        variant: "destructive",
      });
      console.error("Failed to sync pages:", error);
    } finally {
      setSyncing(false);
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
                <CardTitle>Active Users</CardTitle>
                <CardDescription>
                  Users currently online in the application
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-4">
              <div className="flex items-center space-x-4">
                <UsersRound className="h-6 w-6 text-muted-foreground" />
                <div className="text-sm">
                  <span className="font-medium">{activeUsers.length}</span> {activeUsers.length === 1 ? 'user' : 'users'} online
                </div>
                <UserPresence />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Page Visibility Settings</CardTitle>
                <CardDescription>
                  Configure which user roles can access each page in the application.
                </CardDescription>
              </div>
              <div className="flex flex-col md:flex-row gap-2 items-start md:items-end">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search pages..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowSystemPages(!showSystemPages)}
                    className="relative"
                  >
                    {showSystemPages ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    <span className="sr-only">{showSystemPages ? 'Hide' : 'Show'} system pages</span>
                    <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${showSystemPages ? 'bg-primary' : 'bg-muted-foreground'} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${showSystemPages ? 'bg-primary' : 'bg-muted-foreground'}`}></span>
                    </span>
                  </Button>
                  <Button 
                    onClick={handleSyncPages} 
                    disabled={syncing}
                    className="whitespace-nowrap"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Pages'}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                  {isLoading ? (
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
                          {page.page_path.startsWith('/admin') && (
                            <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200">
                              Admin
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {page.page_path}
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
