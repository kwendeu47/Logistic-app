"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-background p-4 shadow-lg">
          {children}
          <RadixDialog.Close className="absolute right-3 top-3 rounded-full p-1 hover:bg-muted">
            <X size={18} />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
