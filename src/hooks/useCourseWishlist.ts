
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { isValidUUID } from '@/utils/idUtils';

export function useCourseWishlist() {
  const [loading, setLoading] = useState(false);
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});
  const { user } = useAuth();

  const isInWishlist = (courseId: string) => {
    return Boolean(wishlisted[courseId]);
  };

  const addToWishlist = async (courseId: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to add courses to your wishlist",
        variant: "destructive"
      });
      return;
    }

    if (!isValidUUID(courseId)) {
      console.error(`Invalid course UUID format: ${courseId}`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('course_wishlists')
        .insert({
          user_id: user.id,
          course_id: courseId
        });

      if (error) throw error;

      setWishlisted(prev => ({
        ...prev,
        [courseId]: true
      }));

      toast({
        title: "Added to wishlist",
        description: "Course has been added to your wishlist"
      });
    } catch (error: any) {
      console.error('Error adding to wishlist:', error);
      toast({
        title: "Failed to add to wishlist",
        description: error.message || "There was an error adding this course to your wishlist",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (courseId: string) => {
    if (!user) return;

    if (!isValidUUID(courseId)) {
      console.error(`Invalid course UUID format: ${courseId}`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('course_wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      if (error) throw error;

      setWishlisted(prev => ({
        ...prev,
        [courseId]: false
      }));

      toast({
        title: "Removed from wishlist",
        description: "Course has been removed from your wishlist"
      });
    } catch (error: any) {
      console.error('Error removing from wishlist:', error);
      toast({
        title: "Failed to remove from wishlist",
        description: error.message || "There was an error removing this course from your wishlist",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    loading
  };
}
