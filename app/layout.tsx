import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import { BottomNav } from "@/components/layout/bottom-nav";
import "./globals.css";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const headingFont = Barlow_Condensed({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "agNBA GM Simulator",
  description: "Mobile-first NBA GM simulator with game sim, roster management, and trades.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable} antialiased`}>
        <div className="relative min-h-screen pb-24">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(ellipse_at_top,_rgba(13,122,122,0.22),_rgba(230,95,43,0.08)_45%,_transparent_70%)]" />

          <header className="mx-auto w-full max-w-3xl px-4 pt-5">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-teal-700">agNBA</p>
              <p className="font-heading text-2xl text-slate-900">GM Simulator</p>
            </div>
          </header>

          <main className="mx-auto w-full max-w-3xl px-4 pb-6 pt-4">{children}</main>
        </div>

        <BottomNav />
      </body>
    </html>
  );
}
