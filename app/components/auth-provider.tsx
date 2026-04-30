"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";
import { setStoredCustomerEmail } from "@/lib/appointments/customer-session";

function SessionEmailSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.email) {
      setStoredCustomerEmail(session.user.email);
    }
  }, [session?.user?.email]);

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionEmailSync />
      {children}
    </SessionProvider>
  );
}
