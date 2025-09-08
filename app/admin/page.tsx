// app/admin/page.tsx
import Link from "next/link";

type Item = { label: string; desc: string; href: string; initial: string };

const ITEMS: Item[] = [
  { label: "Clientes",            desc: "Gestión de clientes",                 href: "/admin/clients",         initial: "C" },
  { label: "Vendedores",          desc: "Altas y comisiones",                  href: "/admin/sellers",         initial: "V" },
  { label: "Proveedores",         desc: "Altas y servicios ",                  href: "/admin/suppliers",       initial: "S" },
  { label: "Alianzas",            desc: "Comisiones por alianza",              href: "/admin/alliances",       initial: "A" },
  { label: "Plan financiación",   desc: "Cuotas y planes",                     href: "/admin/financing",       initial: "F" },
  { label: "Productos",           desc: "Catálogo y stock",                    href: "/admin/products",        initial: "P" },
  { label: "Órdenes de compra",   desc: "Compras y proveedores",               href: "/admin/orders",          initial: "O" },
  { label: "Reportes",            desc: "Ventas y comisiones",                 href: "/admin/reports",         initial: "R" },
];

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      {/* Encabezado */}
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Royal Panel</h1>
        <p className="mt-1 text-sm text-gray-600">Elegí un módulo para continuar.</p>
      </header>

      {/* Grid de tarjetas negras, estilo sobrio */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ITEMS.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className="group block rounded-2xl border border-neutral-800 bg-black p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 select-none items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm font-semibold">
                {it.initial}
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-medium">{it.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm text-white/70">{it.desc}</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-white/60">
              <span>Entrar</span>
              <span className="translate-x-0 transition group-hover:translate-x-0.5">→</span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
