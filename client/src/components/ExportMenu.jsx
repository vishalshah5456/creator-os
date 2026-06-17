import { useState } from 'react';
import { Download } from 'lucide-react';
import { exportRowsToExcel } from '../lib/excelExport';

export default function ExportMenu({
  reportName,
  columns,
  filteredRows,
  fullRows,
  selectedRows = [],
  filters = {},
}) {
  const [exporting, setExporting] = useState(false);

  const runExport = async (scope) => {
    const rowsByScope = {
      current: filteredRows,
      filtered: filteredRows,
      selected: selectedRows,
      full: fullRows || filteredRows,
    };
    const rows = rowsByScope[scope] || [];
    if (rows.length === 0) return;

    setExporting(true);
    try {
      await exportRowsToExcel({ reportName, rows, columns, scope, filters });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => runExport('filtered')}
        disabled={exporting || filteredRows.length === 0}
        className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        {exporting ? 'Exporting...' : 'Export Excel'}
      </button>
      {selectedRows.length > 0 && (
        <button
          type="button"
          onClick={() => runExport('selected')}
          disabled={exporting}
          className="px-3 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Selected
        </button>
      )}
      {fullRows && fullRows.length !== filteredRows.length && (
        <button
          type="button"
          onClick={() => runExport('full')}
          disabled={exporting || fullRows.length === 0}
          className="px-3 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Full dataset
        </button>
      )}
    </div>
  );
}
