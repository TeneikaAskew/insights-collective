
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, SearchIcon, RefreshCw, ExternalLink, Heart, MessageCircle, Share } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { createLogger } from '@/utils/logger';

const logger = createLogger('TeneikaLinkedIn');

/** The profile this page archives. */
const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/teneikaaskew';

interface LinkedInPost {
  id: string;
  post_id: string;
  content: string;
  author_username: string;
  author_display_name: string;
  posted_at: string;
  scraped_at: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  media_urls: string[];
  post_url: string;
}

const TeneikaLinkedIn = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isScrapingModalOpen, setIsScrapingModalOpen] = useState(false);
  const { toast } = useToast();

  // Fetch LinkedIn posts with filtering
  const { data: posts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['linkedin-posts', searchTerm, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('linkedin_posts')
        .select('*')
        .eq('author_username', 'teneikaaskew')
        .order('posted_at', { ascending: false });

      // Apply search filter
      if (searchTerm.trim()) {
        query = query.ilike('content', `%${searchTerm.trim()}%`);
      }

      // Apply date range filter
      if (dateRange?.from) {
        query = query.gte('posted_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('posted_at', toDate.toISOString());
      }

      const { data, error } = await query.limit(100);

      if (error) {
        throw error;
      }

      return data as LinkedInPost[];
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const triggerScrape = async () => {
    try {
      setIsScrapingModalOpen(true);
      
      const { data, error } = await supabase.functions.invoke('scrape-linkedin-posts');
      
      if (error) {
        throw error;
      }

      // Handle structured error payloads (edge function returns 200 with success: false)
      if (data && data.success === false) {
        throw new Error(data.error || data.message || 'Scraping failed');
      }

      toast({
        title: 'Scraping Complete',
        description: data?.message || 'Successfully scraped LinkedIn posts',
      });

      // Refetch the posts to show new data
      refetch();
    } catch (error: any) {
      logger.error('Error triggering scrape:', error);
      toast({
        title: 'Scraping Failed',
        description: error.message || 'Failed to scrape LinkedIn posts',
        variant: 'destructive',
      });
    } finally {
      setIsScrapingModalOpen(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateRange(undefined);
  };

  const formatPostDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy • h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive mb-4">Error loading LinkedIn posts: {error.message}</p>
              <Button onClick={() => refetch()}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Teneika's LinkedIn Posts</h1>
            <p className="text-muted-foreground">
              Archive of LinkedIn posts from{' '}
              {/* Especially worth linking here: when the archive is empty this
                  page offers only a Scrape button, so without it there is no
                  way through to the posts it is named after. */}
              <a
                href={LINKEDIN_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                data-testid="linkedin-profile-link"
              >
                Teneika Askew
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">(opens LinkedIn in a new tab)</span>
              </a>
            </p>
          </div>
          <Button 
            onClick={triggerScrape} 
            disabled={isScrapingModalOpen}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isScrapingModalOpen ? 'animate-spin' : ''}`} />
            {isScrapingModalOpen ? 'Scraping...' : 'Refresh Posts'}
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search posts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, 'LLL dd, y')} -{' '}
                            {format(dateRange.to, 'LLL dd, y')}
                          </>
                        ) : (
                          format(dateRange.from, 'LLL dd, y')
                        )
                      ) : (
                        'Pick a date range'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>

                {(searchTerm || dateRange?.from || dateRange?.to) && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        {posts.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{posts.length} posts found</span>
            {(searchTerm || dateRange?.from || dateRange?.to) && (
              <Badge variant="secondary">Filtered</Badge>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Posts List */}
        {!isLoading && (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || dateRange?.from || dateRange?.to
                      ? 'No posts found matching your filters.'
                      : 'No LinkedIn posts available. Try refreshing to scrape new posts.'}
                  </p>
                  {!searchTerm && !dateRange?.from && !dateRange?.to && (
                    <Button onClick={triggerScrape}>
                      Scrape Posts
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              posts.map((post) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Post Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-ss-lav-chip flex items-center justify-center">
                            <span className="text-ss-lav-deep font-semibold">
                              {post.author_display_name?.charAt(0) || 'T'}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {post.author_display_name || 'Teneika Askew'}
                              </span>
                              <span className="text-muted-foreground text-sm">
                                @{post.author_username}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatPostDate(post.posted_at)}
                            </p>
                          </div>
                        </div>
                        {post.post_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <a
                              href={post.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>

                      {/* Post Content */}
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {post.content}
                        </p>
                      </div>

                      {/* Media URLs */}
                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {post.media_urls.map((url, index) => (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              Media {index + 1}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Post Metrics */}
                      <div className="flex items-center gap-6 text-sm text-muted-foreground pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          <span>{post.like_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          <span>{post.comment_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Share className="h-4 w-4" />
                          <span>{post.share_count}</span>
                        </div>
                        <div className="ml-auto text-xs">
                          Scraped: {format(parseISO(post.scraped_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Load More Button - Placeholder for future pagination */}
        {posts.length >= 100 && (
          <div className="text-center pt-6">
            <Button variant="outline" disabled>
              Load More (Coming Soon)
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TeneikaLinkedIn;
