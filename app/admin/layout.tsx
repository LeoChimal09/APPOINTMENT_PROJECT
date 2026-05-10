import { redirect } from "next/navigation";
import { getAuthSession, isAdminEmail } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (!isAdminEmail(session?.user?.email)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_center,rgba(255,255,255,0.22),transparent_34%),linear-gradient(180deg,#efefef_0%,var(--section-sand)_100%)]">
      {children}
    </div>
  );
}
