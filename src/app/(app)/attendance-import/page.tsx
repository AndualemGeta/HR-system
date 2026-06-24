import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function AttendanceImportPage() {
  await requirePagePermission("attendance.import");
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Attendance Import Preview</h2><p>Use /api/attendance-import to preview CSV/XLSX-normalized rows before commit. Unknown employees, duplicates, invalid dates, and missing statuses are flagged.</p></div><Badge tone="amber">Preview only</Badge></header>
      <section className="panel"><h3>Required columns</h3><p>Employee ID, Date, Status, Check In, Check Out, Hours Worked, Overtime Hours.</p></section>
    </>
  );
}
