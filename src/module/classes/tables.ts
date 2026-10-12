/**
 * @file Per-level class tables (thief skills, turning undead…).
 */
export type Cell = number | string;

export interface ClassTable {
  key: string;
  label: string;
  // Headed by the key in capitals, name is the readable version.
  columns: { key: string; name?: string }[];
  // What cell values mean, e.g. "T" on a turning table; "#" covers any number.
  legend?: { value: string; text: string }[];
  // rows[i] is level i + 1, keyed by column key.
  rows: Record<string, Cell>[];
}

export const rowFor = (table: ClassTable, level: number) =>
  table.rows.length ? table.rows[Math.min(Math.max(Math.trunc(level) || 1, 1), table.rows.length) - 1] : undefined;

// `target` is "<tableKey>.<columnKey>", e.g. "skills.hs".
export const tableValue = (tables: ClassTable[], level: number, target: string): Cell | null => {
  const dot = (target ?? "").indexOf(".");
  if (dot < 1) return null;
  const table = tables.find((t) => t.key === target.slice(0, dot));
  const value = table ? rowFor(table, level)?.[target.slice(dot + 1)] : undefined;
  return value === undefined || value === null || value === "" ? null : value;
};

// A cell as a roll target: a number, or the top of a range such as "1–3" (on 1d6).
export const cellTarget = (cell: Cell | null | undefined): number | null => {
  if (typeof cell === "number") return cell;
  const m = /^\s*(?:\d+\s*[–-]\s*)?(\d+)\s*$/.exec(String(cell ?? ""));
  return m ? Number(m[1]) : null;
};

export const currentRows = (tables: ClassTable[], level: number) =>
  tables.flatMap((table) => {
    const row = rowFor(table, level);
    if (!row) return [];
    return [
      {
        key: table.key,
        label: table.label,
        cells: table.columns.map((c) => ({
          key: c.key,
          label: columnHeader(c.key),
          name: c.name || columnHeader(c.key),
          value: row[c.key],
        })),
      },
    ];
  });

// Current-level values for roll data: { tableKey: { columnKey: value } }.
export const tableRowValues = (tables: ClassTable[], level: number) =>
  Object.fromEntries(tables.flatMap((t) => (rowFor(t, level) ? [[t.key, { ...rowFor(t, level) }]] : [])));

// A renamed column key carries its values over.
export const renameColumnKeys = (current: ClassTable[], submitted: ClassTable[]): ClassTable[] =>
  submitted.map((table, t) => {
    const before = current[t]?.columns ?? [];
    const columns = table.columns.map((col, c) => {
      const old = before[c]?.key;
      const key = col.key.trim();
      const taken = table.columns.some((other, o) => o !== c && (before[o]?.key ?? other.key) === key);
      return { ...col, key: !old || (key && !taken) ? key || col.key : old };
    });
    const rows = table.rows.map((row) => {
      const out = { ...row };
      columns.forEach((col, c) => {
        const old = before[c]?.key;
        if (!old || old === col.key) return;
        out[col.key] = row[old];
        delete out[old];
      });
      return out;
    });
    return { ...table, columns, rows };
  });

// Values a legend could explain: the table's non-numeric cells, then "#" when it has numbers.
export const legendSuggestions = (table: Pick<ClassTable, "columns" | "rows">) => {
  const values = table.rows.flatMap((row) => table.columns.map((c) => String(row[c.key] ?? "").trim()));
  const codes = [...new Set(values.filter((v) => v && !/^\d+$/.test(v)))];
  return values.some((v) => /^\d+$/.test(v)) ? [...codes, "#"] : codes;
};

// The legend's explanation for a cell, if any.
export const cellHint = (legend: ClassTable["legend"], cell: Cell | null | undefined): string => {
  const value = String(cell ?? "").trim();
  if (!value || !legend) return "";
  const numeric = /^\d+$/.test(value);
  return legend.find((l) => l.value === value || (numeric && l.value === "#"))?.text ?? "";
};

// A column's header: its key in capitals, with a digit's "s" shown as the book's "*" (2s → 2*).
export const columnHeader = (key: string) => key.replace(/^(\d+)s$/i, "$1*").toUpperCase();

// Keys usable in a roll formula like @classTables.thief.skills.hs.
export const isFormulaKey = (key: string) => /^[\w-]+$/.test(key);

// The character's class whose table has the column, preferring classes the ability's requirements name.
export const findTargetClass = <T extends { key: string; tables?: ClassTable[] }>(
  classes: T[],
  target: string,
  prefer: string[] = [],
): T | undefined => {
  const [tableKey, column] = (target ?? "").split(".");
  if (!tableKey || !column) return undefined;
  const fits = classes.filter((c) =>
    c.tables?.some((t) => t.key === tableKey && t.columns.some((col) => col.key === column)),
  );
  return fits.find((c) => prefer.includes(c.key)) ?? fits[0];
};
