import { Badge } from "@/components/ui/badge";
import { DataTable, type TableColumn } from "@/components/ui/data-table";

export type ModuleMetric = {
  label: string;
  value: string;
  tone?: "green" | "blue" | "amber" | "red" | "neutral";
};

export type ModuleItem = {
  id: string;
  primary: string;
  secondary: string;
  status: string;
  owner: string;
  updated: string;
};

const columns: TableColumn<ModuleItem>[] = [
  { key: "primary", header: "Record" },
  { key: "secondary", header: "Scope" },
  {
    key: "status",
    header: "Status",
    render: (row) => <Badge tone={badgeTone(row.status)}>{row.status}</Badge>
  },
  { key: "owner", header: "Owner" },
  { key: "updated", header: "Updated" }
];

export function ModulePage({
  title,
  description,
  metrics,
  items,
  actions
}: Readonly<{
  title: string;
  description: string;
  metrics: ModuleMetric[];
  items: ModuleItem[];
  actions?: React.ReactNode;
}>) {
  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {actions && <div className="toolbar">{actions}</div>}
      </header>
      <div className="grid three" style={{ marginBottom: 16 }}>
        {metrics.map((metric) => (
          <div className="mini-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong style={{ marginTop: 6, fontSize: 24 }}>{metric.value}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-header">
          <h3>{title}</h3>
          <span>{items.length} records</span>
        </div>
        <DataTable columns={columns} rows={items} />
      </section>
    </>
  );
}

function badgeTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("approved") || normalized.includes("active") || normalized.includes("complete")) return "green";
  if (normalized.includes("review") || normalized.includes("pending")) return "amber";
  if (normalized.includes("blocked") || normalized.includes("overdue") || normalized.includes("terminated")) return "red";
  if (normalized.includes("draft") || normalized.includes("configured")) return "blue";
  return "neutral";
}
