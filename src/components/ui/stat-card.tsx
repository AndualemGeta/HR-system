export function StatCard({
  label,
  value,
  meta
}: Readonly<{ label: string; value: string | number; meta: string }>) {
  return (
    <section className="card stat-card">
      <span className="label">{label}</span>
      <strong className="value">{value}</strong>
      <span className="meta">{meta}</span>
    </section>
  );
}

