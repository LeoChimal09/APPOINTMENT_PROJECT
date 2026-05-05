import { createHash } from "crypto";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { decode as defaultDecode, encode as defaultEncode } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { consumeEmailVerificationToken } from "@/server/repositories/email-verification-repository";
import { getCustomerByEmail, createCustomer } from "@/server/repositories/customers-repository";
import { checkRateLimit } from "@/lib/rate-limiter";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return getAdminEmails().includes(email.trim().toLowerCase());
}

function hashVerificationToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  jwt: {
    async encode(params) {
      return defaultEncode(params);
    },
    async decode(params) {
      try {
        return await defaultDecode(params);
      } catch {
        // Stale or invalid encrypted session token; treat as signed-out.
        return null;
      }
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID ?? "",
      clientSecret: process.env.GOOGLE_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
        verificationToken: { label: "Verification Token", type: "text" },
      },
      async authorize(credentials) {
        const email = (credentials?.email ?? "").trim().toLowerCase();
        if (!email) return null;

        if (isAdminEmail(email)) {
          throw new Error("ADMIN_GOOGLE_REQUIRED");
        }

        const rateLimitKey = `auth:${email}`;
        const rateLimit = Math.max(1, Number(process.env.AUTH_RATE_LIMIT_ATTEMPTS ?? "10"));
        const rateWindowMs =
          Math.max(1, Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? "60")) * 1000;

        const rateLimitResult = await checkRateLimit(rateLimitKey, rateLimit, rateWindowMs);
        if (rateLimitResult.limited) {
          throw new Error(`RATE_LIMITED:${rateLimitResult.remaining}`);
        }

        const verificationToken = (credentials?.verificationToken ?? "").trim();
        if (!verificationToken) {
          throw new Error("VERIFICATION_REQUIRED");
        }

        const tokenRow = await consumeEmailVerificationToken(
          email,
          hashVerificationToken(verificationToken),
        );

        if (!tokenRow) {
          throw new Error("INVALID_OR_EXPIRED_LINK");
        }

        let customer = await getCustomerByEmail(email);
        if (!customer) {
          const name =
            tokenRow.name?.trim() || (credentials?.name ?? "").trim();
          if (!name) {
            throw new Error("ACCOUNT_NOT_FOUND");
          }
          customer = await createCustomer(email, name);
        }

        if (!customer) return null;

        return {
          id: String(customer.id),
          email: customer.email,
          name: customer.name,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.trim().toLowerCase();
        if (!email) return false;

        // Admin accounts must use Google, while non-admin users should use email links.
        if (!isAdminEmail(email)) {
          return false;
        }

        let customer = await getCustomerByEmail(email);
        if (!customer) {
          customer = await createCustomer(email, user.name ?? email);
        }

        return !!customer;
      }

      if (account?.provider === "credentials") {
        const email = user.email?.trim().toLowerCase();
        if (email && isAdminEmail(email)) {
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
        token.name = user.name;
      }

      token.isAdmin = isAdminEmail((token.email as string | undefined) ?? user?.email ?? null);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string | undefined) ?? session.user.email;
        session.user.name = (token.name as string | undefined) ?? session.user.name;
        (session.user as { isAdmin?: boolean }).isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
};

export async function getAuthSession() {
  return getServerSession(authOptions);
}
