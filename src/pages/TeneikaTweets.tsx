
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
import { CalendarIcon, SearchIcon, RefreshCw, ExternalLink, Heart, Repeat, MessageCircle, Upload } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import TweetArchiveUploadDialog from '@/components/tweets/TweetArchiveUploadDialog';

import { createLogger } from '@/utils/logger';

const logger = createLogger('TeneikaTweets');

/** The account this page archives. Individual tweet links are built from it. */
const TWITTER_HANDLE = 'teneikaask_you';
const TWITTER_PROFILE_URL = `https://twitter.com/${TWITTER_HANDLE}`;

interface Tweet {
  id: string;
  tweet_id: string;
  content: string;
  author_username: string;
  author_display_name: string;
  tweeted_at: string;
  scraped_at: string;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
}

const TeneikaTweets = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isScrapingModalOpen, setIsScrapingModalOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const { toast } = useToast();
  // Admin-only: the archive import writes both tweet tables, so the control is
  // hidden from everyone else. The Edge Function re-checks with requireAdmin —
  // hiding a button is presentation, never authorization.
  const { user, isAdmin } = useAuth();

  // Fetch tweets with filtering
  const { data: tweets = [], isLoading, error, refetch } = useQuery({
    queryKey: ['teneika-tweets', searchTerm, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('tweets')
        .select('*')
        .eq('author_username', 'teneikaask_you')
        .order('tweeted_at', { ascending: false });

      // Apply search filter
      if (searchTerm.trim()) {
        query = query.ilike('content', `%${searchTerm.trim()}%`);
      }

      // Apply date range filter
      if (dateRange?.from) {
        query = query.gte('tweeted_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('tweeted_at', toDate.toISOString());
      }

      const { data, error } = await query.limit(100);

      if (error) {
        throw error;
      }

      return data as Tweet[];
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const triggerScrape = async () => {
    try {
      setIsScrapingModalOpen(true);
      
      const { data, error } = await supabase.functions.invoke('scrape-teneika-tweets');
      
      if (error) {
        throw error;
      }

      // Handle structured error payloads (edge function returns 200 with success: false)
      if (data && data.success === false) {
        throw new Error(data.error || data.message || 'Scraping failed');
      }

      toast({
        title: 'Scraping Complete',
        description: data?.message || 'Successfully scraped tweets',
      });

      // Refetch the tweets to show new data
      refetch();
    } catch (error: any) {
      logger.error('Error triggering scrape:', error);
      toast({
        title: 'Scraping Failed',
        description: error.message || 'Failed to scrape tweets',
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

  const formatTweetDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy • h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  const getTweetUrl = (tweetId: string) => {
    return `${TWITTER_PROFILE_URL}/status/${tweetId}`;
  };

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive mb-4">Error loading tweets: {error.message}</p>
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
            <h1 className="text-3xl font-bold tracking-tight">Teneika's Tweets</h1>
            <p className="text-muted-foreground">
              Archive of tweets from{' '}
              {/* The handle was plain text on a page whose whole subject is that
                  account, so the one thing a reader wants next — the profile
                  itself — was the one thing they could not reach from here. */}
              <a
                href={TWITTER_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                data-testid="twitter-profile-link"
              >
                @teneikaask_you
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">(opens X in a new tab)</span>
              </a>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Admin only. Hiding it is presentation; the import-x-archive Edge
                Function re-checks with requireAdmin, which is the real gate. */}
            {isAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIsUploadOpen(true)}
                      aria-label="Import tweets from X archive"
                      data-testid="import-archive-button"
                    >
                      <Upload className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Import tweets from your X archive</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              onClick={triggerScrape}
              disabled={isScrapingModalOpen}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isScrapingModalOpen ? 'animate-spin' : ''}`} />
              {isScrapingModalOpen ? 'Scraping...' : 'Refresh Tweets'}
            </Button>
          </div>
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
                    placeholder="Search tweets..."
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
        {tweets.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{tweets.length} tweets found</span>
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

        {/* Tweets List */}
        {!isLoading && (
          <div className="space-y-4">
            {tweets.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || dateRange?.from || dateRange?.to
                      ? 'No tweets found matching your filters.'
                      : 'No tweets available. Try refreshing to scrape new tweets.'}
                  </p>
                  {!searchTerm && !dateRange?.from && !dateRange?.to && (
                    <Button onClick={triggerScrape}>
                      Scrape Tweets
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              tweets.map((tweet) => (
                <Card key={tweet.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Tweet Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-semibold">
                              {tweet.author_display_name?.charAt(0) || 'T'}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {tweet.author_display_name || 'Teneika Askew'}
                              </span>
                              <span className="text-muted-foreground text-sm">
                                @{tweet.author_username}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatTweetDate(tweet.tweeted_at)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <a
                            href={getTweetUrl(tweet.tweet_id)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>

                      {/* Tweet Content */}
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {tweet.content}
                        </p>
                      </div>

                      {/* Tweet Metrics */}
                      <div className="flex items-center gap-6 text-sm text-muted-foreground pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          <span>{tweet.like_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Repeat className="h-4 w-4" />
                          <span>{tweet.retweet_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          <span>{tweet.reply_count}</span>
                        </div>
                        <div className="ml-auto text-xs">
                          Scraped: {format(parseISO(tweet.scraped_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {isAdmin && (
          <TweetArchiveUploadDialog
            open={isUploadOpen}
            onOpenChange={setIsUploadOpen}
            createdBy={user?.id ?? null}
            onImported={refetch}
          />
        )}

        {/* Load More Button - Placeholder for future pagination */}
        {tweets.length >= 100 && (
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

export default TeneikaTweets;
