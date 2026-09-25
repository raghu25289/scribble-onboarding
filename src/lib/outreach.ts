export interface SendOutreachInput {
  to: string;
  subject: string;
  text: string;
  replyTo: string;
  idempotencyKey: string;
}

export async function sendOutreachEmail(
  input: SendOutreachInput
): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OUTREACH_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Email delivery is not configured. Add RESEND_API_KEY and OUTREACH_FROM_EMAIL.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      reply_to: input.replyTo,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok || !body.id) {
    throw new Error(body.message || `Email provider returned ${response.status}.`);
  }
  return { id: body.id };
}
