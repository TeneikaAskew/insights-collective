
// This is the re-export file
import { useToast } from "@/hooks/use-toast";

// Re-export the type using 'export type' to fix TS1205 error with isolatedModules
export type { ToastProps } from "@/hooks/use-toast";

// Re-export the hook
export { useToast };
