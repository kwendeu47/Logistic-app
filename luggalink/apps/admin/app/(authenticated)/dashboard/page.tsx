import { startOfMonth, subDays } from "date-fns";
import { prisma } from "../../../lib/prisma";
import { Card, CardTitle, CardValue } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "../../../components/ui/table";
import { BookingsChart } from "./bookings-chart";

export const dynamic = "force-dynamic";

async function getMetrics() {
  const monthStart = startOfMonth(new Date());
  const thirtyDaysAgo = subDays(new Date(), 30);

  const [gmvResult, activeTrips, openDisputes, kycPending, recentBookings, bookingsLast30] = await Promise.all([
    prisma.booking.aggregate({
      _sum: { totalPriceUsd: true },
      where: { createdAt: { gte: monthStart } },
    }),
    prisma.trip.count({ where: { status: "ACTIVE" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    prisma.user.count({ where: { kycStatus: "PENDING" } }),
    prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { sender: true, traveler: true },
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
  ]);

  const dayBuckets = new Map<string, number>();
  for (let i = 29; i >= 0; i -= 1) {
    const key = subDays(new Date(), i).toISOString().slice(0, 10);
    dayBuckets.set(key, 0);
  }
  for (const booking of bookingsLast30) {
    const key = booking.createdAt.toISOString().slice(0, 10);
    dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
  }
  const chartData = Array.from(dayBuckets.entries()).map(([date, count]) => ({ date, count }));

  return {
    gmv: gmvResult._sum.totalPriceUsd ?? 0,
    activeTrips,
    openDisputes,
    kycPending,
    recentBookings,
    chartData,
  };
}

export default async function DashboardPage() {
  const metrics = await getMetrics();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardTitle>GMV this month</CardTitle>
          <CardValue>${metrics.gmv.toFixed(2)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Active trips</CardTitle>
          <CardValue>{metrics.activeTrips}</CardValue>
        </Card>
        <Card>
          <CardTitle>Open disputes</CardTitle>
          <CardValue>{metrics.openDisputes}</CardValue>
        </Card>
        <Card>
          <CardTitle>KYC pending</CardTitle>
          <CardValue>{metrics.kycPending}</CardValue>
        </Card>
      </div>

      <Card>
        <CardTitle>Bookings per day (last 30 days)</CardTitle>
        <div className="mt-4 h-64">
          <BookingsChart data={metrics.chartData} />
        </div>
      </Card>

      <Card>
        <CardTitle>Recent bookings</CardTitle>
        <div className="mt-3">
          <Table>
            <THead>
              <TR>
                <TH>Booking</TH>
                <TH>Sender</TH>
                <TH>Traveler</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {metrics.recentBookings.map((booking) => (
                <TR key={booking.id}>
                  <TD className="font-mono text-xs">{booking.id.slice(0, 8)}</TD>
                  <TD>{booking.sender.firstName} {booking.sender.lastName}</TD>
                  <TD>{booking.traveler.firstName} {booking.traveler.lastName}</TD>
                  <TD>
                    <Badge variant="neutral">{booking.status}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
