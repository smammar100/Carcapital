"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** Style the confirm button as a destructive action (red). */
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

/**
 * Promise-based replacement for the native `window.confirm`. Renders a branded
 * AlertDialog instead of the browser's unstyled prompt.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   ...
 *   if (!(await confirm({ title: "Delete job?", destructive: true }))) return;
 *   ...
 *   return (<>{page}{confirmDialog}</>);
 *
 * Dismissing via backdrop/escape resolves `false`, matching `window.confirm`.
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({ open: false, title: "" });
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const confirmDialog = (
    <AlertDialog
      open={state.open}
      onOpenChange={(open: boolean) => {
        // Any close that isn't an explicit confirm counts as a cancel.
        if (!open) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.description ? (
            <AlertDialogDescription>
              {state.description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {state.cancelText ?? "Cancel"}
          </Button>
          <Button
            variant={state.destructive ? "destructive" : "default"}
            onClick={() => settle(true)}
          >
            {state.confirmText ?? "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, confirmDialog };
}
