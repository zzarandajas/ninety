/**
 * Minimal RFC 4180-style CSV parser: quoted fields (with `""` escapes and embedded
 * newlines), CRLF/LF line endings and a leading UTF-8 BOM. The delimiter is
 * auto-detected from the header line (`;` — what Excel in Spanish locale writes —
 * or `,`). Fully blank lines are dropped, but each returned row keeps the 1-based
 * line number it started on so validation errors can point at the file.
 */
export interface CsvRow {
  line: number;
  cells: string[];
}

export function detectDelimiter(text: string): ';' | ',' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return commas > semicolons ? ',' : ';';
}

export function parseCsv(input: string): CsvRow[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: CsvRow[] = [];

  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const pushRow = () => {
    cells.push(field);
    if (cells.some((cell) => cell.trim() !== '')) {
      rows.push({ line: rowStartLine, cells: cells.map((cell) => cell.trim()) });
    }
    cells = [];
    field = '';
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n') line++;
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      pushRow();
      line++;
      rowStartLine = line;
    } else {
      field += char;
    }
  }

  if (field !== '' || cells.length > 0) pushRow();
  return rows;
}
