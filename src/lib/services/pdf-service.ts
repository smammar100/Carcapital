import type { Company, Invoice, TodoItem, Vehicle, Warranty } from "@/lib/types";

export interface JobCardPdfInput {
  vehicle: Vehicle;
  todos: TodoItem[];
  preparedBy: string;
  companyName: string;
  /** Vendor id → name, so the job card prints vendor names not raw UUIDs. */
  vendorNames?: Record<string, string>;
}

export interface WarrantyPdfInput {
  warranty: Warranty;
  vehicle: Vehicle | null;
  companyName: string;
  companyAddress: string;
  vatNumber: string | null;
}

export interface InvoicePdfInput {
  invoice: Invoice;
  companyName: string;
  companyAddress: string;
  vatNumber: string | null;
  /**
   * The linked vehicle, when available. The 2-page sales invoice derives
   * Make & Model / VRM-VIN / Gearbox / Origin from it (SPEC §3 Section C).
   * Optional — the template degrades gracefully (admin list reprints may
   * not have it loaded).
   */
  vehicle?: Vehicle | null;
  /**
   * Company logo (public URL). When set, the invoice header/footer renders
   * the image; otherwise it falls back to the text mark.
   */
  logoUrl?: string | null;
}

/**
 * The company-derived fields every invoice PDF needs. Spread this into a
 * `generateInvoice` call so all sites map the company identically — the ONE
 * place to add a new company→PDF field (see GEN-12: logoUrl was missed at 3
 * of 4 call sites when added ad hoc).
 *
 *   pdfService.generateInvoice({ invoice, vehicle, ...companyInvoiceFields(company) })
 */
export function companyInvoiceFields(company: Company): {
  companyName: string;
  companyAddress: string;
  vatNumber: string | null;
  logoUrl: string | null;
} {
  return {
    companyName: company.name,
    companyAddress: company.address,
    vatNumber: company.vatNumber,
    logoUrl: company.logoUrl,
  };
}

/**
 * PDF generation. We use @react-pdf/renderer's `pdf()` builder. Templates live
 * in `src/components/pdf/*-template.tsx` and are dynamically imported here so
 * the PDF runtime never lands in the initial client bundle.
 */
export const pdfService = {
  async generateJobCard(input: JobCardPdfInput): Promise<Blob> {
    const [{ pdf }, { JobCardTemplate }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/pdf/job-card-template"),
    ]);
    const doc = pdf(JobCardTemplate(input));
    return doc.toBlob();
  },

  async generateWarrantyCertificate(input: WarrantyPdfInput): Promise<Blob> {
    const [{ pdf }, { WarrantyCertificateTemplate }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/pdf/warranty-certificate-template"),
    ]);
    const doc = pdf(WarrantyCertificateTemplate(input));
    return doc.toBlob();
  },

  async generateInvoice(input: InvoicePdfInput): Promise<Blob> {
    const [{ pdf }, { InvoiceTemplate }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/pdf/invoice-template"),
    ]);
    const doc = pdf(InvoiceTemplate(input));
    return doc.toBlob();
  },
};

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openBlobInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Render a PDF and show it in a new tab.
 *
 * The tab has to be opened synchronously, inside the click handler. Rendering
 * a PDF takes a moment, and by the time it finishes the user activation that
 * permits a popup is spent — `window.open` then returns null and the browser
 * blocks it *silently*. Nothing throws, so the surrounding catch never runs and
 * the user sees no tab, no error, nothing at all (GEN-111).
 *
 * So: open the tab first, point it at the blob once rendered, and if the
 * browser blocked it anyway, fall back to downloading the file rather than
 * letting the click evaporate.
 *
 * Note `noopener` is deliberately NOT passed here — with it, `window.open`
 * returns null by spec and we lose the handle we need. The opener reference is
 * dropped manually instead.
 */
export async function openPdfInNewTab(
  build: () => Promise<Blob>,
  filename: string,
): Promise<void> {
  const tab = window.open("", "_blank");
  if (tab) {
    try {
      tab.opener = null;
    } catch {
      // Cross-origin about:blank in some browsers; not worth failing over.
    }
  }
  let blob: Blob;
  try {
    blob = await build();
  } catch (e) {
    tab?.close();
    throw e;
  }
  if (tab && !tab.closed) {
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  downloadBlob(blob, filename);
}
