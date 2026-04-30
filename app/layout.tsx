import type { Metadata } from "next";
import { CustomerHeader } from "@/app/components/customer-header";
import { AuthProvider } from "@/app/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cutting Edge",
  description: "Customer-first barber appointment booking experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-background text-foreground flex flex-col font-sans">
        <AuthProvider>
          <CustomerHeader />
          <div className="flex-1 pt-[clamp(7.25rem,14vw,8.75rem)]">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
