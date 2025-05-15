
// This is the main file that defines the toast hook and context
import * as React from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider as ToastProviderPrimitive,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast as useToastPrimitive } from "@/components/ui/use-toast";

// Re-export the toast component types from the UI component
export type { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast";

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ToastProviderPrimitive swipeDirection="right">
      {children}
      <ToastViewport />
    </ToastProviderPrimitive>
  );
};

// Create a toast function for backward compatibility
export function toast(props: React.ComponentProps<typeof Toast>) {
  const { toast: showToast } = useToastPrimitive();
  showToast(props);
}

// Export the useToast hook
export const useToast = useToastPrimitive;

// Export the Toast UI components
export {
  ToastClose,
  ToastDescription,
  ToastTitle,
};
