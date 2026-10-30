/**
 * Stylesheet of the print-ready HTML that `exportPdf` hands to the browser's print dialog.
 *
 * That document is a standalone page: it does not load `globals.css`, so token names
 * resolve to nothing there and the colours have to be spelled out. They live in this one
 * module, carved out of the repo-wide colour guard (`noRawColor.test.ts`), so the rest of
 * the export code stays held to it. Print is black on white by design: no theme twin.
 */
export const PRINT_CSS =
  'body{font-family:"Noto Sans","Be Vietnam Pro","DejaVu Sans",sans-serif;font-size:12px;color:#000;margin:0}' +
  'section{page-break-after:always;padding:16px}section:last-child{page-break-after:auto}' +
  'table{border-collapse:collapse;width:100%}th,td{border:1px solid #444;padding:3px 6px;vertical-align:top}' +
  'th{background:#eee}.r{text-align:right}footer{margin-top:12px;font-size:10px;color:#444}img{max-width:100%}';
