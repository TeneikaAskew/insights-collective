
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
  Heading1, Heading2, List, ListOrdered, Link as LinkIcon, Image, Code
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DialogTrigger, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter content here...',
  className = '',
  minHeight = '200px'
}) => {
  const [htmlValue, setHtmlValue] = useState(value);
  const [currentTab, setCurrentTab] = useState<string>('visual');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [editorRef, setEditorRef] = useState<HTMLDivElement | null>(null);
  
  useEffect(() => {
    // Initialize editor content
    if (currentTab === 'visual' && editorRef) {
      editorRef.innerHTML = value;
    } else if (currentTab === 'html') {
      setHtmlValue(value);
    }
  }, [currentTab, value, editorRef]);
  
  const handleEditorChange = () => {
    if (editorRef && currentTab === 'visual') {
      const content = editorRef.innerHTML;
      onChange(content);
    }
  };
  
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHtmlValue(e.target.value);
    onChange(e.target.value);
  };
  
  const execCommand = (command: string, value: string = '') => {
    if (!editorRef) return;
    // Focus the editor to ensure commands work
    editorRef.focus();
    document.execCommand(command, false, value);
    handleEditorChange();
  };
  
  const insertLink = () => {
    if (linkUrl && editorRef) {
      const textToUse = linkText || linkUrl;
      const linkHtml = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${textToUse}</a>`;
      document.execCommand('insertHTML', false, linkHtml);
      setLinkUrl('');
      setLinkText('');
      handleEditorChange();
    }
  };
  
  const insertImage = () => {
    if (imageUrl && editorRef) {
      const imgHtml = `<img src="${imageUrl}" alt="${imageAlt}" class="max-w-full h-auto" />`;
      document.execCommand('insertHTML', false, imgHtml);
      setImageUrl('');
      setImageAlt('');
      handleEditorChange();
    }
  };
  
  return (
    <div className={`border rounded-md overflow-hidden ${className}`}>
      <Tabs defaultValue="visual" onValueChange={setCurrentTab} className="w-full">
        <div className="border-b px-3 py-1.5 flex justify-between items-center">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="visual" className="px-3 py-1.5 data-[state=active]:bg-muted">Visual</TabsTrigger>
            <TabsTrigger value="html" className="px-3 py-1.5 data-[state=active]:bg-muted">HTML</TabsTrigger>
          </TabsList>
          
          {currentTab === 'visual' && (
            <div className="flex flex-wrap gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => execCommand('bold')}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => execCommand('italic')}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => execCommand('underline')}
              >
                <Underline className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => execCommand('justifyLeft')}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => execCommand('justifyCenter')}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => execCommand('justifyRight')}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => execCommand('formatBlock', '<h2>')}
              >
                <Heading1 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => execCommand('formatBlock', '<h3>')}
              >
                <Heading2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => execCommand('insertUnorderedList')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => execCommand('insertOrderedList')}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Insert Link</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="url" className="text-right text-sm font-medium">URL</label>
                      <Input
                        id="url"
                        placeholder="https://example.com"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="text" className="text-right text-sm font-medium">Text</label>
                      <Input
                        id="text"
                        placeholder="Link text"
                        value={linkText}
                        onChange={(e) => setLinkText(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={insertLink}>Insert Link</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                  >
                    <Image className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Insert Image</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="image-url" className="text-right text-sm font-medium">Image URL</label>
                      <Input
                        id="image-url"
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="alt-text" className="text-right text-sm font-medium">Alt Text</label>
                      <Input
                        id="alt-text"
                        placeholder="Image description"
                        value={imageAlt}
                        onChange={(e) => setImageAlt(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={insertImage}>Insert Image</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => execCommand('formatBlock', '<pre>')}
              >
                <Code className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        
        <TabsContent value="visual" className="mt-0 p-0">
          <div
            ref={setEditorRef}
            contentEditable
            className="p-3 focus:outline-none min-h-[200px]"
            style={{ minHeight }}
            onInput={handleEditorChange}
            dangerouslySetInnerHTML={{ __html: value }}
            placeholder={placeholder}
          />
        </TabsContent>
        
        <TabsContent value="html" className="mt-0 p-0">
          <Textarea
            value={htmlValue}
            onChange={handleCodeChange}
            placeholder={placeholder}
            className="border-0 focus-visible:ring-0 resize-none min-h-[200px]"
            style={{ minHeight }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RichTextEditor;
