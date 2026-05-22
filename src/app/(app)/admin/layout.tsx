import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings, Activity } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "admin") redirect("/hoje");

  return (
    <div>
      <header className="bg-white border-b border-[#E5E2DC] px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#D4541A]" />
            <h1 className="text-lg font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              Admin
            </h1>
          </div>
          <nav className="flex gap-1 ml-6">
            <Link href="/admin/cadencias" className="text-sm px-3 py-1.5 rounded-md hover:bg-[#F2F0EC]">
              ⚙️ Cadências
            </Link>
            <Link href="/admin/atividade" className="text-sm px-3 py-1.5 rounded-md hover:bg-[#F2F0EC] flex items-center gap-1">
              <Activity className="w-3 h-3" /> Atividade da equipe
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
