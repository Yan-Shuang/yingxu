import type { Metadata } from "next";
import { AuthProvider } from "@/components/product/AuthProvider";
import AppShell from "@/components/AppShell";
import { BRAND } from "@/config/brand";
import "./globals.css";
import "./product.css";

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
  icons: { icon: '/brand.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className="antialiased"
      >
        <AuthProvider><AppShell>{children}</AppShell></AuthProvider>
      </body>
    </html>
  );
}
