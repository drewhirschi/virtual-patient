import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import prisma from "./prisma";
import { seedStarterPatientActor } from "./starter-patient";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      // Google verifies email addresses, so we trust its identity claim and
      // auto-link to an existing email/password account with the same email.
      trustedProviders: ["google"],
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Runs for every signup path (email/password AND OAuth).
          try {
            await seedStarterPatientActor(user.id);
          } catch (err) {
            // Don't block signup if seeding fails; just log.
            console.error("Failed to seed starter patient actor", err);
          }
        },
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(",")
    : ["http://localhost:3000"],
  plugins: [
    admin({
      defaultRole: "instructor",
      adminRoles: ["admin"],
      impersonationSessionDuration: 60 * 60, // 1 hour
    }),
  ],
});
