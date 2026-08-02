// ABOUTME: Hook to open (find or create) a course-scoped 1:1 message thread and navigate to it.
// ABOUTME: Wraps the open_course_thread Supabase RPC, which enforces enrollment/instructor rules server-side.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useCourseThread() {
  const [opening, setOpening] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const openThread = async (courseId: string, otherUserId: string) => {
    setOpening(true);
    try {
      const { data, error } = await supabase.rpc("open_course_thread", {
        p_course_id: courseId,
        p_other_user_id: otherUserId,
      });
      if (error) throw error;
      if (!data) throw new Error("Could not open thread");
      // Land in the course the thread is about, not a site-wide inbox. The thread id is a
      // query param because /courses/:courseId/messages has no :conversationId segment —
      // that keeps the course sidebar's Messages entry active while a thread is open.
      navigate(`/courses/${courseId}/messages?conversation=${data}`);
    } catch (err: any) {
      toast({
        title: "Unable to open thread",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setOpening(false);
    }
  };

  return { openThread, opening };
}
