"use client";

import { useState } from "react";
import { Dialog } from "./ui/dialog";

export function PhotoLightbox({ urls }: { urls: string[] }) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  if (urls.length === 0) {
    return <p className="text-sm text-muted-foreground">No photos</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt=""
            className="h-20 w-20 cursor-pointer rounded-md border border-border object-cover"
            onClick={() => setActiveUrl(url)}
          />
        ))}
      </div>
      <Dialog open={activeUrl !== null} onOpenChange={(open) => !open && setActiveUrl(null)}>
        {activeUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeUrl} alt="" className="max-h-[80vh] w-full object-contain" />
        )}
      </Dialog>
    </>
  );
}
