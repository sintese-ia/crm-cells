"use client";
import Link from "next/link";
import { useState } from "react";
import { LogOut, Menu, X, Zap, Kanban, Search } from "lucide-react";

const NAV = [
  { href: "/acoes", label: "Minhas ações", icon: Zap },
  { href: "/funil", label: "Funil", icon: Kanban },
  { href: "/buscar", label: "Buscar", icon: Search },
];

export function Sidebar({
  user,
  signOutAction,
}: {
  user: { name?: string | null; email?: string | null };
  isAdmin?: boolean;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 bg-[#0D0D0D] text-white p-2 rounded-md shadow"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
      )}

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

        <Link href="/acoes" className="flex items-center gap-2.5 mb-10" onClick={() => setOpen(false)}>
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
        </nav>

        <div className="border-t border-[#2A2A2A] pt-4">
          <div className="text-[10px] text-[#6B6B6B] uppercase tracking-wider mb-1">Logado</div>
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-[10px] text-[#6B6B6B] mb-3 truncate">{user.email}</div>
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
