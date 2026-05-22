import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Cells CRM",
  description: "CRM B2B Cells",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full font-sans bg-zinc-50 text-zinc-900">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
