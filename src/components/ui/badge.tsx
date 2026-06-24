type BadgeTone = "green" | "blue" | "amber" | "red" | "neutral";

export function Badge({ children, tone = "neutral" }: Readonly<{ children: React.ReactNode; tone?: BadgeTone }>) {
  return <span className={`badge ${tone === "neutral" ? "" : tone}`}>{children}</span>;
}

