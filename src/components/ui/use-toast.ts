
// Re-export from the hook implementation to avoid circular dependencies
import { useToast, toast, type ToasterToast } from "@/hooks/use-toast";

export {
  useToast,
  toast,
  type ToasterToast as Toast
};

// These old types are kept to maintain compatibility with existing code
import { type ToastActionElement, type ToastProps } from "@/components/ui/toast";
export { type ToastProps, type ToastActionElement };
