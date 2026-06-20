"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { approveKycAction, rejectKycAction } from "./actions";

export function KycRowActions({ userId }: { userId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleApprove() {
    setIsSubmitting(true);
    try {
      await approveKycAction(userId);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    const reason = window.prompt("Rejection reason");
    if (!reason) return;
    setIsSubmitting(true);
    try {
      await rejectKycAction(userId, reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={handleApprove} disabled={isSubmitting}>
        Approve
      </Button>
      <Button size="sm" variant="destructive" onClick={handleReject} disabled={isSubmitting}>
        Reject
      </Button>
    </div>
  );
}
