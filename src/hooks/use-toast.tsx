
import React from "react";
import { 
  Toast,
  ToastClose, 
  ToastDescription, 
  ToastProvider, 
  ToastTitle, 
  ToastViewport,
} from "@/components/ui/toast"
import { useToast as useToastPrimitive } from "@/components/ui/use-toast"

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ToastProvider>
      {children}
      <ToastViewport />
    </ToastProvider>
  );
};

export const useToast = useToastPrimitive;

export type { Toast } from "@/components/ui/use-toast"
