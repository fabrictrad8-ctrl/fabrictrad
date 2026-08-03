const spreadsheetSafe = (value: unknown) => {
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};

const escapeHtml = (value: unknown) =>
  spreadsheetSafe(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data?.length) return;
  const headers = Object.keys(data[0]);
  const csvCell = (value: unknown) => {
    const text = spreadsheetSafe(value).replaceAll('"', '""');
    return /[,"\n\r]/.test(text) ? `"${text}"` : text;
  };
  const csvRows = [
    headers.map(csvCell).join(','),
    ...data.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ];
  const blob = new Blob([`\uFEFF${csvRows.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.rel = 'noopener';
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(data: Record<string, unknown>[], filename: string): void {
  if (!data?.length) return;
  const headers = Object.keys(data[0]);
  const tableRows = [
    `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`,
    ...data.map(
      (row) =>
        `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>`
    ),
  ];
  const html = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/></head><body><table>${tableRows.join('')}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xls`;
  link.rel = 'noopener';
  link.click();
  URL.revokeObjectURL(url);
}

export function filterByDateRange<T extends { date: string }>(
  data: T[],
  from: string,
  to: string
): T[] {
  if (!from && !to) return data;
  return data.filter((item) => {
    const date = new Date(item.date.replace(' ', 'T'));
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && date < fromDate) return false;
    if (toDate) {
      const end = new Date(toDate);
      end.setDate(end.getDate() + 1);
      if (date >= end) return false;
    }
    return true;
  });
}
