# PDF templates

> **Audience:** developers + AI agents
> **Last verified against `main` HEAD:** `86f9d91`

Three PDF document types, all generated client-side with `@react-pdf/renderer` 4.5.1. Templates live in `src/components/pdf/`. Generation is orchestrated by `src/lib/services/pdf-service.ts`.

## Templates

| Document | Template file | When it's generated | Triggered from |
|---|---|---|---|
| Invoice (sale or purchase) | `invoice-template.tsx` | When a sale deal completes or a purchase invoice is logged | `/sales/invoice-generation`, `/admin/invoicing` |
| Job Card | `job-card-template.tsx` | When a maintenance job is assigned (work order for the mechanic / vendor) | `/maintenance/jobs/[id]` |
| Warranty Certificate | `warranty-certificate-template.tsx` | When a warranty is purchased and activated | `/warranties/[id]` |

## How generation works

Each template is a `@react-pdf/renderer` `<Document>` component. To produce the PDF:

```typescript
import { pdf } from "@react-pdf/renderer";
import { InvoiceTemplate } from "@/components/pdf/invoice-template";

const blob = await pdf(<InvoiceTemplate invoice={invoice} />).toBlob();
downloadBlob(blob, `invoice-${invoice.id}.pdf`);
```

`pdf-service.ts` exposes the helpers used everywhere:

| Helper | Purpose |
|---|---|
| `downloadBlob(blob, filename)` | Triggers a browser download |
| `openBlobInNewTab(blob)` | Opens the PDF in a new tab for preview |
| `generateInvoice(invoice)` | Renders the invoice template; returns Blob |
| `generateJobCard(job)` | Renders the job card; returns Blob |
| `generateWarrantyCertificate(warranty)` | Renders the certificate; returns Blob |

## Invoice template details

- Supports both `purchase` and `sale` `InvoiceType`s.
- Renders VAT according to `Invoice.vatScheme`:
  - `vat_qualifying` — itemised VAT lines at standard rate
  - `margin` — single "VAT (Margin Scheme)" line = `(subtotal - vehicle.totalBuyingPrice) / 6`
  - `not_sold` — no VAT lines
- Includes Company header (name, address, VAT number from `Company.vatNumber`).
- Itemises line items from `Invoice.lineItems[]`.
- Footer carries terms and payment instructions.

## Job card template details

- Header: vehicle (registration + stock ID + make/model/year), assigned vendor or workshop user.
- Body: task description, agreed cost, scheduled date, notes.
- Tear-off-style signature box for vendor sign-off.

## Warranty certificate template details

- Header: customer name, registration, period of cover, type (`in_house` / `external`).
- Body: what's covered (from `Warranty.coverageNotes` if set, else default text), exclusions, claim-filing instructions.
- Issued by: company name + signature placeholder.

## Font registration

`@react-pdf/renderer` needs fonts registered up-front. The templates use the same Figtree and Geist Mono families as the web UI — registered at module top via `Font.register()`. If a new template wants a different font, register it once at the top of that template file.

## What's NOT generated as PDF (intentional)

- The 20-point inspection report — displayed in-app; not exported as PDF. (Roadmap item.)
- The master sheet — exported as CSV, not PDF.
- The activity log — displayed in-app only.

## Adding a new PDF template

1. Create `src/components/pdf/<doc>-template.tsx`. Define a React component returning `<Document>`.
2. Register fonts at the top of the file via `Font.register()`.
3. Add a `generate<Doc>()` helper in `src/lib/services/pdf-service.ts`.
4. Call from the trigger page (e.g. a "Download PDF" button click handler).
5. Add a row to the "Templates" table at the top of this doc.
