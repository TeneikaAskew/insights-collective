import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Edit, 
  Trash2, 
  FolderTree,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { createLogger } from '@/utils/logger';

const logger = createLogger('BlogCategoriesManager');

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  children?: Category[];
  post_count?: number;
}

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  parent_id?: string;
}

export function BlogCategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [flatCategories, setFlatCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    description: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('blog_categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;

      // Load post counts
      const { data: postCounts, error: countsError } = await supabase
        .from('blog_posts')
        .select('category_id')
        .eq('status', 'published');

      if (countsError) throw countsError;

      // Calculate post counts per category
      const counts = postCounts?.reduce((acc, post) => {
        if (post.category_id) {
          acc[post.category_id] = (acc[post.category_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Add post counts to categories
      const categoriesWithCounts = categoriesData?.map(cat => ({
        ...cat,
        post_count: counts?.[cat.id] || 0,
      })) || [];

      setFlatCategories(categoriesWithCounts as unknown as Category[]);

      // Build tree structure
      const tree = buildCategoryTree(categoriesWithCounts as unknown as Category[]);
      setCategories(tree);
    } catch (error) {
      logger.error('Error loading categories:', error);
      toast({
        title: 'Error',
        description: 'Failed to load categories',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const buildCategoryTree = (categories: Category[]): Category[] => {
    const map = new Map<string, Category>();
    const roots: Category[] = [];

    // Create a map of all categories
    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // Build the tree
    categories.forEach(cat => {
      const category = map.get(cat.id)!;
      if (cat.parent_id) {
        const parent = map.get(cat.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(category);
        }
      } else {
        roots.push(category);
      }
    });

    return roots;
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleCreate = () => {
    setSelectedCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
    });
    setShowDialog(true);
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parent_id: category.parent_id,
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.name || !formData.slug) {
        toast({
          title: 'Error',
          description: 'Name and slug are required',
          variant: 'destructive',
        });
        return;
      }

      if (selectedCategory) {
        // Update existing category
        const { error } = await supabase
          .from('blog_categories')
          .update({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            parent_id: formData.parent_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedCategory.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Category updated successfully',
        });
      } else {
        // Create new category
        const { error } = await supabase
          .from('blog_categories')
          .insert({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            parent_id: formData.parent_id || null,
          });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Category created successfully',
        });
      }

      setShowDialog(false);
      loadCategories();
    } catch (error: any) {
      logger.error('Error saving category:', error);
      
      // Check for unique constraint violation
      if (error.code === '23505' && error.details?.includes('slug')) {
        toast({
          title: 'Error',
          description: 'A category with this slug already exists',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to save category',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const { error } = await supabase
        .from('blog_categories')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Category deleted successfully',
      });

      setDeleteConfirm(null);
      loadCategories();
    } catch (error) {
      logger.error('Error deleting category:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete category. Make sure it has no child categories.',
        variant: 'destructive',
      });
    }
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderCategory = (category: Category, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <div key={category.id}>
        <div
          className={cn(
            'flex items-center justify-between p-3 hover:bg-accent rounded-lg cursor-pointer',
            level > 0 && 'ml-6'
          )}
          onClick={() => hasChildren && toggleExpanded(category.id)}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren ? (
              isExpanded ? (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4" />
                  <Folder className="h-4 w-4 text-muted-foreground" />
                </>
              )
            ) : (
              <div className="w-8" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{category.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {category.post_count || 0} posts
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{category.slug}</p>
              {category.description && (
                <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleEdit(category)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setDeleteConfirm(category)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {category.children!.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredCategories = categories.filter(category => {
    const searchLower = searchQuery.toLowerCase();
    return (
      category.name.toLowerCase().includes(searchLower) ||
      category.slug.toLowerCase().includes(searchLower) ||
      category.description?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Blog Categories</CardTitle>
              <CardDescription>
                Organize your blog posts with categories
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Categories Tree */}
          {categories.length === 0 ? (
            <div className="text-center py-8">
              <FolderTree className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No categories yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first category to get started
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {filteredCategories.map(category => renderCategory(category))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCategory ? 'Edit Category' : 'Create Category'}
            </DialogTitle>
            <DialogDescription>
              {selectedCategory 
                ? 'Update the category details below' 
                : 'Enter the details for your new category'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData({
                    ...formData,
                    name,
                    slug: generateSlug(name),
                  });
                }}
                placeholder="Category name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="category-slug"
                pattern="[a-z0-9-]+"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly version of the name
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this category (optional)"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent">Parent Category</Label>
              <Select
                value={formData.parent_id || 'none'}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  parent_id: value === 'none' ? undefined : value 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Top Level)</SelectItem>
                  {flatCategories
                    .filter(cat => cat.id !== selectedCategory?.id)
                    .map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {selectedCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? 
              {deleteConfirm?.children && deleteConfirm.children.length > 0 && (
                <Alert className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This category has {deleteConfirm.children.length} child categories that will also be deleted.
                  </AlertDescription>
                </Alert>
              )}
              {deleteConfirm?.post_count && deleteConfirm.post_count > 0 && (
                <Alert className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This category is used by {deleteConfirm.post_count} posts. 
                    These posts will be uncategorized after deletion.
                  </AlertDescription>
                </Alert>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}