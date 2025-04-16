import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Editor } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useModuleContent } from '@/hooks/useModuleContent';

interface ModuleEditorProps {
  moduleId: string;
}

const ModuleEditor = ({ moduleId }: ModuleEditorProps) => {
  const [activeTab, setActiveTab] = useState<string>("edit");
  const { contents, loading, error, updateContent } = useModuleContent(moduleId);
  const { toast } = useToast();
  
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Fix the issue with the onValueChange prop
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Module Content</h2>
      
      {loading && <p>Loading module content...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      
      <Tabs 
        defaultValue="edit" 
        onValueChange={(value: string) => setActiveTab(value)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">Edit Content</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4">
          {contents.map((content) => (
            <Card key={content.id}>
              <CardHeader>
                <CardTitle>Content {content.position + 1}</CardTitle>
                <CardDescription>Edit the content for this module.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea 
                    id="content"
                    value={content.content}
                    onChange={(e) => updateContent(content.id, { content: e.target.value })}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="preview">
          {contents.map((content) => (
            <Card key={content.id}>
              <CardHeader>
                <CardTitle>Content {content.position + 1} Preview</CardTitle>
                <CardDescription>Preview the content for this module.</CardDescription>
              </CardHeader>
              <CardContent>
                <p>{content.content}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ModuleEditor;
