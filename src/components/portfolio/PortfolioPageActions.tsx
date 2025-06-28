
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Share, FileDown, Mail, ExternalLink, Eye } from 'lucide-react';
import { PortfolioPage } from '@/types/portfolio';

interface PortfolioPageActionsProps {
  portfolioPage: PortfolioPage;
}

export function PortfolioPageActions({ portfolioPage }: PortfolioPageActionsProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const { toast } = useToast();
  const { getShareableLink, exportPortfolioAsCSV } = usePortfolioPages();

  const shareableUrl = portfolioPage.custom_url ? getShareableLink(portfolioPage.custom_url) : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: 'Copied!',
        description: 'Link copied to clipboard',
      });
    });
  };

  const handleEmailShare = () => {
    if (!shareableUrl || !emailInput) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    const subject = encodeURIComponent(`Check out my portfolio: ${portfolioPage.title}`);
    const body = encodeURIComponent(`Hi there!\n\nI'd like to share my portfolio with you. You can view it at: ${shareableUrl}\n\nBest regards!`);
    const mailtoUrl = `mailto:${emailInput}?subject=${subject}&body=${body}`;
    
    window.open(mailtoUrl, '_blank');
    setEmailInput('');
    toast({
      title: 'Email client opened',
      description: 'Your default email client should open with the portfolio link',
    });
  };

  const generateEmbedCode = () => {
    if (!shareableUrl) return '';
    return `<iframe src="${shareableUrl}" width="100%" height="600" frameborder="0"></iframe>`;
  };

  const handleCSVExport = async () => {
    try {
      await exportPortfolioAsCSV(portfolioPage.id);
      toast({
        title: 'Export successful',
        description: 'Portfolio data exported as CSV',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Could not export portfolio data',
        variant: 'destructive',
      });
    }
  };

  const openPortfolio = () => {
    if (shareableUrl) {
      window.open(shareableUrl, '_blank');
    }
  };

  if (!portfolioPage.is_public || !portfolioPage.custom_url) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Portfolio Actions</CardTitle>
          <CardDescription>
            Make your portfolio public and set a custom URL to enable sharing
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={openPortfolio} className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
          <Eye className="h-4 w-4 mr-2" />
          View Portfolio
        </Button>
        
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share Portfolio</DialogTitle>
              <DialogDescription>
                Share your portfolio with others using the options below.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="portfolio-url">Portfolio URL</Label>
                <div className="flex space-x-2 mt-1">
                  <Input
                    id="portfolio-url"
                    value={shareableUrl || ''}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(shareableUrl || '')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="email-share">Share via Email</Label>
                <div className="flex space-x-2 mt-1">
                  <Input
                    id="email-share"
                    type="email"
                    placeholder="Enter email address"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleEmailShare}>
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="embed-code">Embed Code</Label>
                <div className="flex space-x-2 mt-1">
                  <Input
                    id="embed-code"
                    value={generateEmbedCode()}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(generateEmbedCode())}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Button variant="outline" onClick={handleCSVExport}>
          <FileDown className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>
    </div>
  );
}
