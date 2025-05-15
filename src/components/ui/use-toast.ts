
// Export from the toast UI components
export { 
  ToastProvider,
  ToastActionElement,
} from "@/components/ui/toast";

// Re-export the types with proper 'export type'
export type { ToastProps } from "@/components/ui/toast";

// Re-export the hook from hooks implementation
export { useToast, toast } from "@/hooks/use-toast";
