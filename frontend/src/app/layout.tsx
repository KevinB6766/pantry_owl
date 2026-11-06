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
  themeColor: "#9d2235",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main>{children}</main>
        <footer className="site-footer">
          <p>Pantry Owl · Food, care, and community.</p>
          <div className="site-footer-links">
            <a href="/">Browse pantry</a>
            <a href="/locations">Find a location</a>
            <a href="/list">Your pickup list</a>
          </div>
        </footer>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
