import { Plus, Trash2 } from "lucide-react";
import type { TableData } from "@/lib/workspaceTypes";

const EMPTY_TABLE: TableData = { headers: ["Coluna 1", "Coluna 2"], rows: [["", ""]] };

export function TableBlock({ table, onChange }: { table: TableData | undefined; onChange: (table: TableData) => void }) {
  const data = table ?? EMPTY_TABLE;

  function updateHeader(colIndex: number, value: string) {
    const headers = [...data.headers];
    headers[colIndex] = value;
    onChange({ ...data, headers });
  }
  function updateCell(rowIndex: number, colIndex: number, value: string) {
    const rows = data.rows.map((r) => [...r]);
    rows[rowIndex][colIndex] = value;
    onChange({ ...data, rows });
  }
  function addColumn() {
    onChange({ headers: [...data.headers, `Coluna ${data.headers.length + 1}`], rows: data.rows.map((r) => [...r, ""]) });
  }
  function addRow() {
    onChange({ ...data, rows: [...data.rows, data.headers.map(() => "")] });
  }
  function removeColumn(colIndex: number) {
    if (data.headers.length <= 1) return;
    onChange({
      headers: data.headers.filter((_, i) => i !== colIndex),
      rows: data.rows.map((r) => r.filter((_, i) => i !== colIndex)),
    });
  }
  function removeRow(rowIndex: number) {
    onChange({ ...data, rows: data.rows.filter((_, i) => i !== rowIndex) });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/40">
            {data.headers.map((h, ci) => (
              <th key={ci} className="group/col relative border-b border-border p-0">
                <input
                  value={h}
                  onChange={(e) => updateHeader(ci, e.target.value)}
                  className="w-full bg-transparent px-3 py-2 text-xs font-semibold text-left outline-none"
                />
                {data.headers.length > 1 && (
                  <button
                    onClick={() => removeColumn(ci)}
                    className="hidden group-hover/col:flex absolute -top-2 right-1 h-4 w-4 items-center justify-center rounded-full bg-destructive text-white text-[10px] leading-none"
                  >
                    ×
                  </button>
                )}
              </th>
            ))}
            <th className="w-8 border-b border-border">
              <button onClick={addColumn} className="h-6 w-6 grid place-items-center rounded hover:bg-accent text-muted-foreground mx-auto">
                <Plus className="h-3 w-3" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} className="group/row hover:bg-accent/20">
              {row.map((cell, ci) => (
                <td key={ci} className="border-b border-border">
                  <input
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                    className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                  />
                </td>
              ))}
              <td className="border-b border-border w-8">
                <button
                  onClick={() => removeRow(ri)}
                  className="hidden group-hover/row:flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground mx-auto"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addRow}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:bg-accent/30 border-t border-border transition-colors"
      >
        <Plus className="h-3 w-3" />
        Nova linha
      </button>
    </div>
  );
}
