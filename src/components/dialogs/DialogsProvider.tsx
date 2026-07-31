// ABOUTME: App-wide provider for imperative confirm() and prompt() dialogs rendered as shadcn Alert/Dialog components.
// ABOUTME: Replaces native window.confirm and window.prompt so every popup stays inside the app.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface PromptOptions {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputLabel?: string;
}

interface DialogsContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogsContext = createContext<DialogsContextValue | null>(null);

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { open: boolean }) | null
  >(null);
  const confirmResolveRef = useRef<(value: boolean) => void>();

  const [promptState, setPromptState] = useState<
    (PromptOptions & { open: boolean; value: string }) | null
  >(null);
  const promptResolveRef = useRef<(value: string | null) => void>();

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({ ...options, open: true });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      promptResolveRef.current = resolve;
      setPromptState({ ...options, open: true, value: options.defaultValue ?? '' });
    });
  }, []);

  const handleConfirm = (result: boolean) => {
    confirmResolveRef.current?.(result);
    confirmResolveRef.current = undefined;
    setConfirmState((s) => (s ? { ...s, open: false } : s));
  };

  const handlePrompt = (result: string | null) => {
    promptResolveRef.current?.(result);
    promptResolveRef.current = undefined;
    setPromptState((s) => (s ? { ...s, open: false } : s));
  };

  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <DialogsContext.Provider value={value}>
      {children}

      <AlertDialog
        open={!!confirmState?.open}
        onOpenChange={(open) => {
          if (!open) handleConfirm(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            {confirmState?.description && (
              <AlertDialogDescription>{confirmState.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirm(false)}>
              {confirmState?.cancelLabel ?? 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleConfirm(true)}
              className={
                confirmState?.destructive
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                  : undefined
              }
            >
              {confirmState?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!promptState?.open}
        onOpenChange={(open) => {
          if (!open) handlePrompt(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{promptState?.title}</DialogTitle>
            {promptState?.description && (
              <DialogDescription>{promptState.description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="py-2">
            {promptState?.inputLabel && (
              <label className="block text-xs font-medium text-foreground mb-1">
                {promptState.inputLabel}
              </label>
            )}
            <Input
              autoFocus
              value={promptState?.value ?? ''}
              placeholder={promptState?.placeholder}
              onChange={(e) =>
                setPromptState((s) => (s ? { ...s, value: e.target.value } : s))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePrompt(promptState?.value ?? '');
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handlePrompt(null)}>
              {promptState?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button onClick={() => handlePrompt(promptState?.value ?? '')}>
              {promptState?.confirmLabel ?? 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsContextValue {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useDialogs must be used within DialogsProvider');
  return ctx;
}

export function useConfirm() {
  return useDialogs().confirm;
}

export function usePrompt() {
  return useDialogs().prompt;
}
