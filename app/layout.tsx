import type { Metadata } from "next";

import "./globals.css";
import { UserProvider } from "./contexts/UserContext";

export const metadata: Metadata = {
  title: "FarmCoop | Growing stronger together",
  description: "A cooperative platform for farmers to access services, support, and financing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <UserProvider>
        <body className="min-h-full flex flex-col">{children}</body>
      </UserProvider>
    </html>
  );
}
