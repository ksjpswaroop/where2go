// Twilio SMS client for safety-timer escalation.
//
// Sends SMS via the Twilio REST API using Basic auth. Credentials come from
// environment secrets so they are available at runtime in both development and
// production:
//   - TWILIO_ACCOUNT_SID   (the "AC..." account SID, used as the auth username)
//   - TWILIO_AUTH_TOKEN    (account auth token, used as the auth password)
//   - TWILIO_PHONE_NUMBER  (the verified "From" sender number, E.164)
//
// We call the REST API directly rather than through the Replit Twilio connector
// proxy: Twilio's REST auth requires the account SID in the URL path (which the
// connector does not expose to runtime code), and sending requires a "From"
// number. Keeping the three values as secrets is the most reliable approach.
import { logger } from "./logger";

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

function resolveTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!accountSid || !authToken || !fromNumber) {
    logger.error(
      {
        hasAccountSid: Boolean(accountSid),
        hasAuthToken: Boolean(authToken),
        hasFromNumber: Boolean(fromNumber),
      },
      "Twilio is not fully configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to enable safety escalation SMS.",
    );
    return null;
  }

  return { accountSid, authToken, fromNumber };
}

export type SendSmsResult = {
  to: string;
  ok: boolean;
  messageSid?: string;
  error?: string;
};

/**
 * Sends an SMS to each recipient via Twilio. Each recipient gets its own
 * message; one failure does not abort the rest. Returns a per-recipient result
 * so callers can decide whether the escalation succeeded.
 */
export async function sendSms(
  to: string[],
  body: string,
): Promise<SendSmsResult[]> {
  const recipients = to.map((n) => n.trim()).filter((n) => n.length > 0);
  if (recipients.length === 0) return [];

  const config = resolveTwilioConfig();
  if (!config) {
    return recipients.map((r) => ({
      to: r,
      ok: false,
      error: "Twilio is not configured",
    }));
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(
    `${config.accountSid}:${config.authToken}`,
  ).toString("base64")}`;

  const results: SendSmsResult[] = [];
  for (const recipient of recipients) {
    const form = new URLSearchParams({
      To: recipient,
      From: config.fromNumber,
      Body: body,
    });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });
      if (res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { sid?: string };
        results.push({ to: recipient, ok: true, messageSid: payload.sid });
      } else {
        const text = await res.text().catch(() => "");
        results.push({
          to: recipient,
          ok: false,
          error: `Twilio responded ${res.status}: ${text.slice(0, 300)}`,
        });
      }
    } catch (err) {
      results.push({
        to: recipient,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
