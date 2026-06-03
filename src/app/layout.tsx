import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Stock Analyst",
  description: "Prywatna aplikacja do monitorowania i analizy giełdy USA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
