// app/page.tsx
export default function Home() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Inicio</h1>
      <p className="text-gray-600">Elegí una sección:</p>
      <div className="flex gap-3">
        <a
          href="/admin"
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Ir al panel de administración
        </a>
      </div>
    </div>
  );
}
