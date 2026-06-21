import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
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
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };

    window.addEventListener('mousedown', closeMenu);
    return () => window.removeEventListener('mousedown', closeMenu);
  }, []);

  const runExport = async (scope) => {
    const rowsByScope = {
      current: filteredRows,
      filtered: filteredRows,
      selected: selectedRows,
      full: fullRows || filteredRows,
    };
    const rows = rowsByScope[scope] || [];
    if (rows.length === 0) return;

    setOpen(false);
    setExporting(true);
    try {
      await exportRowsToExcel({ reportName, rows, columns, scope, filters });
    } finally {
      setExporting(false);
    }
  };

  const options = [
    {
      scope: 'filtered',
      label: 'Filtered view',
      description: `${filteredRows.length} rows currently visible`,
      count: filteredRows.length,
      enabled: filteredRows.length > 0,
    },
    {
      scope: 'selected',
      label: 'Selected records',
      description: `${selectedRows.length} manually selected rows`,
      count: selectedRows.length,
      enabled: selectedRows.length > 0,
    },
    {
      scope: 'full',
      label: 'Full dataset',
      description: `${(fullRows || filteredRows).length} authorized rows`,
      count: (fullRows || filteredRows).length,
      enabled: Boolean(fullRows && fullRows.length > 0),
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        disabled={exporting || filteredRows.length === 0}
        className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin text-brand-600" /> : <FileSpreadsheet className="w-4 h-4 text-green-600" />}
        {exporting ? 'Preparing...' : 'Export'}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Download Excel report</p>
            <p className="text-xs text-gray-500 mt-0.5">Formatted .xlsx with filters and report metadata</p>
          </div>
          <div className="p-1.5">
            {options.map(option => (
              <button
                key={option.scope}
                type="button"
                onClick={() => runExport(option.scope)}
                disabled={!option.enabled || exporting}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
                  {option.scope === 'selected' ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                  <span className="block text-xs text-gray-500">{option.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
