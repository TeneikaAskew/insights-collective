
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForumThreads } from '@/hooks/useForums';
import { MessageSquare, Clock, Pin, Lock, Plus, List, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Forum, Thread, ForumViewType } from '@/types/forum';
import { useAuth } from '@/contexts/AuthContext';
import NewThreadDialog from './NewThreadDialog';

interface ThreadListProps {
  forum: Forum;
  courseName?: string;
}

const ThreadList: React.FC<ThreadListProps> = ({ forum, courseName }) => {
  const { courseId } = useParams<{ courseId: string }>();
  const { threads, isLoadingThreads } = useForumThreads(forum.id);
  const [viewType, setViewType] = useState<ForumViewType>('list');
  const [selectedThreads, setSelectedThreads] = useState<string[]>([]);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const { user } = useAuth();
  
  const handleCheckThread = (threadId: string, checked: boolean) => {
    if (checked) {
      setSelectedThreads([...selectedThreads, threadId]);
    } else {
      setSelectedThreads(selectedThreads.filter(id => id !== threadId));
    }
  };
  
  const handleSelectAll = (checked: boolean) => {
    if (checked && threads) {
      setSelectedThreads(threads.map(thread => thread.id));
    } else {
      setSelectedThreads([]);
    }
  };
  
  const handleMarkAsRead = () => {
    // TODO: Implement mark as read functionality
    setSelectedThreads([]);
  };
  
  if (isLoadingThreads) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/courses">
              Courses
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to={`/courses/${courseId}`}>
              {courseName || 'Course Details'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to={`/courses/${courseId}/forums`}>
              Forums
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{forum.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      <div className="bg-card rounded-lg border shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">{forum.title}</h2>
            <p className="text-muted-foreground">{forum.description}</p>
          </div>
          {forum.allow_create_threads && user && (
            <Button onClick={() => setNewThreadOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Thread
            </Button>
          )}
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {selectedThreads.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Thread Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleMarkAsRead}>
                    Mark as Read
                  </DropdownMenuItem>
                  <DropdownMenuItem>Subscribe</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            
            {forum.allow_email_subscription && (
              <Button variant="outline" size="sm">
                Subscribe to Forum
              </Button>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={viewType === 'list' ? 'secondary' : 'outline'}
              size="icon"
              onClick={() => setViewType('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewType === 'tree' ? 'secondary' : 'outline'}
              size="icon"
              onClick={() => setViewType('tree')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {threads && threads.length > 0 ? (
          <div>
            {viewType === 'list' ? (
              <div className="border rounded-md">
                <div className="bg-muted/50 py-2 px-4 flex items-center text-sm font-medium">
                  <div className="w-6">
                    <Checkbox 
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      checked={selectedThreads.length === threads.length && threads.length > 0}
                    />
                  </div>
                  <div className="flex-1 pl-2">Thread</div>
                  <div className="w-[120px] text-center">Replies</div>
                  <div className="w-[200px] text-right">Last Post</div>
                </div>
                
                {threads.map((thread) => (
                  <div key={thread.id} className="border-t py-2 px-4 flex items-center hover:bg-muted/30">
                    <div className="w-6">
                      <Checkbox 
                        onCheckedChange={(checked) => handleCheckThread(thread.id, !!checked)}
                        checked={selectedThreads.includes(thread.id)}
                      />
                    </div>
                    <div className="flex-1 pl-2">
                      <div className="flex items-center space-x-2">
                        {thread.is_pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
                        {thread.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        <Link 
                          to={`/courses/${courseId}/forums/${forum.id}/threads/${thread.id}`}
                          className={`hover:underline ${thread.is_read ? '' : 'font-bold'}`}
                        >
                          {thread.title}
                        </Link>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground flex items-center">
                        <div className="flex items-center">
                          <Avatar className="h-5 w-5 mr-1">
                            <AvatarImage src={thread.author?.avatar_url || ''} />
                            <AvatarFallback>
                              {thread.author ? 
                                `${thread.author.first_name?.[0] || ''}${thread.author.last_name?.[0] || ''}` : 
                                'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {thread.author ? 
                              `${thread.author.first_name || ''} ${thread.author.last_name || ''}` : 
                              'Unknown User'}
                          </span>
                        </div>
                        <span className="mx-2">•</span>
                        <Clock className="h-3 w-3 mr-1" />
                        <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="w-[120px] text-center">
                      <Badge variant="outline">{thread.post_count || 0}</Badge>
                    </div>
                    <div className="w-[200px] text-right text-sm">
                      {thread.last_post ? (
                        <>
                          <div>{new Date(thread.last_post.created_at).toLocaleDateString()}</div>
                          <div className="text-muted-foreground">
                            by {thread.last_post.user_id?.first_name} {thread.last_post.user_id?.last_name}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No replies yet</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {threads.map((thread) => (
                  <Card key={thread.id} className={thread.is_read ? '' : 'border-primary'}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <div className="space-x-2 flex items-center">
                          <Checkbox 
                            onCheckedChange={(checked) => handleCheckThread(thread.id, !!checked)}
                            checked={selectedThreads.includes(thread.id)}
                          />
                          {thread.is_pinned && (
                            <Badge variant="outline" className="gap-1">
                              <Pin className="h-3 w-3" /> Pinned
                            </Badge>
                          )}
                          {thread.is_locked && (
                            <Badge variant="outline" className="gap-1">
                              <Lock className="h-3 w-3" /> Locked
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Link 
                        to={`/courses/${courseId}/forums/${forum.id}/threads/${thread.id}`}
                        className={`hover:underline text-lg ${thread.is_read ? '' : 'font-bold'}`}
                      >
                        {thread.title}
                      </Link>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center">
                          <Avatar className="h-5 w-5 mr-1">
                            <AvatarImage src={thread.author?.avatar_url || ''} />
                            <AvatarFallback>
                              {thread.author ? 
                                `${thread.author.first_name?.[0] || ''}${thread.author.last_name?.[0] || ''}` : 
                                'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground">
                            Started by {thread.author ? 
                              `${thread.author.first_name || ''} ${thread.author.last_name || ''}` : 
                              'Unknown User'} on {new Date(thread.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <Badge variant="outline">{thread.post_count || 0} replies</Badge>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 pb-2">
                      <div className="w-full flex justify-end text-sm">
                        {thread.last_post ? (
                          <div className="text-right text-muted-foreground">
                            <div>Last reply on {new Date(thread.last_post.created_at).toLocaleDateString()}</div>
                            <div>
                              by {thread.last_post.user_id?.first_name} {thread.last_post.user_id?.last_name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No replies yet</span>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 border rounded-lg bg-muted/20">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Threads Yet</h3>
            <p className="text-muted-foreground mb-6">Be the first to start a discussion in this forum.</p>
            
            {forum.allow_create_threads && user && (
              <Button onClick={() => setNewThreadOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Thread
              </Button>
            )}
          </div>
        )}
      </div>
      
      <NewThreadDialog 
        open={newThreadOpen} 
        onOpenChange={setNewThreadOpen} 
        forumId={forum.id}
      />
    </div>
  );
};

export default ThreadList;
