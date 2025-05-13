
// Import from the actual implementation file
import { useToast, type Toast } from "@/hooks/use-toast.tsx";
import { ToastProvider } from "@/hooks/use-toast.tsx";

// Re-export everything needed
export { useToast, Toast, ToastProvider };

// For backward compatibility - provide toast function
export const toast = (props: Toast) => {
  // This is just for type checking during compilation
  // The actual implementation in use-toast.tsx will throw an error
  console.error("Direct toast() call is deprecated. Use useToast() hook instead.");
  throw new Error("Direct toast() calls are not supported. Use the useToast() hook instead.");
};
