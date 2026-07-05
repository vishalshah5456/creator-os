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

function buildWorkbookForSheets(sheets) {
  const sheetNodes = sheets.map((sheet, index) => (
    `<sheet name="${xmlEscape(sheet.name.slice(0, 31) || `Sheet ${index + 1}`)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetNodes}</sheets>
</workbook>`;
}

function buildWorkbookRelationshipsForSheets(sheets) {
  const sheetRelationships = sheets.map((_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('');
  const stylesId = `rId${sheets.length + 1}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRelationships}
  <Relationship Id="${stylesId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildContentTypesForSheets(sheetCount) {
  const worksheetTypes = Array.from({ length: sheetCount }, (_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${worksheetTypes}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function buildStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>
    <numFmt numFmtId="165" formatCode="#,##0.00"/>
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

function cell(ref, value, style = 0, type = 'inlineStr') {
  if (type === 'number') return `<c r="${ref}" s="${style}"><v>${Number(value) || 0}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function blankRow(rowNumber) {
  return `<row r="${rowNumber}"/>`;
}

function buildDashboardWorksheet({ stats, campaignRows, contentRows }) {
  const maxCampaign = Math.max(...campaignRows.map(row => row.count), 0);
  const maxContent = Math.max(...contentRows.map(row => row.count), 0);
  const makeBar = (value, max) => {
    const length = max > 0 ? Math.max(1, Math.round((value / max) * 28)) : 0;
    return '#'.repeat(length);
  };

  const campaignDataRows = campaignRows.map((row, index) => {
    const rowNumber = 11 + index;
    const rowStyle = index % 2 === 0 ? 12 : 13;
    return `<row r="${rowNumber}" ht="22" customHeight="1">
      ${cell(`A${rowNumber}`, row.stage, rowStyle)}
      ${cell(`B${rowNumber}`, row.count, 10, 'number')}
      ${cell(`C${rowNumber}`, makeBar(row.count, maxCampaign), 14)}
    </row>`;
  }).join('');

  const contentDataRows = contentRows.map((row, index) => {
    const rowNumber = 21 + index;
    return `<row r="${rowNumber}" ht="22" customHeight="1">
      ${cell(`A${rowNumber}`, row.status, 8)}
      ${cell(`B${rowNumber}`, row.count, 10, 'number')}
      ${cell(`C${rowNumber}`, makeBar(row.count, maxContent), 15)}
    </row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:H26"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="24" customWidth="1"/>
    <col min="2" max="2" width="14" customWidth="1"/>
    <col min="3" max="3" width="34" customWidth="1"/>
    <col min="4" max="8" width="13" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="30" customHeight="1">${cell('A1', 'CreatorCRM Dashboard Report', 1)}</row>
    <row r="2" ht="20" customHeight="1">${cell('A2', `Generated ${new Date().toLocaleString()}`, 2)}</row>

    <row r="3" ht="24" customHeight="1">${cell('A3', 'Deals Summary', 3)}</row>
    <row r="4" ht="22" customHeight="1">${cell('A4', 'Metric', 4)}${cell('B4', 'Count', 4)}</row>
    <row r="5" ht="22" customHeight="1">${cell('A5', 'Total Deals', 8)}${cell('B5', stats.totalDeals || 0, 10, 'number')}</row>
    <row r="6" ht="22" customHeight="1">${cell('A6', 'Active Deals', 8)}${cell('B6', stats.activeDeals || 0, 10, 'number')}</row>
    ${blankRow(7)}
    ${blankRow(8)}

    <row r="9" ht="24" customHeight="1">${cell('A9', 'Campaign Performance', 5)}</row>
    <row r="10" ht="22" customHeight="1">${cell('A10', 'Campaign Stage', 6)}${cell('B10', 'Count', 6)}${cell('C10', 'Horizontal Bar', 6)}</row>
    ${campaignDataRows}
    <row r="16" ht="18" customHeight="1">${cell('A16', `Highest campaign count: ${maxCampaign}`, 2)}</row>
    ${blankRow(17)}

    ${blankRow(18)}

    <row r="19" ht="24" customHeight="1">${cell('A19', 'Content Status', 7)}</row>
    <row r="20" ht="22" customHeight="1">${cell('A20', 'Status', 9)}${cell('B20', 'Count', 9)}${cell('C20', 'Horizontal Bar', 9)}</row>
    ${contentDataRows}
    <row r="24" ht="18" customHeight="1">${cell('A24', `Highest content count: ${maxContent}`, 2)}</row>
  </sheetData>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`;
}

function buildDashboardStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="12"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="18"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FF16A34A"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FFF97316"/><name val="Calibri"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDDEBFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF16A34A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF97316"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="16">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left"/></xf>
  </cellXfs>
</styleSheet>`;
}

function buildDrawingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>17</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>31</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Campaign Performance Chart"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>38</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>49</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="3" name="Content Status Chart"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId2"/></a:graphicData></a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function buildBarChartXml({ title, categoryRange, valueRange, color }) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1200" b="1"/><a:t>${xmlEscape(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/></c:title>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="bar"/>
        <c:grouping val="clustered"/>
        <c:ser>
          <c:idx val="0"/><c:order val="0"/>
          <c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr>
          <c:cat><c:strRef><c:f>${categoryRange}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>${valueRange}</c:f></c:numRef></c:val>
        </c:ser>
        <c:axId val="10"/><c:axId val="20"/>
      </c:barChart>
      <c:catAx><c:axId val="10"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:tickLblPos val="nextTo"/><c:crossAx val="20"/><c:crosses val="autoZero"/></c:catAx>
      <c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="10"/><c:crosses val="autoZero"/></c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="r"/><c:delete val="1"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

function buildDashboardXlsx({ stats, campaignRows, contentRows, extraSheets = [] }) {
  const sheets = [
    { name: 'Dashboard Report', content: buildDashboardWorksheet({ stats, campaignRows, contentRows }) },
    ...extraSheets.map(sheet => ({
      name: sheet.name,
      content: buildWorksheet(sheet.rows, sheet.columns, sheet.name, { scope: 'dashboard' }),
    })),
  ];

  return createZip([
    {
      name: '[Content_Types].xml',
      content: buildContentTypesForSheets(sheets.length),
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
      content: buildWorkbookRelationshipsForSheets(sheets),
    },
    { name: 'xl/workbook.xml', content: buildWorkbookForSheets(sheets) },
    { name: 'xl/styles.xml', content: buildDashboardStyles() },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheet.content,
    })),
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

export async function exportDashboardReport({ stats = {}, pipelineStats = [], contentStatusStats = [], scope = 'filtered', filters = {} }) {
  const safeReportName = 'creatorcrm-dashboard-report';
  const fileName = `${safeReportName}_${todayStamp()}.xlsx`;
  const campaignOrder = ['paid', 'negotiation', 'delivered', 'contract', 'outreach'];
  const contentOrder = ['draft', 'scheduled', 'published'];
  const getCampaignCount = (stage) => pipelineStats.find(item => item.pipeline_stage === stage)?.count || 0;
  const getContentCount = (status) => contentStatusStats.find(item => item.status === status)?.count || 0;

  const campaignRows = campaignOrder.map(stage => ({
    stage: titleCase(stage),
    count: getCampaignCount(stage),
  }));
  const contentRows = contentOrder.map(status => ({
    status: titleCase(status),
    count: getContentCount(status),
  }));

  const [deals, content, income, rateCards] = await Promise.all([
    api('/deals?limit=500').catch(() => []),
    api('/content?limit=500').catch(() => []),
    api('/income?limit=500').catch(() => []),
    api('/rate-cards').catch(() => []),
  ]);

  const rateCardRows = rateCards.flatMap(card => (
    (card.pricing_tiers?.length ? card.pricing_tiers : [{ service: '', price: '', description: '' }]).map(tier => ({
      name: card.name,
      is_default: card.is_default ? 'Yes' : 'No',
      platforms: (card.platforms || []).join(', '),
      audience_size: card.audience_size || 0,
      engagement_rate: card.engagement_rate || 0,
      service: tier.service,
      price: tier.price || 0,
      description: tier.description,
      created_at: card.created_at,
    }))
  ));

  const extraSheets = [
    {
      name: 'Deals',
      rows: deals,
      columns: [
        { header: 'Brand', key: 'brand_name' },
        { header: 'Contact Name', key: 'contact_name' },
        { header: 'Contact Email', key: 'contact_email' },
        { header: 'Value', key: 'value', type: 'number' },
        { header: 'Currency', key: 'currency' },
        { header: 'Stage', key: 'pipeline_stage' },
        { header: 'Platforms', value: row => (row.platforms || []).join(', ') },
        { header: 'Start Date', key: 'start_date', type: 'date' },
        { header: 'End Date', key: 'end_date', type: 'date' },
      ],
    },
    {
      name: 'Content',
      rows: content,
      columns: [
        { header: 'Title', key: 'title' },
        { header: 'Platform', key: 'platform' },
        { header: 'Type', key: 'content_type' },
        { header: 'Status', key: 'status' },
        { header: 'Scheduled Date', key: 'scheduled_date', type: 'date' },
        { header: 'Published Date', key: 'published_date', type: 'date' },
      ],
    },
    {
      name: 'Income',
      rows: income,
      columns: [
        { header: 'Source', key: 'source' },
        { header: 'Category', key: 'category' },
        { header: 'Amount', key: 'amount', type: 'number' },
        { header: 'Currency', key: 'currency' },
        { header: 'Date', key: 'date', type: 'date' },
        { header: 'Status', key: 'status' },
      ],
    },
    {
      name: 'Rate Cards',
      rows: rateCardRows,
      columns: [
        { header: 'Rate Card', key: 'name' },
        { header: 'Default', key: 'is_default' },
        { header: 'Platforms', key: 'platforms' },
        { header: 'Audience Size', key: 'audience_size', type: 'number' },
        { header: 'Engagement Rate', key: 'engagement_rate', type: 'number' },
        { header: 'Service', key: 'service' },
        { header: 'Price', key: 'price', type: 'number' },
        { header: 'Created At', key: 'created_at', type: 'date' },
      ],
    },
  ];

  await api('/audit/export', {
    method: 'POST',
    body: JSON.stringify({
      report_name: safeReportName,
      scope,
      row_count: 10,
      filters,
    }),
  }).catch(() => null);

  const workbook = buildDashboardXlsx({ stats, campaignRows, contentRows, extraSheets });
  const url = URL.createObjectURL(workbook);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
