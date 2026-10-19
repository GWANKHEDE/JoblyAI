import type { Metadata } from "next";
import "./globals.css";
import PwaRegister from "./pwa-register";

export const metadata: Metadata = {
  title: "JoblyAI | Your career space",
  description: "A private job search and career preparation workspace.",
  applicationName: "JoblyAI",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "JoblyAI" },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
