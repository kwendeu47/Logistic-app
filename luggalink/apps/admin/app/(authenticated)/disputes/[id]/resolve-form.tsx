"use client";

import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Textarea } from "../../../../components/ui/input";
import { resolveDisputeAction } from "./actions";

type Resolution = "RESOLVED_SENDER" | "RESOLVED_TRAVELER" | "RESOLVED_SPLIT";

export function ResolveForm({ disputeId }: { disputeId: string }) {
  const [resolution, setResolution] = useState<Resolution>("RESOLVED_SENDER");
  const [splitPercent, setSplitPercent] = useState(50);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await resolveDisputeAction(disputeId, resolution, splitPercent, note);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["RESOLVED_SENDER", "RESOLVED_TRAVELER", "RESOLVED_SPLIT"] as Resolution[]).map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={resolution === option ? "primary" : "outline"}
            onClick={() => setResolution(option)}
          >
            {option === "RESOLVED_SENDER" && "Full refund to sender"}
            {option === "RESOLVED_TRAVELER" && "Release escrow to traveler"}
            {option === "RESOLVED_SPLIT" && "Custom split"}
          </Button>
        ))}
      </div>

      {resolution === "RESOLVED_SPLIT" && (
        <label className="block text-sm">
          % to traveler
          <input
            type="number"
            min={0}
            max={100}
            value={splitPercent}
            onChange={(event) => setSplitPercent(Number(event.target.value))}
            className="ml-2 w-20 rounded-md border border-border px-2 py-1"
          />
        </label>
      )}

      <Textarea
        placeholder="Resolution note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <Button onClick={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? "Resolving..." : "Resolve dispute"}
      </Button>
    </div>
  );
}
