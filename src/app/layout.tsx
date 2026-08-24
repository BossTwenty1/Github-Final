import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "GraveNav | Cemetery navigation",
  description: "Find a gravesite and navigate memorial grounds with GraveNav.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--canvas)] antialiased">{children}</body>
    </html>
  );
}
