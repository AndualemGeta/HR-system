export type TableColumn<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
};

export function DataTable<T extends object>({
  columns,
  rows
}: Readonly<{ columns: TableColumn<T>[]; rows: T[] }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="empty-cell" colSpan={columns.length}>No records to show.</td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowKey(row, rowIndex)}>
                {columns.map((column) => (
                  <td key={String(column.key)}>
                    {column.render ? column.render(row) : String(cellValue(row, column.key) ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function rowKey<T extends object>(row: T, rowIndex: number): string {
  if ("id" in row) {
    return String((row as { id?: unknown }).id ?? rowIndex);
  }

  return String(rowIndex);
}

function cellValue<T extends object>(row: T, key: keyof T | string): unknown {
  if (key in row) {
    return row[key as keyof T];
  }

  return "";
}
