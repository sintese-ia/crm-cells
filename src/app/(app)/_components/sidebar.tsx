"use client";
import Link from "next/link";
import { useState } from "react";
import { Users, Kanban, LayoutDashboard, Upload, LogOut, UsersRound, Settings, UserCircle, Calendar, Menu, X, ShieldCheck, Zap } from "lucide-react";

const NAV = [
  { href: "/fila", label: "Fila do Dia", icon: Zap },
  { href: "/equipe", label: "Equipe (lista)", icon: UsersRound },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/contas", label: "Contas", icon: Users },
  { href: "/compradores", label: "Compradores", icon: UserCircle },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/homologacoes", label: "Homologações", icon: ShieldCheck },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/importar", label: "Importar", icon: Upload },
];

export function Sidebar({
  user,
  isAdmin,
  signOutAction,
}: {
  user: { name?: string | null; email?: string | null };
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 bg-[#0D0D0D] text-white p-2 rounded-md shadow"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay mobile */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        bg-[#0D0D0D] text-[#F2F0EC] p-5 flex flex-col w-60 z-50
        fixed lg:static h-full
        transition-transform
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden absolute top-3 right-3 text-[#6B6B6B] hover:text-white"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>

        <Link href="/equipe" className="flex items-center gap-2.5 mb-10" onClick={() => setOpen(false)}>
          <div className="w-9 h-9 rounded-md bg-[#D4541A] flex items-center justify-center font-bold text-white" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
            C
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              CELLS · CRM
            </div>
            <div className="text-[10px] text-[#6B6B6B] uppercase tracking-wider">B2B operação</div>
          </div>
        </Link>

        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
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
              <Link href="/admin/cadencias" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#1A1A1A] text-sm transition-colors">
                <Settings className="w-4 h-4" /> Cadências
              </Link>
              <Link href="/admin/atividade" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#1A1A1A] text-sm transition-colors">
                <Users className="w-4 h-4" /> Atividade equipe
              </Link>
            </div>
          )}
        </nav>

        <div className="border-t border-[#2A2A2A] pt-4">
          <div className="text-[10px] text-[#6B6B6B] uppercase tracking-wider mb-1">Logado como</div>
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-[10px] text-[#6B6B6B] mb-3 truncate">
            {user.email}
            {isAdmin && <span className="ml-1 text-[#D4541A]">· admin</span>}
          </div>
          <form action={signOutAction}>
            <button className="text-xs text-[#6B6B6B] hover:text-[#F2F0EC] flex items-center gap-1.5 transition-colors">
              <LogOut className="w-3 h-3" /> sair
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
