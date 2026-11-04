import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata = { title: "Grocery", description: "A simple grocery site" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
