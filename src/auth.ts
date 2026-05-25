import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

type Role = "admin" | "operacional";

const USUARIOS: { id: string; nome: string; email: string; senha: string; role: Role }[] = [
  { id: "gabriel", nome: "Gabriel", email: "gabriel@cells.com.br", senha: "cells2026", role: "admin" },
  { id: "yasmin", nome: "Yasmin", email: "yasmin@cells.com.br", senha: "cells2026", role: "operacional" },
  { id: "gabi", nome: "Gabi", email: "gabrieli@cells.com.br", senha: "cells2026", role: "operacional" },
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      authorize: async (creds) => {
        // Sem senha: CRM interno, 3 usuários fixos, escopo restrito.
        // Email é suficiente pra identificar quem é.
        const email = String(creds?.email || "").toLowerCase().trim();
        const u = USUARIOS.find((x) => x.email === email);
        if (!u) return null;
        return { id: u.id, name: u.nome, email: u.email };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        const u = USUARIOS.find((x) => x.id === user.id);
        token.role = u?.role ?? "operacional";
        token.email = u?.email ?? user.email;
        token.name = u?.nome ?? user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        (session.user as { id?: string; role?: Role }).id = String(token.userId);
        (session.user as { id?: string; role?: Role }).role =
          (token.role as Role) ?? "operacional";
      }
      return session;
    },
  },
});

export const USUARIOS_INFO = USUARIOS.map((u) => ({ id: u.id, nome: u.nome, email: u.email, role: u.role }));
