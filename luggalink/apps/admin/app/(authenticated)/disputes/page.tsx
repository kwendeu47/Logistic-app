import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { Badge } from "../../../components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "../../../components/ui/table";

export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const disputes = await prisma.dispute.findMany({
    where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
    orderBy: { createdAt: "desc" },
    include: {
      booking: { include: { sender: true, traveler: true } },
      openedBy: true,
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Open disputes</h1>
      <Table>
        <THead>
          <TR>
            <TH>Booking</TH>
            <TH>Reason</TH>
            <TH>Opened</TH>
            <TH>Sender</TH>
            <TH>Traveler</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {disputes.map((dispute) => (
            <TR key={dispute.id} className="cursor-pointer hover:bg-muted">
              <TD>
                <Link href={`/disputes/${dispute.id}`} className="font-mono text-xs underline">
                  {dispute.bookingId.slice(0, 8)}
                </Link>
              </TD>
              <TD>{dispute.reason}</TD>
              <TD>{dispute.createdAt.toLocaleDateString()}</TD>
              <TD>{dispute.booking.sender.firstName} {dispute.booking.sender.lastName}</TD>
              <TD>{dispute.booking.traveler.firstName} {dispute.booking.traveler.lastName}</TD>
              <TD><Badge variant="warning">{dispute.status}</Badge></TD>
            </TR>
          ))}
          {disputes.length === 0 && (
            <TR>
              <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                No open disputes
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
    </div>
  );
}
