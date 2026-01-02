import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Verify Inter font is available or use generic
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RFID Attendance System",
  description: "Automated attendance tracking",
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
          <main className="md:pl-64 h-full bg-slate-100 min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
