
import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
 
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Toast } from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

import {
  type ToastActionElement,
  type ToastProps,
} from "@/components/ui/toast"

const FormSchema = z.object({
  title: z.string().min(2, {
    message: "Title must be at least 2 characters.",
  }),
})

export interface ToasterToast extends Omit<ToastProps, "action"> {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToastActionElement = React.ReactElement<{
  altText: string
  onClick: () => void
}>

export type ToastActionElement = ToasterToastActionElement

export const reducer = (state: ToasterToast[], action: ToasterAction): ToasterToast[] => {
  switch (action.type) {
    case "ADD_TOAST":
      return [action.toast, ...state].slice(0, TOAST_LIMIT)

    case "UPDATE_TOAST":
      return state.map((t) =>
        t.id === action.toast.id ? { ...t, ...action.toast } : t
      )

    case "DISMISS_TOAST": {
      const { id } = action

      // If id is defined, dismiss the specific toast
      if (id) {
        return state.map((t) =>
          t.id === id ? { ...t, open: false } : t
        )
      }

      // If id is undefined, dismiss all toasts
      return state.map((t) => ({ ...t, open: false }))
    }

    case "REMOVE_TOAST": {
      const { id } = action

      // If id is defined, remove the specific toast
      if (id) {
        return state.filter((t) => t.id !== id)
      }

      // If id is undefined, remove all toasts
      return []
    }
  }
}

export type ToasterAction =
  | {
      type: "ADD_TOAST"
      toast: ToasterToast
    }
  | {
      type: "UPDATE_TOAST"
      toast: Partial<ToasterToast> & { id: string }
    }
  | {
      type: "DISMISS_TOAST"
      id?: string
    }
  | {
      type: "REMOVE_TOAST"
      id?: string
    }

interface ToasterProps {
  toasts: ToasterToast[]
  action: React.Dispatch<ToasterAction>
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const useToaster = () => {
  const [state, dispatch] = React.useReducer(reducer, [])

  React.useEffect(() => {
    state.forEach((toast) => {
      if (!toast.open && !toastTimeouts.has(toast.id)) {
        toastTimeouts.set(
          toast.id,
          setTimeout(() => {
            dispatch({ type: "REMOVE_TOAST", id: toast.id })
            toastTimeouts.delete(toast.id)
          }, TOAST_REMOVE_DELAY)
        )
      }
    })
  }, [state])

  const toast = React.useMemo(() => {
    const showToast = (props: Omit<ToasterToast, "id" | "open">) => {
      const id = Math.random().toString(36).substring(2, 9)
      
      dispatch({
        type: "ADD_TOAST",
        toast: {
          id,
          open: true,
          onOpenChange: (open) => {
            if (!open) {
              dispatch({ type: "DISMISS_TOAST", id })
            }
          },
          ...props,
        },
      })
      
      return id
    }

    return Object.assign(showToast, {
      dismiss: (id?: string) => dispatch({ type: "DISMISS_TOAST", id }),
    })
  }, [dispatch])

  return {
    toast,
    toasts: state,
    dispatch,
  }
}

export { useToaster, useToast }
