import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/disputes", label: "Disputes" },
  { href: "/kyc", label: "KYC" },
  { href: "/users", label: "Users" },
  { href: "/trips", label: "Trips" },
];

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <nav className="w-48 shrink-0 border-r border-border bg-muted p-4">
        <div className="mb-6 text-sm font-semibold">LuggaLink Admin</div>
        <ul className="space-y-1">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="block rounded-md px-2 py-1.5 text-sm hover:bg-background">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
