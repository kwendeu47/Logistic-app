import { Badge } from "../../../components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "../../../components/ui/table";
import { prisma } from "../../../lib/prisma";
import { KycRowActions } from "./kyc-row-actions";

export const dynamic = "force-dynamic";

export default async function KycPage() {
  const users = await prisma.user.findMany({
    where: {
      isIdVerified: false,
      kycStatus: { in: ["PENDING", "REQUIRES_INPUT"] },
    },
    orderBy: { kycSubmittedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">KYC verification queue</h1>
      <Table>
        <THead>
          <TR>
            <TH>User</TH>
            <TH>Email</TH>
            <TH>Submitted</TH>
            <TH>Stripe result</TH>
            <TH>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {users.map((user) => (
            <TR key={user.id}>
              <TD>{user.firstName} {user.lastName}</TD>
              <TD>{user.email}</TD>
              <TD>{user.kycSubmittedAt?.toLocaleDateString() ?? "—"}</TD>
              <TD>
                <Badge variant={user.kycStatus === "REQUIRES_INPUT" ? "warning" : "neutral"}>
                  {user.kycStatus}
                </Badge>
              </TD>
              <TD>
                <KycRowActions userId={user.id} />
              </TD>
            </TR>
          ))}
          {users.length === 0 && (
            <TR>
              <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                No pending KYC submissions
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
    </div>
  );
}
