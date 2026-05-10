import Link from "next/link";

export default function DeprecatedOwnerAppointmentsPage() {
  return (
    <main className="site-shell py-16">
      <h1 className="text-3xl font-semibold">Owner token route is deprecated</h1>
      <p className="mt-3 text-[var(--muted)]">Use Google admin sign-in for appointments management.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/admin/appointments" className="btn btn-primary btn-compact">Admin appointments</Link>
        <Link href="/" className="btn btn-secondary btn-compact">Home</Link>
      </div>
    </main>
  );
}
