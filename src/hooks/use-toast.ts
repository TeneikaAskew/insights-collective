
import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast"
import {
  useToast as useToastPrimitive
} from "@/components/ui/use-toast"

type ToasterToast = Toast & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 1000

type ToastHandler = {
  toast: (props: ToastProps) => void
  dismiss: (toastId?: string) => void
  toasts: ToasterToast[]
}

export const useToast = (): ToastHandler => {
  return useToastPrimitive()
}
