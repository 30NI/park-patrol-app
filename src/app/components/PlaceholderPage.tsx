export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-slate-600">{description}</p>
      </header>

      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-bold">Coming next</p>
        <p className="mt-2 text-sm text-slate-600">
          This section will use the same patrol log and mobile layout.
        </p>
      </section>
    </main>
  );
}
