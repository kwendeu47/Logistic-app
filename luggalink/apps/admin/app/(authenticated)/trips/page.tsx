import { Badge } from "../../../components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "../../../components/ui/table";
import { prisma } from "../../../lib/prisma";
import { TripRowActions } from "./trip-row-actions";

export const dynamic = "force-dynamic";

const LOW_PRICE_PER_LB_USD = 2;

function isSameDayListing(trip: { createdAt: Date; departureDate: Date }): boolean {
  return trip.createdAt.toDateString() === trip.departureDate.toDateString();
}

export default async function TripsPage() {
  const trips = await prisma.trip.findMany({
    where: { status: { in: ["DRAFT", "ACTIVE"] } },
    orderBy: [{ isFlagged: "desc" }, { createdAt: "desc" }],
    include: { traveler: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Trip moderation</h1>
      <Table>
        <THead>
          <TR>
            <TH>Traveler</TH>
            <TH>Route</TH>
            <TH>Price/lb</TH>
            <TH>Departure</TH>
            <TH>Flags</TH>
            <TH>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {trips.map((trip) => {
            const heuristicFlags: string[] = [];
            if (trip.pricePerLb < LOW_PRICE_PER_LB_USD) heuristicFlags.push("Price too low");
            if (isSameDayListing(trip)) heuristicFlags.push("Same-day listing");

            return (
              <TR key={trip.id}>
                <TD>{trip.traveler.firstName} {trip.traveler.lastName}</TD>
                <TD>{trip.originIataCode} → {trip.destinationIataCode}</TD>
                <TD>${trip.pricePerLb.toFixed(2)}</TD>
                <TD>{trip.departureDate.toLocaleDateString()}</TD>
                <TD className="space-x-1">
                  {trip.isFlagged && <Badge variant="danger">{trip.flagReason ?? "Flagged"}</Badge>}
                  {heuristicFlags.map((flag) => (
                    <Badge key={flag} variant="warning">{flag}</Badge>
                  ))}
                </TD>
                <TD>
                  <TripRowActions tripId={trip.id} />
                </TD>
              </TR>
            );
          })}
          {trips.length === 0 && (
            <TR>
              <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                No trips to moderate
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
    </div>
  );
}
