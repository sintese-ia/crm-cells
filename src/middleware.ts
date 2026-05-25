import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Mapa de rotas antigas removidas → nova rota equivalente
// (mantém bookmarks/links velhos funcionando)
const REDIRECTS_LEGACY: Record<string, string> = {
  "/fila": "/acoes",
  "/equipe": "/acoes",
  "/pipeline": "/funil",
  "/agenda": "/acoes",
  "/compradores": "/buscar",
  "/contas": "/funil",
  "/dashboard": "/acoes",
  "/pulso": "/acoes",
  "/homologacoes": "/funil",
  "/importar": "/acoes",
};

export default auth((req) => {
  const isAuthed = !!req.auth?.user;
  const pathname = req.nextUrl.pathname;
  const isLogin = pathname === "/login";

  // Redirect rotas legacy → novas
  if (REDIRECTS_LEGACY[pathname]) {
    const url = req.nextUrl.clone();
    url.pathname = REDIRECTS_LEGACY[pathname];
    return NextResponse.redirect(url);
  }

  if (!isAuthed && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
