import * as React from "react"
import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

export type Toast = Omit<ToasterToast, "id">

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

// Create a context for the toast
const ToastContext = React.createContext<{
  toasts: ToasterToast[]
  toast: (props: Toast) => { id: string; dismiss: () => void; update: (props: ToasterToast) => void }
  dismiss: (toastId?: string) => void
}>({
  toasts: [],
  toast: () => ({ id: "", dismiss: () => {}, update: () => {} }),
  dismiss: () => {},
})

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

// Create a proper provider component
export function ToastProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, dispatch] = React.useReducer(reducer, { toasts: [] })
  const toastTimeouts = React.useRef(new Map<string, ReturnType<typeof setTimeout>>()).current

  const addToRemoveQueue = React.useCallback((toastId: string) => {
    if (toastTimeouts.has(toastId)) {
      return
    }

    const timeout = setTimeout(() => {
      toastTimeouts.delete(toastId)
      dispatch({
        type: "REMOVE_TOAST",
        toastId: toastId,
      })
    }, TOAST_REMOVE_DELAY)

    toastTimeouts.set(toastId, timeout)
  }, [toastTimeouts, dispatch])

  const toast = React.useCallback((props: Toast) => {
    const id = genId()

    const update = (props: ToasterToast) =>
      dispatch({
        type: "UPDATE_TOAST",
        toast: { ...props, id },
      })
    
    const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

    dispatch({
      type: "ADD_TOAST",
      toast: {
        ...props,
        id,
        open: true,
        onOpenChange: (open) => {
          if (!open) dismiss()
        },
      },
    })

    return {
      id: id,
      dismiss,
      update,
    }
  }, [dispatch])

  const dismiss = React.useCallback((toastId?: string) => {
    dispatch({ type: "DISMISS_TOAST", toastId })
  }, [dispatch])

  React.useEffect(() => {
    state.toasts.forEach(toast => {
      if (!toast.open) {
        addToRemoveQueue(toast.id)
      }
    })
  }, [state.toasts, addToRemoveQueue])

  const contextValue = React.useMemo(() => ({
    toasts: state.toasts,
    toast,
    dismiss,
  }), [state.toasts, toast, dismiss])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  )
}

// Hook for consuming toast context
export function useToast() {
  const context = React.useContext(ToastContext)
  
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  
  return context
}

// For backwards compatibility - now properly implemented
export const toast = (props: Toast) => {
  console.error("Direct toast() call is deprecated. Use useToast() hook instead.")
  throw new Error("Direct toast() calls are not supported. Use the useToast() hook instead.")
}
