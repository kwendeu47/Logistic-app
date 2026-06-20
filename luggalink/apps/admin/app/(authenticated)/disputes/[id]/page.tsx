import { notFound } from "next/navigation";
import { PhotoLightbox } from "../../../../components/photo-lightbox";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardTitle } from "../../../../components/ui/card";
import { prisma } from "../../../../lib/prisma";
import { ResolveForm } from "./resolve-form";

export const dynamic = "force-dynamic";

export default async function DisputeDetailPage({ params }: { params: { id: string } }) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: params.id },
    include: {
      openedBy: true,
      booking: {
        include: {
          sender: true,
          traveler: true,
          handoffLogs: { orderBy: { createdAt: "asc" } },
          messages: { orderBy: { createdAt: "asc" }, include: { sender: true } },
        },
      },
    },
  });

  if (!dispute) {
    notFound();
  }

  const booking = dispute.booking;
  const allPhotos = booking.handoffLogs.flatMap((log) => log.photoUrls);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dispute {dispute.id.slice(0, 8)}</h1>
        <Badge variant="warning">{dispute.status}</Badge>
      </div>

      <Card>
        <CardTitle>Summary</CardTitle>
        <p className="mt-2 text-sm">
          Reason: <strong>{dispute.reason}</strong>
        </p>
        <p className="text-sm">Opened by: {dispute.openedBy.firstName} {dispute.openedBy.lastName}</p>
        <p className="mt-2 text-sm text-muted-foreground">{dispute.description}</p>
      </Card>

      <Card>
        <CardTitle>Booking timeline</CardTitle>
        <ul className="mt-2 space-y-1 text-sm">
          {booking.handoffLogs.map((log) => (
            <li key={log.id}>
              {log.createdAt.toLocaleString()} — <strong>{log.stage}</strong>
            </li>
          ))}
          {booking.handoffLogs.length === 0 && (
            <li className="text-muted-foreground">No handoff events recorded</li>
          )}
        </ul>
      </Card>

      <Card>
        <CardTitle>Handoff photos</CardTitle>
        <div className="mt-2">
          <PhotoLightbox urls={allPhotos} />
        </div>
      </Card>

      <Card>
        <CardTitle>Chat history</CardTitle>
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
          {booking.messages.map((message) => (
            <div key={message.id}>
              <span className="font-medium">{message.sender.firstName}: </span>
              {message.body}
            </div>
          ))}
          {booking.messages.length === 0 && <p className="text-muted-foreground">No messages</p>}
        </div>
      </Card>

      <Card>
        <CardTitle>Evidence uploaded</CardTitle>
        <div className="mt-2">
          <PhotoLightbox urls={dispute.evidenceUrls} />
        </div>
      </Card>

      <Card>
        <CardTitle>Resolve dispute</CardTitle>
        <div className="mt-3">
          <ResolveForm disputeId={dispute.id} />
        </div>
      </Card>
    </div>
  );
}
