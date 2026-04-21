import { test, expect } from "@playwright/test";
import { deleteUserByEmail, getUserByEmail, uniqueEmail } from "./helpers";

const PASSWORD = "CorrectHorse9!";

test.describe("Signup", () => {
  test("creates a user with role=student and redirects home", async ({ page }) => {
    const email = uniqueEmail("signup-happy");
    try {
      await page.goto("/signup");
      await page.getByLabel("Name").fill("Happy Path");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirm Password").fill(PASSWORD);
      await page.getByRole("button", { name: /sign up/i }).click();

      await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });

      const user = await getUserByEmail(email);
      expect(user).not.toBeNull();
      expect(user?.role).toBe("student");
      const credentialAccounts = user?.accounts.filter((a) => a.providerId === "credential") ?? [];
      expect(credentialAccounts).toHaveLength(1);
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("rejects duplicate email", async ({ page }) => {
    const email = uniqueEmail("signup-dupe");
    try {
      // First signup.
      await page.goto("/signup");
      await page.getByLabel("Name").fill("Original");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirm Password").fill(PASSWORD);
      await page.getByRole("button", { name: /sign up/i }).click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });

      // Sign out via context to start the second attempt fresh.
      await page.context().clearCookies();

      // Second signup with same email.
      await page.goto("/signup");
      await page.getByLabel("Name").fill("Duplicate");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirm Password").fill(PASSWORD);
      await page.getByRole("button", { name: /sign up/i }).click();

      await expect(page.locator("div.bg-red-50")).toBeVisible({ timeout: 10_000 });
      await expect(page).toHaveURL(/\/signup/);
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("rejects a short password server-side", async ({ page }) => {
    const email = uniqueEmail("signup-weak");
    try {
      await page.goto("/signup");
      // Bypass the client minLength by toggling the input's constraint.
      await page.evaluate(() => {
        const pwd = document.querySelector<HTMLInputElement>("#password");
        const confirm = document.querySelector<HTMLInputElement>("#confirmPassword");
        if (pwd) pwd.removeAttribute("minLength");
        if (confirm) confirm.removeAttribute("minLength");
      });
      await page.getByLabel("Name").fill("Weak");
      await page.getByLabel("Email").fill(email);
      // Long enough to pass the client-side >=8 check so the server is the gate we test.
      // We instead patch the client check out by overriding fetch? Too fragile.
      // Simpler: call the API directly from the page context with a short password.
      const status = await page.evaluate(async (testEmail) => {
        const res = await fetch("/api/auth/sign-up/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: testEmail, password: "short", name: "Weak" }),
        });
        return res.status;
      }, email);
      expect(status).toBeGreaterThanOrEqual(400);
      const user = await getUserByEmail(email);
      expect(user).toBeNull();
    } finally {
      await deleteUserByEmail(email);
    }
  });
});

test.describe("Login", () => {
  test("signs in with correct credentials", async ({ page }) => {
    const email = uniqueEmail("login-happy");
    try {
      // Seed via signup.
      await page.goto("/signup");
      await page.getByLabel("Name").fill("Login Me");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirm Password").fill(PASSWORD);
      await page.getByRole("button", { name: /sign up/i }).click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
      await page.context().clearCookies();

      // Log back in.
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("rejects wrong password", async ({ page }) => {
    const email = uniqueEmail("login-wrong");
    try {
      await page.goto("/signup");
      await page.getByLabel("Name").fill("Wrong PW");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirm Password").fill(PASSWORD);
      await page.getByRole("button", { name: /sign up/i }).click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
      await page.context().clearCookies();

      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill("wrongpass123");
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await expect(page.locator("div.bg-red-50")).toBeVisible({ timeout: 10_000 });
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await deleteUserByEmail(email);
    }
  });
});

test.describe("Protected routes", () => {
  test("unauthenticated /patient-actors redirects to /login with returnUrl", async ({ page }) => {
    await page.context().clearCookies();
    const response = await page.goto("/patient-actors");
    // Either we followed the redirect and the final URL is /login, or we got a 3xx first.
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fpatient-actors/);
    expect(response?.status()).toBeLessThan(500);
  });

  test("unauthenticated / redirects to /login with returnUrl", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?returnUrl=%2F$/);
  });
});

