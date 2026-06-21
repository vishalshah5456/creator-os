import { api } from './utils';

const TEXT_ENCODER = new TextEncoder();

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index) {
  let name = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function excelDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((date.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function uint16(value) {
  return [value & 255, (value >>> 8) & 255];
}

function uint32(value) {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}

function createZip(files) {
  const chunks = [];
  const centralDirectory = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = TEXT_ENCODER.encode(file.name);
    const dataBytes = TEXT_ENCODER.encode(file.content);
    const checksum = crc32(dataBytes);

    const localHeader = new Uint8Array([
      ...uint32(0x04034b50),
      ...uint16(20),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint32(checksum),
      ...uint32(dataBytes.length),
      ...uint32(dataBytes.length),
      ...uint16(nameBytes.length),
      ...uint16(0),
    ]);

    chunks.push(localHeader, nameBytes, dataBytes);

    centralDirectory.push({
      nameBytes,
      checksum,
      size: dataBytes.length,
      offset,
    });

    offset += localHeader.length + nameBytes.length + dataBytes.length;
  });

  const centralStart = offset;

  centralDirectory.forEach((entry) => {
    const header = new Uint8Array([
      ...uint32(0x02014b50),
      ...uint16(20),
      ...uint16(20),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint32(entry.checksum),
      ...uint32(entry.size),
      ...uint32(entry.size),
      ...uint16(entry.nameBytes.length),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint32(0),
      ...uint32(entry.offset),
    ]);
    chunks.push(header, entry.nameBytes);
    offset += header.length + entry.nameBytes.length;
  });

  const centralSize = offset - centralStart;
  chunks.push(new Uint8Array([
    ...uint32(0x06054b50),
    ...uint16(0),
    ...uint16(0),
    ...uint16(centralDirectory.length),
    ...uint16(centralDirectory.length),
    ...uint32(centralSize),
    ...uint32(centralStart),
    ...uint16(0),
  ]));

  return new Blob(chunks, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function titleCase(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function buildWorksheet(rows, columns, sheetName, metadata = {}) {
  const safeRows = rows.slice(0, 100000);
  const sheetColCount = Math.max(columns.length, 4);
  const widths = Array.from({ length: sheetColCount }, (_, index) => (
    Math.min(Math.max(String(columns[index]?.header || '').length + 2, 12), 42)
  ));
  const lastDataColumn = columnName(Math.max(columns.length - 1, 0));
  const lastSheetColumn = columnName(sheetColCount - 1);

  const headerCells = columns.map((column, columnIndex) => {
    const ref = `${columnName(columnIndex)}4`;
    return `<c r="${ref}" t="inlineStr" s="3"><is><t>${xmlEscape(column.header)}</t></is></c>`;
  }).join('');

  const dataRows = safeRows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 5;
    const cells = columns.map((column, columnIndex) => {
      const rawValue = typeof column.value === 'function' ? column.value(row) : row[column.key];
      const displayValue = rawValue === undefined || rawValue === null ? '' : rawValue;
      widths[columnIndex] = Math.min(Math.max(widths[columnIndex], String(displayValue).length + 2), 42);
      const ref = `${columnName(columnIndex)}${rowNumber}`;

      if (column.type === 'currency' || column.type === 'number') {
        const number = Number(displayValue);
        if (Number.isFinite(number)) {
          return `<c r="${ref}" s="${column.type === 'currency' ? 2 : 7}"><v>${number}</v></c>`;
        }
      }

      if (column.type === 'date') {
        const dateNumber = excelDate(displayValue);
        if (dateNumber) return `<c r="${ref}" s="1"><v>${dateNumber}</v></c>`;
      }

      return `<c r="${ref}" t="inlineStr" s="8"><is><t>${xmlEscape(displayValue)}</t></is></c>`;
    }).join('');
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join('');

  const cols = widths.map((width, index) => (
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  )).join('');

  const generatedAt = new Date().toLocaleString();
  const lastCell = `${lastSheetColumn}${safeRows.length + 4}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCell}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">
      <c r="A1" t="inlineStr" s="4"><is><t>${xmlEscape(titleCase(sheetName))}</t></is></c>
    </row>
    <row r="2" ht="20" customHeight="1">
      <c r="A2" t="inlineStr" s="5"><is><t>Generated</t></is></c>
      <c r="B2" t="inlineStr" s="6"><is><t>${xmlEscape(generatedAt)}</t></is></c>
      <c r="C2" t="inlineStr" s="5"><is><t>Scope</t></is></c>
      <c r="D2" t="inlineStr" s="6"><is><t>${xmlEscape(titleCase(metadata.scope || 'filtered'))}</t></is></c>
    </row>
    <row r="3" ht="20" customHeight="1">
      <c r="A3" t="inlineStr" s="5"><is><t>Rows</t></is></c>
      <c r="B3" s="7"><v>${safeRows.length}</v></c>
      <c r="C3" t="inlineStr" s="5"><is><t>Product</t></is></c>
      <c r="D3" t="inlineStr" s="6"><is><t>CreatorCRM</t></is></c>
    </row>
    <row r="4" ht="22" customHeight="1">${headerCells}</row>
    ${dataRows}
  </sheetData>
  <autoFilter ref="A4:${lastDataColumn}${safeRows.length + 4}"/>
  <mergeCells count="1"><mergeCell ref="A1:${lastSheetColumn}1"/></mergeCells>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`;
}

function buildWorkbook(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xmlEscape(sheetName.slice(0, 31) || 'Report')}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function buildStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>
    <numFmt numFmtId="165" formatCode="$#,##0.00"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="16"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF111827"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF9FAFB"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
</styleSheet>`;
}

function buildXlsx(rows, columns, sheetName, metadata) {
  return createZip([
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: 'xl/workbook.xml', content: buildWorkbook(sheetName) },
    { name: 'xl/styles.xml', content: buildStyles() },
    { name: 'xl/worksheets/sheet1.xml', content: buildWorksheet(rows, columns, sheetName, metadata) },
  ]);
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function exportRowsToExcel({ reportName, rows, columns, scope = 'filtered', filters = {} }) {
  const safeReportName = reportName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
  const fileName = `${safeReportName}_${todayStamp()}.xlsx`;

  await api('/audit/export', {
    method: 'POST',
    body: JSON.stringify({
      report_name: safeReportName,
      scope,
      row_count: rows.length,
      filters,
    }),
  }).catch(() => null);

  const workbook = buildXlsx(rows, columns, reportName, { scope, filters });
  const url = URL.createObjectURL(workbook);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
