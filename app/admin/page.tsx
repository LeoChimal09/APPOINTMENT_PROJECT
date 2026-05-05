import Link from "next/link";

const modules = [
  {
    name: "Appointments",
    description: "View and manage customer appointment requests.",
    href: "/admin/appointments",
    cta: "Open appointments",
    status: "Live",
  },
  {
    name: "Staff",
    description: "Manage staff members and their availability.",
    href: "/admin/staff",
    cta: "Manage staff",
    status: "Live",
  },
  {
    name: "Building",
    description: "Set operating hours and business settings.",
    href: "/admin/staff?tab=building",
    cta: "Manage building hours",
    status: "Live",
  },
];

export default function AdminPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-12">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[color:var(--surface-elevated)] p-8 shadow-[0_24px_80px_var(--shadow-elevated)]">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
          Admin area
        </p>
        <h1 className="mt-3 text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
          Dashboard
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--muted)]">
          Manage modules for appointments and future business operations.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {modules.map((module) => (
          <article
            key={module.name}
            className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">{module.name}</h2>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {module.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{module.description}</p>
            {module.href && module.cta ? (
              <Link
                href={module.href}
                className="mt-6 inline-flex rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-4 py-2 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
              >
                {module.cta}
              </Link>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
