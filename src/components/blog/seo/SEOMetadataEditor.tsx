import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  Smartphone,
  Monitor,
  Search,
  Share2,
  AlertTriangle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MediaLibraryDialog } from '../media/MediaLibraryDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SEOMetadata {
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  og_image: string;
  custom_slug: string;
}

interface SEOMetadataEditorProps {
  metadata: SEOMetadata;
  onChange: (metadata: SEOMetadata) => void;
  title: string;
  content: string;
}

export function SEOMetadataEditor({ metadata, onChange, title, content }: SEOMetadataEditorProps) {
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [seoScore, setSeoScore] = useState(0);
  const [seoIssues, setSeoIssues] = useState<string[]>([]);
  const [seoSuggestions, setSeoSuggestions] = useState<string[]>([]);

  useEffect(() => {
    analyzeSEO();
  }, [metadata, title, content]);

  const analyzeSEO = () => {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Title analysis
    const titleLength = metadata.meta_title?.length || title?.length || 0;
    if (titleLength === 0) {
      issues.push('Missing meta title');
      score -= 20;
    } else if (titleLength < 30) {
      issues.push('Meta title is too short (minimum 30 characters)');
      score -= 10;
    } else if (titleLength > 60) {
      issues.push('Meta title is too long (maximum 60 characters)');
      score -= 10;
    }

    // Description analysis
    const descLength = metadata.meta_description?.length || 0;
    if (descLength === 0) {
      issues.push('Missing meta description');
      score -= 20;
    } else if (descLength < 120) {
      issues.push('Meta description is too short (minimum 120 characters)');
      score -= 10;
    } else if (descLength > 160) {
      issues.push('Meta description is too long (maximum 160 characters)');
      score -= 10;
    }

    // Keywords analysis
    if (!metadata.meta_keywords) {
      suggestions.push('Add relevant keywords to improve search visibility');
      score -= 5;
    } else {
      const keywords = metadata.meta_keywords.split(',').map(k => k.trim());
      if (keywords.length < 3) {
        suggestions.push('Add more keywords (3-10 recommended)');
        score -= 5;
      } else if (keywords.length > 10) {
        suggestions.push('Too many keywords can be counterproductive');
        score -= 5;
      }
    }

    // OG Image
    if (!metadata.og_image) {
      issues.push('Missing Open Graph image for social media sharing');
      score -= 15;
    }

    // URL slug
    if (metadata.custom_slug) {
      if (metadata.custom_slug.includes(' ')) {
        issues.push('URL slug should not contain spaces');
        score -= 10;
      }
      if (!/^[a-z0-9-]+$/.test(metadata.custom_slug)) {
        issues.push('URL slug should only contain lowercase letters, numbers, and hyphens');
        score -= 10;
      }
    }

    // Content analysis
    if (content) {
      const wordCount = content.split(/\s+/).length;
      if (wordCount < 300) {
        suggestions.push('Content is quite short. Aim for at least 300 words for better SEO');
        score -= 5;
      }
    }

    setSeoScore(Math.max(0, score));
    setSeoIssues(issues);
    setSeoSuggestions(suggestions);
  };

  const handleChange = (field: keyof SEOMetadata, value: string) => {
    onChange({
      ...metadata,
      [field]: value,
    });
  };

  const generateSlugFromTitle = () => {
    const slug = (metadata.meta_title || title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    handleChange('custom_slug', slug);
  };

  const handleImageSelect = (media: { url: string }) => {
    handleChange('og_image', media.url);
    setShowMediaLibrary(false);
  };

  const getScoreColor = () => {
    if (seoScore >= 80) return 'text-ss-good';
    if (seoScore >= 60) return 'text-ss-warn';
    return 'text-ss-bad';
  };

  const getScoreIcon = () => {
    if (seoScore >= 80) return <CheckCircle2 className="h-5 w-5" />;
    if (seoScore >= 60) return <AlertTriangle className="h-5 w-5" />;
    return <AlertCircle className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      {/* SEO Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>SEO Score</span>
            <span className={`flex items-center gap-2 ${getScoreColor()}`}>
              {getScoreIcon()}
              {seoScore}%
            </span>
          </CardTitle>
          <CardDescription>
            Optimize your content for search engines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={seoScore} className="h-2" />
          
          {seoIssues.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ss-bad">Issues to fix:</p>
              {seoIssues.map((issue, index) => (
                <Alert key={index} variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{issue}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {seoSuggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ss-warn">Suggestions:</p>
              {seoSuggestions.map((suggestion, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{suggestion}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEO Fields */}
      <Card>
        <CardHeader>
          <CardTitle>SEO Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta-title">
              Meta Title
              <span className="ml-2 text-xs text-muted-foreground">
                ({metadata.meta_title?.length || 0}/60)
              </span>
            </Label>
            <Input
              id="meta-title"
              value={metadata.meta_title || ''}
              onChange={(e) => handleChange('meta_title', e.target.value)}
              placeholder={title || 'Enter meta title'}
              maxLength={60}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-description">
              Meta Description
              <span className="ml-2 text-xs text-muted-foreground">
                ({metadata.meta_description?.length || 0}/160)
              </span>
            </Label>
            <Textarea
              id="meta-description"
              value={metadata.meta_description || ''}
              onChange={(e) => handleChange('meta_description', e.target.value)}
              placeholder="Write a compelling description for search results"
              maxLength={160}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-keywords">Keywords</Label>
            <Input
              id="meta-keywords"
              value={metadata.meta_keywords || ''}
              onChange={(e) => handleChange('meta_keywords', e.target.value)}
              placeholder="keyword1, keyword2, keyword3"
            />
            <p className="text-xs text-muted-foreground">
              Separate keywords with commas
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-slug">
              Custom URL Slug
              <Button
                size="sm"
                variant="ghost"
                className="ml-2"
                onClick={generateSlugFromTitle}
              >
                Generate from title
              </Button>
            </Label>
            <Input
              id="custom-slug"
              value={metadata.custom_slug || ''}
              onChange={(e) => handleChange('custom_slug', e.target.value)}
              placeholder="my-awesome-blog-post"
              pattern="[a-z0-9-]+"
            />
            <p className="text-xs text-muted-foreground">
              Only lowercase letters, numbers, and hyphens allowed
            </p>
          </div>

          <div className="space-y-2">
            <Label>Open Graph Image</Label>
            {metadata.og_image ? (
              <div className="relative">
                <img
                  src={metadata.og_image}
                  alt="OG Image"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => setShowMediaLibrary(true)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowMediaLibrary(true)}
              >
                Select Image
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Recommended size: 1200x630 pixels
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Preview</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={previewDevice === 'desktop' ? 'default' : 'ghost'}
                onClick={() => setPreviewDevice('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={previewDevice === 'mobile' ? 'default' : 'ghost'}
                onClick={() => setPreviewDevice('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="google" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="google">
                <Search className="h-4 w-4 mr-2" />
                Google
              </TabsTrigger>
              <TabsTrigger value="social">
                <Share2 className="h-4 w-4 mr-2" />
                Social Media
              </TabsTrigger>
            </TabsList>

            <TabsContent value="google" className="space-y-2">
              <div className={previewDevice === 'mobile' ? 'max-w-sm' : 'max-w-2xl'}>
                <div className="space-y-1">
                  <h3 className="text-ss-teal text-xl line-clamp-1">
                    {metadata.meta_title || title || 'Untitled Post'}
                  </h3>
                  <p className="text-ss-good text-sm">
                    example.com › blog › {metadata.custom_slug || 'untitled'}
                  </p>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {metadata.meta_description || 'No description provided'}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="social" className="space-y-2">
              <div className={previewDevice === 'mobile' ? 'max-w-sm' : 'max-w-2xl'}>
                <div className="border rounded-lg overflow-hidden">
                  {metadata.og_image && (
                    <img
                      src={metadata.og_image}
                      alt="Social preview"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4 space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">example.com</p>
                    <h3 className="font-semibold line-clamp-1">
                      {metadata.meta_title || title || 'Untitled Post'}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {metadata.meta_description || 'No description provided'}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Media Library */}
      <MediaLibraryDialog
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
        onSelect={handleImageSelect}
      />
    </div>
  );
}