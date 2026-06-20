"use client";

import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { adjustTrustScoreAction, forceVerifyAction, toggleSuspendAction } from "./actions";

export function UserActions({ userId, isSuspended, trustScore }: { userId: string; isSuspended: boolean; trustScore: number }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function run(fn: () => Promise<void>) {
    setIsSubmitting(true);
    try {
      await fn();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={isSuspended ? "secondary" : "destructive"}
        disabled={isSubmitting}
        onClick={() => run(() => toggleSuspendAction(userId, !isSuspended))}
      >
        {isSuspended ? "Unsuspend" : "Suspend account"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isSubmitting}
        onClick={() => {
          const value = window.prompt("New trust score (0-5)", String(trustScore));
          if (value === null) return;
          const reason = window.prompt("Reason for adjustment") ?? "";
          void run(() => adjustTrustScoreAction(userId, Number(value), reason));
        }}
      >
        Adjust trust score
      </Button>
      <Button size="sm" variant="outline" disabled={isSubmitting} onClick={() => run(() => forceVerifyAction(userId))}>
        Force-verify
      </Button>
    </div>
  );
}
