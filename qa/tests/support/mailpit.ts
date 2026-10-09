/**
 * Mailpit (compose service `mailpit`, UI/API on :8025) catches every mail the backend sends, so
 * invitation / password-reset flows can use REAL one-time tokens instead of `[mocked response]`.
 * API: GET /api/v1/search?query=…, GET /api/v1/message/{ID}, DELETE /api/v1/messages {IDs}.
 */
const MAILPIT_URL = (process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025').replace(/\/+$/u, '');

interface MailSummary {
  readonly ID: string;
  readonly Created: string;
  readonly Subject: string;
}

export interface Mail {
  readonly id: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

async function mailpit<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MAILPIT_URL}${path}`, init);
  if (!res.ok) throw new Error(`Mailpit ${init?.method ?? 'GET'} ${path} → ${res.status}`);
  // DELETE answers 200 with plain text "ok" (Mailpit v1.20), so only JSON bodies are parsed.
  return ((res.headers.get('content-type') ?? '').includes('json') ? await res.json() : undefined) as T;
}

/** Newest mail to `address` created after `since` (and whose subject contains `subjectPart`, when given —
 * one user can get an invitation and a reset mail), polling until `timeoutMs` (the worker sends async). */
export async function waitForMail(address: string, since: Date, timeoutMs = 30_000, subjectPart = ''): Promise<Mail> {
  const deadline = Date.now() + timeoutMs;
  const query = encodeURIComponent(`to:"${address}"`);
  for (;;) {
    const found = await mailpit<{ messages: MailSummary[] }>(`/api/v1/search?query=${query}&limit=10`);
    const fresh = found.messages.find(
      (m) => new Date(m.Created).getTime() >= since.getTime() - 1_000 && m.Subject.includes(subjectPart),
    );
    if (fresh) {
      const full = await mailpit<{ ID: string; Subject: string; Text: string; HTML: string }>(`/api/v1/message/${fresh.ID}`);
      return { id: full.ID, subject: full.Subject, text: full.Text, html: full.HTML };
    }
    if (Date.now() > deadline) throw new Error(`No mail to ${address} within ${timeoutMs} ms (Mailpit ${MAILPIT_URL})`);
    await new Promise((r) => setTimeout(r, 1_000));
  }
}

/** First link in the mail whose URL contains `pathPart` (e.g. `/login/reset-password`). */
export function linkFrom(mail: Mail, pathPart: string): string {
  const links = `${mail.text}\n${mail.html}`.match(/https?:\/\/[^\s"'<>]+/gu) ?? [];
  const link = links.find((l) => l.includes(pathPart));
  if (!link) throw new Error(`Mail "${mail.subject}" has no link containing ${pathPart}`);
  return link.replace(/&amp;/gu, '&');
}

/** Remove the suite's mails (call in `finally`) so later runs never pick up a stale token. */
export async function deleteMails(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await mailpit('/api/v1/messages', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  });
}
