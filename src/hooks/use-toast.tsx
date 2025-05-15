
// This file provides the ToastProvider component and the useToast hook
import React from "react";
import { 
  Toast,
  ToastClose, 
  ToastDescription, 
  ToastProvider as ToastProviderPrimitive,
  ToastTitle, 
  ToastViewport,
} from "@/components/ui/toast";

import { type ToastProps, type ToastActionElement } from "@/components/ui/toast";

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

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: string;
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: string;
    };

interface State {
  toasts: ToasterToast[];
}

const toastReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      // If no id, dismiss all
      if (toastId === undefined) {
        return {
          ...state,
          toasts: state.toasts.map((t) => ({
            ...t,
            open: false,
          })),
        };
      }

      // Dismiss by id
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId ? { ...t, open: false } : t
        ),
      };
    }

    case actionTypes.REMOVE_TOAST: {
      const { toastId } = action;

      // If no id, remove all
      if (toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }

      // Remove by id
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== toastId),
      };
    }

    default:
      return state;
  }
};

// Create a managed toast context
const ToastContext = React.createContext<{
  toasts: ToasterToast[];
  toast: (props: ToasterToast | { title?: React.ReactNode; description?: React.ReactNode; action?: ToastActionElement; } & Partial<ToastProps>) => void;
  dismiss: (toastId?: string) => void;
}>({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
});

// Create a ToastProvider to wrap the app
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = React.useReducer(toastReducer, { toasts: [] });

  const toast = React.useCallback(
    (props: ToasterToast | { title?: React.ReactNode; description?: React.ReactNode; action?: ToastActionElement; } & Partial<ToastProps>) => {
      const id = genId();
      const newToast = {
        ...props,
        id,
        open: true,
      } as ToasterToast;

      dispatch({ type: actionTypes.ADD_TOAST, toast: newToast });

      return id;
    },
    []
  );

  const dismiss = React.useCallback((toastId?: string) => {
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId });
  }, []);

  const remove = React.useCallback((toastId?: string) => {
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId });
  }, []);

  React.useEffect(() => {
    state.toasts.forEach((toast) => {
      if (!toast.open) {
        if (toastTimeouts.has(toast.id)) {
          return;
        }
        
        const timeout = setTimeout(() => {
          remove(toast.id);
          toastTimeouts.delete(toast.id);
        }, TOAST_REMOVE_DELAY);
        
        toastTimeouts.set(toast.id, timeout);
      }
    });
  }, [state.toasts, remove]);

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, toast, dismiss }}>
      <ToastProviderPrimitive>
        {children}
        {state.toasts.map(function ({ id, title, description, action, ...props }) {
          return (
            <Toast key={id} {...props}>
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action}
              <ToastClose />
            </Toast>
          );
        })}
        <ToastViewport />
      </ToastProviderPrimitive>
    </ToastContext.Provider>
  );
};

// Create a hook to use the toast context
export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

// Export a toast function for convenience
export const toast = (props: { title?: React.ReactNode; description?: React.ReactNode; action?: ToastActionElement; } & Partial<ToastProps>) => {
  // This is a fallback for when the hook is used outside the provider
  // It will be replaced by the actual implementation when used with the provider
  console.warn("Toast used outside of provider, this might not work as expected");
  return "";
};

export type { ToasterToast, Toast };
