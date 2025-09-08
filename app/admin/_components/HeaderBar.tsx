"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function HeaderBar() {
  const pathname = usePathname();
  const router = useRouter();
  const showBack = pathname !== "/admin";

  return (
    <div className="sticky top-0 z-40 w-full border-b border-zinc-800/60 bg-[#0b0f0c]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-emerald-300 hover:bg-emerald-600/20"
              title="Volver"
            >
              ← Volver
            </button>
          )}
          <Link href="/admin" className="font-semibold tracking-tight text-emerald-300">
            Royal • Admin
          </Link>
          <span className="text-xs text-zinc-500">panel</span>
        </div>
        <nav className="hidden gap-4 sm:flex">
          <Link href="/admin/clients" className="text-sm text-zinc-300 hover:text-white">Clientes</Link>
          <Link href="/admin/sellers" className="text-sm text-zinc-300 hover:text-white">Vendedores</Link>
          <Link href="/admin/alliances" className="text-sm text-zinc-300 hover:text-white">Alianzas</Link>
          <Link href="/admin/products" className="text-sm text-zinc-300 hover:text-white">Productos</Link>
          <Link href="/admin/orders" className="text-sm text-zinc-300 hover:text-white">Órdenes</Link>
          <Link href="/admin/reports" className="text-sm text-zinc-300 hover:text-white">Reportes</Link>
          <Link href="/admin/financing" className="text-sm text-zinc-300 hover:text-white">Financiación</Link>
        </nav>
      </div>
    </div>
  );
}
