import type { Invoice, TodoItem, Vehicle, Warranty } from "@/lib/types";

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
