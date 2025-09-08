// app/layout.tsx
import "./globals.css";
import SWRegister from "./_components/SWRegister";

export const metadata = {
  title: "Royal",
  description: "Sistema de ventas Royal",
  // PWA
  manifest: "/manifest.json",
  themeColor: "#059669",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  // Mobile viewport
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-slate-100 antialiased">
        {/* Registra el Service Worker para PWA */}
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
