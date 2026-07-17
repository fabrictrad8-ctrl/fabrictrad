// Export utility functions for CSV and Excel downloads

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h] ?? '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
        })
        .join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(data: Record<string, unknown>[], filename: string): void {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  // Build a simple HTML table that Excel can open
  const tableRows = [
    `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`,
    ...data.map(
      (row) =>
        `<tr>${headers.map((h) => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`
    ),
  ];
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/></head><body><table>${tableRows.join('')}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xls`;
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
    const d = new Date(item.date.replace(' ', 'T'));
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && d < fromDate) return false;
    if (toDate) {
      const end = new Date(toDate);
      end.setDate(end.getDate() + 1);
      if (d >= end) return false;
    }
    return true;
  });
}
