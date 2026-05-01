import { delay } from "./_base";

/**
 * PDF generation stub — Step 1 placeholder.
 * Real implementation in Steps 4 (job card), 8 (invoice), 8 (warranty cert)
 * will use @react-pdf/renderer's pdf() API to produce blobs and trigger downloads.
 */
export const pdfService = {
  async generate(_kind: "job_card" | "invoice" | "warranty"): Promise<Blob> {
    // TODO: Implement with @react-pdf/renderer in Steps 4 / 8
    await delay();
    return new Blob([`PDF stub for ${_kind}`], { type: "application/pdf" });
  },
};
