import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Globe, 
  Search, 
  MessageCircle, 
  Share2, 
  Mail, 
  Users, 
  Palette,
  Download,
  Upload,
  Save,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { createLogger } from '@/utils/logger';

const logger = createLogger('BlogSettings');

const blogSettingsSchema = z.object({
  // General Settings
  blog_title: z.string().min(1, 'Blog title is required'),
  blog_description: z.string().max(500, 'Description must be under 500 characters'),
  blog_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),

  // SEO Defaults
  default_meta_title: z.string().max(60, 'Meta title should be under 60 characters').optional(),
  default_meta_description: z.string().max(160, 'Meta description should be under 160 characters').optional(),
  default_meta_keywords: z.string().optional(),
  
  // Site-wide SEO
  site_meta_title: z.string().max(60, 'Site meta title should be under 60 characters').optional(),
  site_meta_description: z.string().max(160, 'Site meta description should be under 160 characters').optional(),
  site_meta_keywords: z.string().optional(),
  site_favicon_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  site_logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  
  // Comments & Social
  allow_comments: z.boolean(),
  moderate_comments: z.boolean(),
  social_sharing: z.boolean(),
  
  // Analytics
  google_analytics_id: z.string().optional(),
  google_tag_manager_id: z.string().optional(),
  enable_analytics: z.boolean(),
  
  // Email Notifications
  email_notifications: z.boolean(),
  notification_email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  
  // Publishing
  default_post_status: z.enum(['draft', 'published']),
  auto_generate_excerpts: z.boolean(),
  posts_per_page: z.number().min(1).max(50),
});

type BlogSettingsFormData = z.infer<typeof blogSettingsSchema>;

export function BlogSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<BlogSettingsFormData>({
    resolver: zodResolver(blogSettingsSchema),
    defaultValues: {
      blog_title: '',
      blog_description: '',
      blog_url: '',
      default_meta_title: '',
      default_meta_description: '',
      default_meta_keywords: '',
      site_meta_title: '',
      site_meta_description: '',
      site_meta_keywords: '',
      site_favicon_url: '',
      site_logo_url: '',
      allow_comments: true,
      moderate_comments: true,
      social_sharing: true,
      google_analytics_id: '',
      google_tag_manager_id: '',
      enable_analytics: true,
      email_notifications: true,
      notification_email: '',
      default_post_status: 'draft',
      auto_generate_excerpts: true,
      posts_per_page: 10,
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        form.reset({
          blog_title: data.blog_title || '',
          blog_description: data.blog_description || '',
          blog_url: data.blog_url || '',
          default_meta_title: data.default_meta_title || '',
          default_meta_description: data.default_meta_description || '',
          default_meta_keywords: data.default_meta_keywords || '',
          site_meta_title: data.site_meta_title || '',
          site_meta_description: data.site_meta_description || '',
          site_meta_keywords: data.site_meta_keywords || '',
          site_favicon_url: data.site_favicon_url || '',
          site_logo_url: data.site_logo_url || '',
          allow_comments: data.allow_comments ?? true,
          moderate_comments: data.moderate_comments ?? true,
          social_sharing: data.social_sharing ?? true,
          google_analytics_id: data.google_analytics_id || '',
          google_tag_manager_id: data.google_tag_manager_id || '',
          enable_analytics: data.enable_analytics ?? true,
          email_notifications: data.email_notifications ?? true,
          notification_email: data.notification_email || '',
          default_post_status: (data.default_post_status as 'draft' | 'published') || 'draft',
          auto_generate_excerpts: data.auto_generate_excerpts ?? true,
          posts_per_page: data.posts_per_page || 10,
        });
      }
    } catch (error) {
      logger.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load blog settings. Using defaults.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: BlogSettingsFormData) => {
    setSaving(true);
    try {
      // First, check if settings exist.
      //
      // The error was unchecked and `.single()` fails on BOTH "no rows" (PGRST116)
      // and on anything else — RLS denial, timeout, a second row already present.
      // Every one of those produced `existingSettings === null` and dropped into
      // the insert branch below, so a failed read on a NON-empty table wrote a
      // duplicate settings row rather than updating the existing one. Only the
      // genuine no-rows code may take that path.
      const { data: existingSettings, error: lookupError } = await supabase
        .from('blog_settings')
        .select('id')
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existingSettings) {
        // Update existing settings
        const { error } = await supabase
          .from('blog_settings')
          .update(data)
          .eq('id', existingSettings.id);

        if (error) throw error;
      } else {
        // Insert new settings
        const { error } = await supabase
          .from('blog_settings')
          .insert([data]);

        if (error) throw error;
      }
      
      toast({
        title: 'Settings saved',
        description: 'Your blog settings have been updated successfully.',
      });
    } catch (error) {
      logger.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const exportSettings = () => {
    const settings = form.getValues();
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'blog-settings.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string);
          form.reset(importedSettings);
          toast({
            title: 'Settings imported',
            description: 'Settings have been imported successfully.',
          });
        } catch (error) {
          toast({
            title: 'Import failed',
            description: 'Failed to import settings. Please check the file format.',
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Blog Settings</h2>
            <p className="text-muted-foreground">Configure your blog preferences and behavior</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={exportSettings}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button type="button" variant="outline" onClick={() => document.getElementById('import-settings')?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <input
              id="import-settings"
              type="file"
              accept=".json"
              onChange={importSettings}
              className="hidden"
            />
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="seo">
              <Search className="h-4 w-4 mr-2" />
              SEO
            </TabsTrigger>
            <TabsTrigger value="social">
              <Share2 className="h-4 w-4 mr-2" />
              Social
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <Globe className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Mail className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="publishing">
              <Users className="h-4 w-4 mr-2" />
              Publishing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic information about your blog</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="blog_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blog Title</FormLabel>
                      <FormControl>
                        <Input placeholder="My Amazing Blog" {...field} />
                      </FormControl>
                      <FormDescription>The name of your blog</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="blog_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blog Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="A brief description of what your blog is about..."
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>A short description of your blog (used in meta tags and RSS feeds)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="blog_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blog URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://myblog.com" {...field} />
                      </FormControl>
                      <FormDescription>The primary URL of your blog</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                 />
               </CardContent>
             </Card>
           </TabsContent>

           <TabsContent value="seo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SEO Defaults</CardTitle>
                <CardDescription>Default SEO settings for new blog posts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="default_meta_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Meta Title Template</FormLabel>
                      <FormControl>
                        <Input placeholder="[title] | My Blog" {...field} />
                      </FormControl>
                      <FormDescription>Use [title] as placeholder for post title</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="default_meta_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Meta Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Default description for posts without custom meta description"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>Fallback meta description for posts</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="default_meta_keywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Keywords</FormLabel>
                      <FormControl>
                        <Input placeholder="blog, technology, tutorials" {...field} />
                      </FormControl>
                      <FormDescription>Comma-separated default keywords</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                 />
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle>Site-wide SEO</CardTitle>
                 <CardDescription>Global SEO settings for your entire site</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <FormField
                   control={form.control}
                   name="site_meta_title"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Site Meta Title</FormLabel>
                       <FormControl>
                         <Input placeholder="Data Career Platform - Your Learning Hub" {...field} />
                       </FormControl>
                       <FormDescription>Global title for your site (used on homepage and fallback)</FormDescription>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                 <FormField
                   control={form.control}
                   name="site_meta_description"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Site Meta Description</FormLabel>
                       <FormControl>
                         <Textarea 
                           placeholder="Your comprehensive platform for data career development..."
                           {...field} 
                         />
                       </FormControl>
                       <FormDescription>Global description for your site</FormDescription>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                 <FormField
                   control={form.control}
                   name="site_meta_keywords"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Site Keywords</FormLabel>
                       <FormControl>
                         <Input placeholder="data science, analytics, career development" {...field} />
                       </FormControl>
                       <FormDescription>Comma-separated keywords for your entire site</FormDescription>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                 <FormField
                   control={form.control}
                   name="site_favicon_url"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Favicon URL</FormLabel>
                       <FormControl>
                         <Input placeholder="https://example.com/favicon.ico" {...field} />
                       </FormControl>
                       <FormDescription>URL to your site's favicon</FormDescription>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                 <FormField
                   control={form.control}
                   name="site_logo_url"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Site Logo URL</FormLabel>
                       <FormControl>
                         <Input placeholder="https://example.com/logo.png" {...field} />
                       </FormControl>
                       <FormDescription>URL to your site's logo</FormDescription>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
               </CardContent>
             </Card>
           </TabsContent>

           <TabsContent value="social" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Social & Comments</CardTitle>
                <CardDescription>Configure social features and comments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="allow_comments"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Allow Comments</FormLabel>
                          <FormDescription>Enable comments on blog posts</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="moderate_comments"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Moderate Comments</FormLabel>
                          <FormDescription>Require approval before comments are published</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="social_sharing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Social Sharing</FormLabel>
                          <FormDescription>Show social sharing buttons on posts</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Configuration</CardTitle>
                <CardDescription>Set up analytics tracking for your blog</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="enable_analytics"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Analytics</FormLabel>
                        <FormDescription>Track visitor data and post performance</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                 <FormField
                   control={form.control}
                   name="google_analytics_id"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Google Analytics ID</FormLabel>
                       <FormControl>
                         <Input placeholder="G-XXXXXXXXXX" {...field} />
                       </FormControl>
                       <FormDescription>Your Google Analytics measurement ID</FormDescription>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                 <FormField
                   control={form.control}
                   name="google_tag_manager_id"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Google Tag Manager ID</FormLabel>
                       <FormControl>
                         <Input placeholder="GTM-XXXXXXX" {...field} />
                       </FormControl>
                       <FormDescription>Your Google Tag Manager container ID</FormDescription>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                 <Alert>
                   <AlertCircle className="h-4 w-4" />
                   <AlertDescription>
                     Google Analytics and Tag Manager integration is now active. Configure your IDs above to start tracking.
                   </AlertDescription>
                 </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Configure email notifications for blog activities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="email_notifications"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Email Notifications</FormLabel>
                        <FormDescription>Receive notifications about blog activity</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notification_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notification Email</FormLabel>
                      <FormControl>
                        <Input placeholder="admin@myblog.com" type="email" {...field} />
                      </FormControl>
                      <FormDescription>Email address for notifications</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="publishing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Publishing Settings</CardTitle>
                <CardDescription>Configure default publishing behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="default_post_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Post Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select default status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Default status for new blog posts</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="posts_per_page"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Posts Per Page</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="50" 
                          {...field} 
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>Number of posts to show per page in listings</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="auto_generate_excerpts"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Auto-generate Excerpts</FormLabel>
                        <FormDescription>Automatically create excerpts from post content</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
}