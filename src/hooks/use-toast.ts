
// This is the main hook implementation file
import * as React from "react"
import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

export type { ToastProps };
export type ToastActionProps = React.ComponentPropsWithoutRef<typeof ToastActionElement>;

// Import the useToast hook from the UI component
import { useToast as useToastUI } from "@/components/ui/toast";

// Re-export the useToast hook
export const useToast = useToastUI;

// Re-export the toast function for backward compatibility
// This allows components to continue using `import { toast } from "@/hooks/use-toast"`
export const toast = useToastUI().toast;

// This component doesn't need to do anything as the actual provider is in @/components/ui/toaster
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
