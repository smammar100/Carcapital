export interface InviteEmailProps {
  recipientName: string;
  companyName: string;
  invitedByName: string;
  roleLabels: string[];
  inviteUrl: string;
  expiryDateStr: string;
}

export function renderInviteEmail(p: InviteEmailProps): string {
  const roles = p.roleLabels
    .map(
      (l) =>
        `<span style="display:inline-block;background:#f3f4f6;color:#374151;border-radius:6px;padding:4px 10px;font-size:13px;font-weight:500;margin-right:6px;margin-bottom:6px;">${esc(l)}</span>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>You've been invited to join ${esc(p.companyName)}</title>
</head>
<body style="margin:0;padding:40px 16px;background:#f9fafb;font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;">

    <!-- Wordmark -->
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.02em;">Car Capital</span>
    </div>

    <!-- Card -->
    <div style="background:#fff;border-radius:10px;padding:40px;border:1px solid #e5e7eb;">
      <h1 style="font-size:24px;font-weight:600;color:#111827;letter-spacing:-0.02em;line-height:1.2;margin:0 0 20px;">
        You've been invited
      </h1>

      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 14px;">
        Hi ${esc(p.recipientName)},
      </p>
      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">
        <strong>${esc(p.invitedByName)}</strong> has invited you to join
        <strong>${esc(p.companyName)}</strong> on Car Capital &mdash; the
        dealership management platform.
      </p>

      <!-- Role badges -->
      <div style="margin-bottom:28px;">
        <p style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">
          Your role${p.roleLabels.length !== 1 ? "s" : ""}
        </p>
        ${roles}
      </div>

      <!-- CTA -->
      <a href="${esc(p.inviteUrl)}"
         style="display:inline-block;background:#111827;color:#fff;border-radius:8px;padding:14px 28px;font-size:15px;font-weight:600;text-decoration:none;text-align:center;margin-bottom:24px;">
        Accept Invitation
      </a>

      <p style="font-size:13px;color:#9ca3af;line-height:1.5;margin:0;">
        This link expires on ${esc(p.expiryDateStr)}. If you didn&rsquo;t expect
        this invitation, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;" />
    <p style="font-size:13px;color:#9ca3af;text-align:center;margin:0;">
      Car Capital UK &middot; Dealership Management
    </p>

  </div>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
