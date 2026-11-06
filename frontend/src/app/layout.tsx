import "./globals.css";
import type { Metadata, Viewport } from "next";
import NavBar from "@/components/NavBar";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: { default: "Pantry Owl", template: "%s · Pantry Owl" },
  description: "Browse the pantry, build a shopping list, and check out with a QR code.",
  applicationName: "Pantry Owl",
  appleWebApp: { capable: true, title: "Pantry Owl", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#1f4d3a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main>{children}</main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
