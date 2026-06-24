import Papa from "papaparse";
import ExcelJS from "exceljs";
import type { SourceRow } from "./validator";

export type ParsedWorkbook = {
  sheets: Array<{
    name: string;
    rows: SourceRow[];
    columns: string[];
  }>;
};

export async function parseHrFile(file: File): Promise<ParsedWorkbook> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === "csv") {
    const text = buffer.toString("utf8");
    const parsed = Papa.parse<SourceRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim()
    });

    return {
      sheets: [
        {
          name: "CSV",
          rows: parsed.data,
          columns: parsed.meta.fields ?? []
        }
      ]
    };
  }

  if (extension === "xlsx" || extension === "xls") {
    const workbook = new ExcelJS.Workbook();
    const xlsxBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(xlsxBuffer);
    return {
      sheets: workbook.worksheets.map((worksheet) => {
        const headerRow = worksheet.getRow(1);
        const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
        const columns = headerValues
          .map((value: ExcelJS.CellValue) => cellValueToString(value).trim())
          .filter(Boolean);

        const rows: SourceRow[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const record: SourceRow = {};
          columns.forEach((column: string, index: number) => {
            const cellValue = row.getCell(index + 1).value;
            record[column] = cellValueToString(cellValue);
          });
          if (Object.values(record).some((value) => String(value ?? "").trim() !== "")) {
            rows.push(record);
          }
        });

        return { name: worksheet.name, rows, columns };
      })
    };
  }

  throw new Error("Unsupported file type. Upload CSV, XLS, or XLSX.");
}

function cellValueToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);
  if ("text" in value && value.text) return String(value.text);
  if ("result" in value && value.result != null) return cellValueToString(value.result);
  if ("hyperlink" in value && value.hyperlink) return String(value.hyperlink);
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }
  return JSON.stringify(value);
}
