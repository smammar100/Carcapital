import "server-only";
import { getResend, EMAIL_FROM } from "./resend";
import { renderInviteEmail } from "./templates/invite-email";
import { renderCredentialsEmail } from "./templates/credentials-email";

export async function sendStaffInviteEmail(params: {
  recipientEmail: string;
  recipientName: string;
  companyName: string;
  invitedByName: string;
  roleLabels: string[];
  inviteUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const expiryDateStr = params.expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = renderInviteEmail({
    recipientName: params.recipientName,
    companyName: params.companyName,
    invitedByName: params.invitedByName,
    roleLabels: params.roleLabels,
    inviteUrl: params.inviteUrl,
    expiryDateStr,
  });

  const { error } = await getResend().emails.send({
    from: EMAIL_FROM,
    to: params.recipientEmail,
    subject: `You've been invited to join ${params.companyName} on Car Capital`,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendCredentialsEmail(params: {
  recipientEmail: string;
  recipientName: string;
  companyName: string;
  loginUrl: string;
}): Promise<void> {
  const html = renderCredentialsEmail({
    recipientName: params.recipientName,
    companyName: params.companyName,
    loginUrl: params.loginUrl,
  });

  const { error } = await getResend().emails.send({
    from: EMAIL_FROM,
    to: params.recipientEmail,
    subject: `Your Car Capital account for ${params.companyName} is ready`,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
