/**
 * @file Class tables on the character: each column's current value and its values by level.
 */
import { type Cell, type ClassTable, cellTarget, rowFor } from "./tables";

export interface TableClass {
  id: string;
  name: string;
  level: number;
  tables: ClassTable[];
}

export interface TableColumn {
  current: Cell;
  levels: Cell[];
}

/** Every class table column as system.tables.<table>.<column>; a column two classes share uses the higher-level class. */
export const deriveTables = (classes: TableClass[]) => {
  const tables: Record<string, Record<string, TableColumn>> = {};
  const from: Record<string, { cls: string; name: string; level: number }> = {};
  const shared: { id: string; key: string; cls: string; other: string; used: string }[] = [];
  for (const cls of classes) {
    for (const table of cls.tables) {
      const row = rowFor(table, cls.level);
      if (!row) continue;
      for (const { key, name } of table.columns) {
        const cell = row[key];
        if (cell === undefined || cell === null || cell === "") continue;
        const path = `${table.key}.${key}`;
        const seen = from[path];
        if (seen)
          shared.push({
            id: cls.id,
            key: path,
            cls: cls.name,
            other: seen.cls,
            used: cls.level > seen.level ? cls.name : seen.cls,
          });
        if (seen && cls.level <= seen.level) continue;
        tables[table.key] ??= {};
        tables[table.key][key] = { current: cellTarget(cell) ?? cell, levels: table.rows.map((r) => r[key] ?? "") };
        from[path] = { cls: cls.name, name: name || key.toUpperCase(), level: cls.level };
      }
    }
  }
  return { tables, from, shared };
};
