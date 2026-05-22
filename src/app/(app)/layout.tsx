import Link from "next/link";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { Users, Kanban, LayoutDashboard, Upload, LogOut, UsersRound, Settings } from "lucide-react";

const NAV = [
  { href: "/equipe", label: "Equipe", icon: UsersRound },
  { href: "/contas", label: "Contas", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/importar", label: "Importar", icon: Upload },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  const isAdmin = role === "admin";

  return (
    <div className="min-h-screen flex bg-[#F2F0EC]">
      <aside className="w-60 bg-[#0D0D0D] text-[#F2F0EC] p-5 flex flex-col">
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-md bg-[#D4541A] flex items-center justify-center font-bold text-white" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
            C
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              CELLS · CRM
            </div>
            <div className="text-[10px] text-[#6B6B6B] uppercase tracking-wider">B2B operação</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 flex-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#1A1A1A] text-sm transition-colors"
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
          {isAdmin && (
            <div className="mt-6 pt-3 border-t border-[#2A2A2A]">
              <div className="text-[10px] text-[#6B6B6B] uppercase tracking-wider px-3 mb-1">Admin</div>
              <Link href="/admin/cadencias" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#1A1A1A] text-sm transition-colors">
                <Settings className="w-4 h-4" /> Cadências
              </Link>
              <Link href="/admin/atividade" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#1A1A1A] text-sm transition-colors">
                <Users className="w-4 h-4" /> Atividade equipe
              </Link>
            </div>
          )}
        </nav>
        <div className="border-t border-[#2A2A2A] pt-4">
          <div className="text-[10px] text-[#6B6B6B] uppercase tracking-wider mb-1">Logado como</div>
          <div className="text-sm font-medium">{session.user.name}</div>
          <div className="text-[10px] text-[#6B6B6B] mb-3">
            {session.user.email}
            {isAdmin && <span className="ml-1 text-[#D4541A]">· admin</span>}
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-xs text-[#6B6B6B] hover:text-[#F2F0EC] flex items-center gap-1.5 transition-colors">
              <LogOut className="w-3 h-3" /> sair
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
