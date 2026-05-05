// Email delivery layer.
// When RESEND_API_KEY is not configured (local dev), the sign-in link is
// printed to the server console so you can copy it without needing a real inbox.
// Set TEST_EMAIL in .env to see which address the link would go to.

function getAppBaseUrl() {
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) {
    return nextAuthUrl.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export { getAppBaseUrl };

function maskEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  const [localPart, domainPart] = normalized.split("@");
  if (!localPart || !domainPart) {
    return "[redacted-email]";
  }

  const visibleLocal = localPart.slice(0, 2);
  return `${visibleLocal}***@${domainPart}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) {
    return "***";
  }

  return `***-***-${digits.slice(-4)}`;
}

function redactTokenInUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.searchParams.has("token")) {
      url.searchParams.set("token", "[redacted]");
    }
    return url.toString();
  } catch {
    return "[redacted-sign-in-url]";
  }
}

const W = 62; // total box width between │ borders

function line(text = "") {
  return `│ ${text.padEnd(W - 2)} │`;
}

function divider() {
  return `├${"─".repeat(W)}┤`;
}

function header(title: string) {
  const pad = Math.max(0, Math.floor((W - title.length) / 2));
  return `│${" ".repeat(pad)}${title}${" ".repeat(W - pad - title.length)}│`;
}

export function printAdminNewAppointmentNotification(input: {
  ref: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  service: string;
  barber: string;
  dateLabel: string;
  time: string;
  notes: string | null;
}) {
  const top    = `┌${"─".repeat(W)}┐`;
  const bottom = `└${"─".repeat(W)}┘`;

  console.log("\n" + top);
  console.log(header("NEW APPOINTMENT REQUEST"));
  console.log(divider());
  console.log(line(`Ref:      ${input.ref}`));
  console.log(line(`Customer: ${input.customerName} <${maskEmail(input.customerEmail)}>`));
  console.log(line(`Phone:    ${maskPhone(input.customerPhone)}`));
  console.log(line());
  console.log(line(`Service:  ${input.service}`));
  console.log(line(`Barber:   ${input.barber}`));
  console.log(line(`Date:     ${input.dateLabel} at ${input.time}`));
  if (input.notes) {
    console.log(line());
    console.log(line(`Notes:    ${input.notes}`));
  }
  console.log(bottom + "\n");
}

export function printCustomerStatusUpdateNotification(input: {
  ref: string;
  customerName: string;
  customerEmail: string;
  service: string;
  barber: string;
  dateLabel: string;
  time: string;
  fromStatus: string;
  toStatus: string;
  cancellationNote?: string | null;
}) {
  const top    = `┌${"─".repeat(W)}┐`;
  const bottom = `└${"─".repeat(W)}┘`;

  console.log("\n" + top);
  console.log(header("APPOINTMENT STATUS UPDATE"));
  console.log(divider());
  console.log(line(`Ref:      ${input.ref}`));
  console.log(line(`Customer: ${input.customerName} <${maskEmail(input.customerEmail)}>`));
  console.log(line());
  console.log(line(`Service:  ${input.service}`));
  console.log(line(`Barber:   ${input.barber}`));
  console.log(line(`Date:     ${input.dateLabel} at ${input.time}`));
  console.log(line());
  console.log(line(`Status:   ${input.fromStatus.toUpperCase()} → ${input.toStatus.toUpperCase()}`));
  if (input.cancellationNote) {
    console.log(line());
    console.log(line(`Note:     ${input.cancellationNote}`));
  }
  console.log(bottom + "\n");
}

export function printCustomerAppointmentExpiredNotification(input: {
  ref: string;
  customerName: string;
  customerEmail: string;
  service: string;
  barber: string;
  dateLabel: string;
  time: string;
}) {
  const top    = `┌${"─".repeat(W)}┐`;
  const bottom = `└${"─".repeat(W)}┘`;

  console.log("\n" + top);
  console.log(header("APPOINTMENT EXPIRED — CUSTOMER NOTIFICATION"));
  console.log(divider());
  console.log(line(`Ref:      ${input.ref}`));
  console.log(line(`To:       ${input.customerName} <${maskEmail(input.customerEmail)}>`));
  console.log(line());
  console.log(line(`Service:  ${input.service}`));
  console.log(line(`Barber:   ${input.barber}`));
  console.log(line(`Date:     ${input.dateLabel} at ${input.time}`));
  console.log(line());
  console.log(line("Your appointment request was not actioned in time and has"));
  console.log(line("been automatically expired. Please book again if you wish."));
  console.log(bottom + "\n");
}

export function printAdminAppointmentExpiredNotification(input: {
  ref: string;
  customerName: string;
  customerEmail: string;
  service: string;
  barber: string;
  dateLabel: string;
  time: string;
}) {
  const top    = `┌${"─".repeat(W)}┐`;
  const bottom = `└${"─".repeat(W)}┘`;

  console.log("\n" + top);
  console.log(header("APPOINTMENT EXPIRED — ADMIN NOTIFICATION"));
  console.log(divider());
  console.log(line(`Ref:      ${input.ref}`));
  console.log(line(`Customer: ${input.customerName} <${maskEmail(input.customerEmail)}>`));
  console.log(line());
  console.log(line(`Service:  ${input.service}`));
  console.log(line(`Barber:   ${input.barber}`));
  console.log(line(`Date:     ${input.dateLabel} at ${input.time}`));
  console.log(line());
  console.log(line("This pending request was not replied to before the barber's"));
  console.log(line("shift end and has been automatically marked as expired."));
  console.log(bottom + "\n");
}

export async function sendSignInLinkEmail(input: {
  email: string;
  signInUrl: string;
}) {
  const testEmail = process.env.TEST_EMAIL?.trim();
  const redactedUrl = redactTokenInUrl(input.signInUrl);

  // No Resend key — log the link to the server console for local development.
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│                  MAGIC LINK (dev mode)                   │");
  console.log("├─────────────────────────────────────────────────────────┤");
  console.log(`│  To:   ${maskEmail(input.email).padEnd(49)}│`);
  if (testEmail) {
    console.log(`│  (TEST_EMAIL: ${maskEmail(testEmail).padEnd(42)}│`);
  }
  console.log("│                                                          │");
  console.log(`│  ${redactedUrl}`);
  console.log("└─────────────────────────────────────────────────────────┘\n");
}
