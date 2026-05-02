import type { TodoItem, Vehicle } from "@/lib/types";

export interface JobCardPdfInput {
  vehicle: Vehicle;
  todos: TodoItem[];
  preparedBy: string;
  companyName: string;
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
