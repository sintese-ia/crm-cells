import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "./_components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  const isAdmin = role === "admin";

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen flex bg-[#F2F0EC]">
      <Sidebar
        user={{ name: session.user.name, email: session.user.email }}
        isAdmin={isAdmin}
        signOutAction={signOutAction}
      />
      <main className="flex-1 overflow-auto pt-12 lg:pt-0">{children}</main>
    </div>
  );
}
