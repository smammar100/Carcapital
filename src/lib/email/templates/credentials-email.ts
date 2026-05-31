export interface CredentialsEmailProps {
  recipientName: string;
  companyName: string;
  loginUrl: string;
}

export function renderCredentialsEmail(p: CredentialsEmailProps): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>Your Car Capital account for ${esc(p.companyName)} is ready</title>
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
        Your account is ready
      </h1>

      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 14px;">
        Hi ${esc(p.recipientName)},
      </p>
      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 28px;">
        Your Car Capital account for <strong>${esc(p.companyName)}</strong> has
        been created. Use the credentials your manager shared with you to
        sign in.
      </p>

      <!-- CTA -->
      <a href="${esc(p.loginUrl)}"
         style="display:inline-block;background:#111827;color:#fff;border-radius:8px;padding:14px 28px;font-size:15px;font-weight:600;text-decoration:none;text-align:center;margin-bottom:24px;">
        Sign In to Car Capital
      </a>

      <p style="font-size:13px;color:#9ca3af;line-height:1.5;margin:0;">
        You&rsquo;ll be asked to set a new password the first time you sign in.
        Keep your credentials safe and don&rsquo;t share them.
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
