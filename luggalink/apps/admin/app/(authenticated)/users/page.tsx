import Link from "next/link";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "../../../components/ui/table";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = searchParams.q?.trim() ?? "";

  const users = query
    ? await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 50,
      })
    : await prisma.user.findMany({ take: 20, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <form className="max-w-sm">
        <Input name="q" placeholder="Search by email or phone" defaultValue={query} />
      </form>
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH>Trust score</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {users.map((user) => (
            <TR key={user.id} className="cursor-pointer hover:bg-muted">
              <TD>
                <Link href={`/users/${user.id}`} className="underline">
                  {user.firstName} {user.lastName}
                </Link>
              </TD>
              <TD>{user.email}</TD>
              <TD>{user.role}</TD>
              <TD>{user.trustScore.toFixed(1)}</TD>
              <TD>
                {user.isSuspended ? <Badge variant="danger">Suspended</Badge> : <Badge variant="success">Active</Badge>}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
