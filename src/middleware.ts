import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const isAuthed = !!req.auth?.user;
  const pathname = req.nextUrl.pathname;
  const isLogin = pathname === "/login";
  const isAdmin = pathname.startsWith("/admin");

  if (!isAuthed && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (
    isAuthed &&
    isAdmin &&
    (req.auth?.user as { role?: string })?.role !== "admin"
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/fila";
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
