"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { approveTripAction, removeTripAction } from "./actions";

export function TripRowActions({ tripId }: { tripId: string }) {
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
    <div className="flex gap-2">
      <Button size="sm" disabled={isSubmitting} onClick={() => run(() => approveTripAction(tripId))}>
        Approve
      </Button>
      <Button size="sm" variant="destructive" disabled={isSubmitting} onClick={() => run(() => removeTripAction(tripId))}>
        Remove
      </Button>
    </div>
  );
}
