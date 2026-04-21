import { describe, it, expect, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { cleanupTestDatabase } from "@/lib/test-helpers";

describe("Auth account linking", () => {
  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it("is configured to link trusted Google accounts to existing email users", () => {
    // Lock in the two flags that actually control the linking behavior. If
    // either regresses, a Google sign-in on an existing email would create a
    // duplicate User row instead of linking.
    expect(auth.options.account?.accountLinking?.enabled).toBe(true);
    expect(auth.options.account?.accountLinking?.trustedProviders).toContain("google");
  });

  it("supports one user with both credential and google accounts", async () => {
    // Sign up with email/password via Better Auth's own API so we exercise
    // the real write path (this was the path that broke on role='user').
    const res = await auth.api.signUpEmail({
      body: {
        email: "linker@example.com",
        password: "correcthorse9",
        name: "Linker",
      },
    });
    expect(res.user.email).toBe("linker@example.com");

    const after = await prisma.user.findUnique({
      where: { email: "linker@example.com" },
      include: { accounts: true },
    });
    expect(after).not.toBeNull();
    expect(after!.role).toBe("student");
    expect(after!.accounts).toHaveLength(1);
    expect(after!.accounts[0]!.providerId).toBe("credential");

    // Simulate what the OAuth callback does when a trusted provider returns a
    // verified email that matches an existing user: attach a new Account row
    // for that provider to the SAME userId. No new user is created.
    await prisma.account.create({
      data: {
        accountId: "google-sub-abc123",
        providerId: "google",
        userId: after!.id,
        accessToken: "fake-google-access",
        idToken: "fake-google-id",
        scope: "email profile",
      },
    });

    const linked = await prisma.user.findUnique({
      where: { email: "linker@example.com" },
      include: { accounts: true },
    });
    expect(linked!.id).toBe(after!.id);
    expect(linked!.accounts).toHaveLength(2);
    const providers = linked!.accounts.map((a) => a.providerId).sort();
    expect(providers).toEqual(["credential", "google"]);

    // And the (providerId, accountId) unique constraint rejects a duplicate
    // link attempt for the same Google identity — defense against a bug where
    // the callback runs twice.
    await expect(
      prisma.account.create({
        data: {
          accountId: "google-sub-abc123",
          providerId: "google",
          userId: after!.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("creates new users with role='student', not 'user'", async () => {
    // Regression test for the exact bug that broke signup: Better Auth's
    // admin plugin used to default role='user' which isn't in our enum.
    const res = await auth.api.signUpEmail({
      body: {
        email: "default-role@example.com",
        password: "correcthorse9",
        name: "Default Role",
      },
    });
    expect(res.user.email).toBe("default-role@example.com");

    const row = await prisma.user.findUnique({
      where: { email: "default-role@example.com" },
    });
    expect(row?.role).toBe("student");
  });
});
