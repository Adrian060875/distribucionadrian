// app/admin/page.tsx
import Link from "next/link";

type Tile = {
  label: string;
  desc: string;
  href: string;
  initial: string;
};

const tiles: Tile[] = [
  { label: "Ã“rdenes", desc: "gestiÃ³n de pedidos", href: "/admin/orders", initial: "O" },
  { label: "Productos", desc: "catÃ¡logo", href: "/admin/products", initial: "P" },
  { label: "Reportes", desc: "ingresos/egresos/pagos", href: "/admin/reports", initial: "R" },
  { label: "Financiamiento", desc: "planes y simulador", href: "/admin/financing", initial: "F" },
 { label: "Clientes", desc: "agenda", href: "/admin/clients", initial: "C" },
  { label: "Vendedores", desc: "equipo comercial", href: "/admin/sellers", initial: "V" },
  { label: "Alianzas", desc: "referidos/partners", href: "/admin/alliances", initial: "A" },
];

export default function AdminHome() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-white mb-6">Panel Admin</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5 hover:bg-zinc-900"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl border border-zinc-700 flex items-center justify-center text-zinc-300">
                {t.initial}
              </div>
              <div>
                <div className="text-white font-medium">{t.label}</div>
                <div className="text-xs text-zinc-500">{t.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
