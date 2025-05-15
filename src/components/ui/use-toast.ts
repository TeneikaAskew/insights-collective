
import {
  type ToastActionElement,
  type ToastProps,
} from "@/components/ui/toast"

import { useToast as useToastHook } from "@/hooks/use-toast";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

// Define the useToast function directly here
export const useToast = () => {
  return {
    toast: ({ ...props }) => {},
    dismiss: (toastId?: string) => {},
    toasts: [] as ToasterToast[],
  }
}

// Note: This is a circular reference that will be resolved when the actual implementation
// is used from hooks/use-toast.tsx instead.
