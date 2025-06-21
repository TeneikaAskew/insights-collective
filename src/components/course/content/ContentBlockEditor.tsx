
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  FileText, 
  Image, 
  Video, 
  File, 
  Quote, 
  Code, 
  Link, 
  HelpCircle,
  Save,
  X
} from 'lucide-react';
import FileUploadZone from './FileUploadZone';
import RichTextEditor from '@/components/ui/rich-text-editor';
import { UploadedFile } from '@/hooks/useFileUpload';

export interface ContentBlock {
  id?: string;
  block_type: string;
  title?: string;
  content: string;
  metadata: Record<string, any>;
  file_url?: string;
  file_type?: string;
  file_size?: number;
  position: number;
  is_interactive: boolean;
  completion_required: boolean;
}

interface ContentBlockEditorProps {
  block?: ContentBlock;
  position: number;
  onSave: (block: Omit<ContentBlock, 'id'>) => void;
  onCancel: () => void;
}

const ContentBlockEditor: React.FC<ContentBlockEditorProps> = ({
  block,
  position,
  onSave,
  onCancel
}) => {
  const [blockType, setBlockType] = useState(block?.block_type || 'text');
  const [title, setTitle] = useState(block?.title || '');
  const [content, setContent] = useState(block?.content || '');
  const [metadata, setMetadata] = useState<Record<string, any>>(block?.metadata || {});
  const [fileUrl, setFileUrl] = useState(block?.file_url || '');
  const [fileType, setFileType] = useState(block?.file_type || '');
  const [fileSize, setFileSize] = useState(block?.file_size || 0);
  const [isInteractive, setIsInteractive] = useState(block?.is_interactive || false);
  const [completionRequired, setCompletionRequired] = useState(block?.completion_required || false);

  const handleFileUploaded = (file: UploadedFile) => {
    setFileUrl(file.url);
    setFileType(file.type);
    setFileSize(file.size);
    setMetadata(prev => ({
      ...prev,
      originalName: file.name,
      filePath: file.path
    }));
  };

  const handleSave = () => {
    const blockData: Omit<ContentBlock, 'id'> = {
      block_type: blockType,
      title: title.trim() || undefined,
      content,
      metadata,
      file_url: fileUrl || undefined,
      file_type: fileType || undefined,
      file_size: fileSize || undefined,
      position,
      is_interactive: isInteractive,
      completion_required: completionRequired
    };

    onSave(blockData);
  };

  const blockTypes = [
    { value: 'text', label: 'Rich Text', icon: FileText, description: 'Formatted text content' },
    { value: 'image', label: 'Image', icon: Image, description: 'Images with captions' },
    { value: 'video', label: 'Video', icon: Video, description: 'Video content with controls' },
    { value: 'file', label: 'File Download', icon: File, description: 'Downloadable files' },
    { value: 'quote', label: 'Quote/Callout', icon: Quote, description: 'Highlighted text blocks' },
    { value: 'code', label: 'Code Block', icon: Code, description: 'Code with syntax highlighting' },
    { value: 'embed', label: 'Embed', icon: Link, description: 'YouTube, Vimeo, etc.' },
    { value: 'quiz', label: 'Quiz', icon: HelpCircle, description: 'Interactive quizzes' }
  ];

  const renderBlockTypeSelector = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {blockTypes.map((type) => {
        const Icon = type.icon;
        return (
          <Card
            key={type.value}
            className={`cursor-pointer transition-all hover:shadow-md ${
              blockType === type.value ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
            onClick={() => setBlockType(type.value)}
          >
            <CardContent className="p-4 text-center">
              <Icon className="h-6 w-6 mx-auto mb-2 text-gray-600" />
              <h4 className="font-medium text-sm">{type.label}</h4>
              <p className="text-xs text-gray-500 mt-1">{type.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderContentEditor = () => {
    switch (blockType) {
      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title (Optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this content block"
              />
            </div>
            <div>
              <Label>Content</Label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write your content here..."
              />
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Image Caption</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter image caption"
              />
            </div>
            {fileUrl ? (
              <div className="space-y-2">
                <img src={fileUrl} alt="Preview" className="max-w-full h-auto rounded-lg" />
                <Button variant="outline" onClick={() => setFileUrl('')}>
                  <X className="h-4 w-4 mr-2" />
                  Remove Image
                </Button>
              </div>
            ) : (
              <FileUploadZone
                acceptedTypes="images"
                onFileUploaded={handleFileUploaded}
              />
            )}
            <div>
              <Label>Alt Text (Optional)</Label>
              <Input
                value={metadata.altText || ''}
                onChange={(e) => setMetadata(prev => ({ ...prev, altText: e.target.value }))}
                placeholder="Describe the image for accessibility"
              />
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Video Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
              />
            </div>
            <Tabs defaultValue={fileUrl ? 'upload' : 'url'}>
              <TabsList>
                <TabsTrigger value="upload">Upload Video</TabsTrigger>
                <TabsTrigger value="url">Video URL</TabsTrigger>
              </TabsList>
              <TabsContent value="upload">
                {fileUrl ? (
                  <div className="space-y-2">
                    <video src={fileUrl} controls className="w-full rounded-lg" />
                    <Button variant="outline" onClick={() => setFileUrl('')}>
                      <X className="h-4 w-4 mr-2" />
                      Remove Video
                    </Button>
                  </div>
                ) : (
                  <FileUploadZone
                    acceptedTypes="videos"
                    onFileUploaded={handleFileUploaded}
                    maxSize={500 * 1024 * 1024} // 500MB for videos
                  />
                )}
              </TabsContent>
              <TabsContent value="url">
                <div>
                  <Label>Video URL</Label>
                  <Input
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="YouTube, Vimeo, or direct video URL"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        );

      case 'file':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">File Description</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Describe what this file contains"
              />
            </div>
            {fileUrl ? (
              <div className="space-y-2">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <File className="h-8 w-8 text-gray-600" />
                    <div>
                      <p className="font-medium">{metadata.originalName}</p>
                      <p className="text-sm text-gray-500">
                        {(fileSize / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setFileUrl('')}>
                  <X className="h-4 w-4 mr-2" />
                  Remove File
                </Button>
              </div>
            ) : (
              <FileUploadZone
                acceptedTypes="documents"
                onFileUploaded={handleFileUploaded}
              />
            )}
          </div>
        );

      case 'quote':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Quote Title (Optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter quote title"
              />
            </div>
            <div>
              <Label>Quote Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter the quote or callout text"
                rows={4}
              />
            </div>
            <div>
              <Label>Quote Style</Label>
              <Select
                value={metadata.style || 'info'}
                onValueChange={(value) => setMetadata(prev => ({ ...prev, style: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'code':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Code Title (Optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter code block title"
              />
            </div>
            <div>
              <Label>Programming Language</Label>
              <Select
                value={metadata.language || 'javascript'}
                onValueChange={(value) => setMetadata(prev => ({ ...prev, language: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="sql">SQL</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="css">CSS</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="bash">Bash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Code</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your code here"
                rows={8}
                className="font-mono text-sm"
              />
            </div>
          </div>
        );

      case 'embed':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Embed Title (Optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter embed title"
              />
            </div>
            <div>
              <Label>Embed URL</Label>
              <Input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="YouTube, Vimeo, CodePen, etc. URL"
              />
            </div>
            <div>
              <Label>Aspect Ratio</Label>
              <Select
                value={metadata.aspectRatio || '16:9'}
                onValueChange={(value) => setMetadata(prev => ({ ...prev, aspectRatio: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                  <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'quiz':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Quiz Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter quiz title"
                required
              />
            </div>
            <div>
              <Label>Quiz Description</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe what this quiz covers"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Time Limit (minutes)</Label>
                <Input
                  type="number"
                  value={metadata.timeLimit || ''}
                  onChange={(e) => setMetadata(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || null }))}
                  placeholder="No limit"
                />
              </div>
              <div>
                <Label>Passing Score (%)</Label>
                <Input
                  type="number"
                  value={metadata.passingScore || 70}
                  onChange={(e) => setMetadata(prev => ({ ...prev, passingScore: parseInt(e.target.value) || 70 }))}
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>
        );

      default:
        return <div>Select a content type to continue.</div>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {block ? 'Edit Content Block' : 'Add New Content Block'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-base font-medium">Content Type</Label>
          <div className="mt-3">
            {renderBlockTypeSelector()}
          </div>
        </div>

        {blockType && (
          <div>
            <Label className="text-base font-medium">Content Details</Label>
            <div className="mt-3">
              {renderContentEditor()}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="interactive"
              checked={isInteractive}
              onCheckedChange={setIsInteractive}
            />
            <Label htmlFor="interactive">Interactive Content</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="completion"
              checked={completionRequired}
              onCheckedChange={setCompletionRequired}
            />
            <Label htmlFor="completion">Completion Required</Label>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Content Block
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContentBlockEditor;
