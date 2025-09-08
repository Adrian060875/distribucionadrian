import "../globals.css";
import HeaderBar from "./_components/HeaderBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-[#0b0f0c] text-zinc-100 min-h-screen">
        <HeaderBar />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mt-10 border-t border-zinc-800/60">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-zinc-400">
            © {new Date().getFullYear()} Royal — Panel interno
          </div>
        </footer>
      </body>
    </html>
  );
}
