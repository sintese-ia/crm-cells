import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const USUARIOS = [
  { id: "gabriel", nome: "Gabriel", email: "gabriel@cells.com.br", senha: "cells2026" },
  { id: "yasmin", nome: "Yasmin", email: "yas@cells.com.br", senha: "cells2026" },
  { id: "gabi", nome: "Gabi", email: "gabi@cells.com.br", senha: "cells2026" },
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
        const u = USUARIOS.find(
          (x) =>
            x.email === String(creds?.email || "").toLowerCase() &&
            x.senha === String(creds?.senha || "")
        );
        if (!u) return null;
        return { id: u.id, name: u.nome, email: u.email };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId) (session.user as { id?: string }).id = String(token.userId);
      return session;
    },
  },
});
