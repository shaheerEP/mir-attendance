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
          <div className="hidden h-full md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-[80] bg-transparent">
            <Sidebar />
          </div>
          <main className="md:pl-64 h-full bg-transparent min-h-screen relative overflow-hidden">
            {/* Tiled Background Logos */}
            <div
              className="absolute inset-0 z-0 pointer-events-none opacity-10"
              style={{
                backgroundImage: 'url("/mir-logo.png")',
                backgroundSize: '100px auto',
                backgroundRepeat: 'repeat',
                filter: 'brightness(0.8) contrast(1.1) saturate(1.2)'
              }}
            />

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
