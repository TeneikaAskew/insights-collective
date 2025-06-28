
import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, ButtonProps } from "@/components/ui/button";

interface ConfirmationDialogProps {
  /** The element that triggers the dialog */
  trigger: React.ReactNode;
  /** The title of the confirmation dialog */
  title: string;
  /** The description text explaining what's being confirmed */
  description: string;
  /** The label for the confirm button */
  confirmLabel?: string;
  /** The label for the cancel button */
  cancelLabel?: string;
  /** Event handler for the confirm button */
  onConfirm: () => void;
  /** Optional event handler for the cancel button */
  onCancel?: () => void;
  /** The icon to display (warning or info) */
  icon?: "warning" | "info";
  /** Additional class for the confirm button */
  confirmButtonClassName?: string;
  /** Variant for the confirm button */
  confirmButtonVariant?: ButtonProps["variant"];
  /** Whether the dialog is destructive in nature (defaults to true) */
  destructive?: boolean;
  /** Whether to close the dialog after confirmation */
  closeOnConfirm?: boolean;
}

export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  icon = "warning",
  confirmButtonClassName,
  confirmButtonVariant,
  destructive = true,
  closeOnConfirm = true,
}: ConfirmationDialogProps) {
  const [open, setOpen] = React.useState(false);

  const handleConfirm = () => {
    onConfirm();
    if (closeOnConfirm) {
      setOpen(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            {icon === "warning" ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <Info className="h-5 w-5 text-blue-500" />
            )}
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn(
              destructive &&
                !confirmButtonVariant &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              confirmButtonClassName
            )}
            {...(confirmButtonVariant && { variant: confirmButtonVariant })}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
