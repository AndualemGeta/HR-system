import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leapfrog HR Management",
  description: "Secure role-based HR management system for Leapfrog Software Technology Africa PLC"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

