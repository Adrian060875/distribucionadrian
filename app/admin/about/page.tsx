export const metadata = { title: "Royal — Acerca de" };
export default function About() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Royal</h1>
      <p className="text-zinc-400">Sistema de ventas y gestión. Panel Admin &middot; Next.js.</p>
      <div className="mt-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6">
        <ul className="list-disc pl-6 text-sm text-zinc-300">
          <li>Clientes, Vendedores, Alianzas, Productos y Órdenes</li>
          <li>Reportes básicos</li>
          <li>Diseño oscuro. Tipografía sistema.</li>
        </ul>
      </div>
    </main>
  );
}