import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Verify Inter font is available or use generic
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MIR Attendance",
  description: "Automated attendance tracking",
  icons: "/mir-logo.png",

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="h-full relative">
          <div className="hidden h-full md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-[80] bg-gray-900">
            <Sidebar />
          </div>
          <main className="md:pl-64 h-full bg-slate-100 min-h-screen relative overflow-hidden">
            {/* Background Logo */}
            <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mir-logo.png" alt="Logo" className="w-[800px] h-auto object-contain" />
            </div>

            {/* Content */}
            <div className="relative z-10 h-full">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
