// PDF statements, read on the phone: the text is regrouped into lines by its position on the page,
// so it works whether or not the bank's PDF marks line ends.

type TextItem = { str: string; transform: number[] };

/** pdf.js needs Promise.withResolvers, which the phone's JavaScript engine may lack. */
function polyfill() {
  const P = Promise as unknown as { withResolvers?: () => unknown };
  if (!P.withResolvers) {
    P.withResolvers = () => {
      let resolve!: (v: unknown) => void;
      let reject!: (e: unknown) => void;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
}

/**
 * Without a worker, pdf.js hands every message to itself through structuredClone. Expo's
 * stand-in copies binary data byte by byte and overflows the stack on a real statement (the
 * error is swallowed and pdf.js waits forever), so a PDF read uses this plain copy instead.
 */
function clone(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (ArrayBuffer.isView(v)) return (v as Uint8Array).slice();
  if (v instanceof ArrayBuffer) return v.slice(0);
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, clone(x)]));
  if (Array.isArray(v)) return v.map(clone);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
}

async function withPlainClone<T>(job: () => Promise<T>): Promise<T> {
  const g = globalThis as unknown as { structuredClone?: unknown };
  const previous = g.structuredClone;
  g.structuredClone = clone;
  try {
    return await job();
  } finally {
    g.structuredClone = previous;
  }
}

/** Thrown when a step takes too long on the phone, saying which step. */
export class PdfTimeout extends Error {}

/** Rejects with PdfTimeout after `ms`, so a stuck read ends with a message instead of a spinner. */
function withTimeout<T>(job: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PdfTimeout(what)), ms);
    job.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Every text line of the PDF, top to bottom, page by page. `onProgress(done, total)` reports each
 * page read; the screen shows it, and between pages the UI gets a moment to redraw.
 */
export async function pdfLines(bytes: Uint8Array, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  polyfill();
  return withPlainClone(() => readLines(bytes, onProgress));
}

async function readLines(bytes: Uint8Array, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await withTimeout(getDocumentProxy(bytes), 60_000, 'PDF açılamadı');
  const lines: string[] = [];
  onProgress?.(0, pdf.numPages);
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await withTimeout(pdf.getPage(p), 30_000, `${p}. sayfa açılamadı`);
    const { items } = await withTimeout(page.getTextContent(), 60_000, `${p}. sayfa okunamadı`);
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of items as TextItem[]) {
      if (!it.str?.trim()) continue;
      // Items within 3 points of each other vertically belong to the same line.
      const y = Math.round(it.transform[5] / 3) * 3;
      const row = rows.get(y);
      if (row) row.push({ x: it.transform[4], s: it.str });
      else rows.set(y, [{ x: it.transform[4], s: it.str }]);
    }
    [...rows]
      .sort(([a], [b]) => b - a)
      .forEach(([, cells]) => lines.push(cells.sort((a, b) => a.x - b.x).map((c) => c.s.trim()).join(' ')));
    page.cleanup();
    onProgress?.(p, pdf.numPages);
    await new Promise((r) => setTimeout(r, 0));
  }
  return lines;
}
