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
        <div className="fixed inset-0 z-[-1]">
          <div className="absolute inset-0 bg-[url('/bg.png')] bg-cover bg-center bg-no-repeat" />
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
        </div>
        <div className="h-full relative">
          <div className="hidden h-full md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-[80] bg-gray-900">
            <Sidebar />
          </div>
          <main className="md:pl-64 h-full min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
