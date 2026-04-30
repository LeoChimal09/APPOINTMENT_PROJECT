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

  return children;
}
