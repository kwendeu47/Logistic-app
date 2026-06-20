import { notFound } from "next/navigation";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardTitle } from "../../../../components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "../../../../components/ui/table";
import { prisma } from "../../../../lib/prisma";
import { UserActions } from "./user-actions";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const [user, bookingsAsSender, bookingsAsTraveler, trustScoreHistory] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    prisma.booking.findMany({ where: { senderId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.booking.findMany({ where: { travelerId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.adminAuditLog.findMany({
      where: { targetId: params.id, action: "ADJUST_TRUST_SCORE" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) {
    notFound();
  }

  const bookings = [...bookingsAsSender, ...bookingsAsTraveler].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{user.firstName} {user.lastName}</h1>
        {user.isSuspended ? <Badge variant="danger">Suspended</Badge> : <Badge variant="success">Active</Badge>}
      </div>

      <Card>
        <CardTitle>Profile</CardTitle>
        <p className="mt-2 text-sm">Email: {user.email}</p>
        <p className="text-sm">Phone: {user.phone ?? "—"}</p>
        <p className="text-sm">Role: {user.role}</p>
        <p className="text-sm">Trust score: {user.trustScore.toFixed(1)}</p>
        <p className="text-sm">KYC status: {user.kycStatus}</p>
        <div className="mt-3">
          <UserActions userId={user.id} isSuspended={user.isSuspended} trustScore={user.trustScore} />
        </div>
      </Card>

      <Card>
        <CardTitle>Trust score history</CardTitle>
        <ul className="mt-2 space-y-1 text-sm">
          {trustScoreHistory.map((entry) => {
            const metadata = entry.metadata as { previousScore?: number; newScore?: number; reason?: string } | null;
            return (
              <li key={entry.id}>
                {entry.createdAt.toLocaleString()}: {metadata?.previousScore} → {metadata?.newScore} ({metadata?.reason})
              </li>
            );
          })}
          {trustScoreHistory.length === 0 && <li className="text-muted-foreground">No adjustments recorded</li>}
        </ul>
      </Card>

      <Card>
        <CardTitle>All bookings</CardTitle>
        <div className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Booking</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Total</TH>
              </TR>
            </THead>
            <TBody>
              {bookings.map((booking) => (
                <TR key={booking.id}>
                  <TD className="font-mono text-xs">{booking.id.slice(0, 8)}</TD>
                  <TD>{booking.senderId === user.id ? "Sender" : "Traveler"}</TD>
                  <TD><Badge variant="neutral">{booking.status}</Badge></TD>
                  <TD>${booking.totalPriceUsd.toFixed(2)}</TD>
                </TR>
              ))}
              {bookings.length === 0 && (
                <TR>
                  <TD colSpan={4} className="py-6 text-center text-muted-foreground">
                    No bookings yet
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
