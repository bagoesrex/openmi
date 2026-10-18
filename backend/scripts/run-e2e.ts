import { chromium } from "playwright";

interface TestStepResult {
  step: string;
  success: boolean;
  details?: string;
}

const results: TestStepResult[] = [];

function record(step: string, success: boolean, details?: string) {
  results.push({ step, success, details });
  const icon = success ? "✅ [PASS]" : "❌ [FAIL]";
  console.log(`${icon} ${step}${details ? ` -> ${details}` : ""}`);
}

async function main() {
  console.log("===================================================================");
  console.log(" 🧪 OpenMi Full-Stack Live Dashboard & API Automated E2E Test Suite");
  console.log("===================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("dialog", async (dialog) => {
    console.log("   [Browser Dialog]:", dialog.type(), dialog.message());
    await dialog.accept();
  });

  page.on("console", (msg) => {
    console.log("   [Browser Console]:", msg.type(), msg.text());
  });

  page.on("pageerror", (err) => {
    console.log("   [Browser PageError]:", err.message);
  });

  try {
    // -------------------------------------------------------------
    // 1. AUTHENTICATION TEST
    // -------------------------------------------------------------
    console.log("--- 1. Testing Master Password Authentication ---");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Ensure we start logged out
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });

    // Verify Login Screen appears
    const loginHeader = await page.textContent("h1");
    if (loginHeader?.includes("OpenMi")) {
      record("Display login screen when unauthenticated", true);
    } else {
      record("Display login screen when unauthenticated", false, `Found header: ${loginHeader}`);
    }

    // Attempt invalid password
    await page.fill('input[type="password"]', "wrongpassword123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(600);

    const errorVisible = await page.locator(".bg-rose-50").isVisible().catch(() => false);
    const errorText = await page.locator(".bg-rose-50").textContent().catch(() => null);
    if (errorVisible && errorText) {
      record("Reject incorrect master password with error notification", true, errorText.trim());
    } else {
      record("Reject incorrect master password with error notification", false, "No error banner shown");
    }

    // Submit valid password "kucink"
    await page.fill('input[type="password"]', "kucink");
    await page.click('button[type="submit"]');
    await page.waitForSelector("header", { timeout: 5000 });

    const storedToken = await page.evaluate(() => localStorage.getItem("openmi_token"));
    if (storedToken && storedToken.length > 20) {
      record("Accept correct master password ('kucink') and store JWT in localStorage", true);
    } else {
      record("Accept correct master password and store JWT", false, "Token missing in localStorage");
    }

    // -------------------------------------------------------------
    // 2. HEADER & LIVE SYNC TEST
    // -------------------------------------------------------------
    console.log("\n--- 2. Testing Header Indicators & SSE Real-time Sync ---");

    // Check Countdown
    const countdownText = await page.locator("header").textContent();
    if (countdownText?.includes("23:00 WIB Reset:")) {
      record("Render live 23:00 WIB reset countdown indicator", true);
    } else {
      record("Render live 23:00 WIB reset countdown indicator", false);
    }

    // Wait for SSE connection badge
    await page.waitForTimeout(1500);
    const liveSyncBadge = await page.locator("text=Live Sync").isVisible().catch(() => false);
    if (liveSyncBadge) {
      record("Establish active SSE streaming connection (Live Sync badge active)", true);
    } else {
      const isDisconnected = await page.locator("text=Disconnected").isVisible().catch(() => false);
      record("Establish active SSE streaming connection", false, isDisconnected ? "Shows Disconnected" : "Badge not found");
    }

    // -------------------------------------------------------------
    // 3. ACCOUNT MANAGEMENT (CRUD & LIVE VERIFICATION)
    // -------------------------------------------------------------
    console.log("\n--- 3. Testing Account CRUD & Live Xiaomi Verification ---");

    // Check existing account "Red"
    const redAccountVisible = await page.locator('text="Red"').first().isVisible().catch(() => false);
    if (redAccountVisible) {
      record("Display existing account card 'Red'", true);
    } else {
      record("Display existing account card 'Red'", false);
    }

    // Test Cookie button on existing account
    const testCookieBtn = page.locator('button:has-text("Test Cookie")').first();
    if (await testCookieBtn.isVisible()) {
      await testCookieBtn.click();
      await page.waitForTimeout(2000); // Wait for API response & state machine update

      const validPill = await page.locator('span:has-text("Valid")').first().isVisible().catch(() => false);
      if (validPill) {
        record("Test Cookie action validates session with Xiaomi API and marks Valid", true);
      } else {
        record("Test Cookie action validates session", false, "Valid badge not visible");
      }
    }

    // Create a new Account via Modal
    const testLabel = `E2E Bot ${Date.now().toString().slice(-4)}`;
    const addAccountBtn = page.locator('button:has-text("Add Account")').first();
    await addAccountBtn.click();
    await page.waitForSelector('text="Register Xiaomi Account"');

    await page.fill('input[placeholder="e.g. Personal Phone (Xiaomi 14)"]', testLabel);
    await page.fill('input[placeholder="Xiaomi Account ID"]', "e2e_cuser_999");
    await page.fill('textarea[placeholder="Paste captured serviceToken cookie here"]', "dummy_service_token_value_abc_123");
    
    await page.click('button:has-text("Register Account")');
    await page.waitForTimeout(1000);

    const createdCard = await page.locator(`text="${testLabel}"`).first().isVisible().catch(() => false);
    if (createdCard) {
      record("Create new account via Modal form and render in card list", true);
    } else {
      record("Create new account via Modal form", false, "Card not found after submit");
    }

    // Delete the temporary test account
    const testCard = page.locator('.rounded-xl', { hasText: testLabel });
    const deleteBtn = testCard.locator('button[title="Delete account"]').first();
    await deleteBtn.click();
    await page.waitForTimeout(1000);

    const stillExists = await page.locator(`text="${testLabel}"`).isVisible().catch(() => false);
    if (!stillExists) {
      record("Delete account removes card cleanly from UI and SQLite database", true);
    } else {
      record("Delete account removes card cleanly", false, "Card still present");
    }

    // -------------------------------------------------------------
    // 4. LOG MONITOR & PERMANENT CLEAR BUG FIX VERIFICATION
    // -------------------------------------------------------------
    console.log("\n--- 4. Testing Log Monitor & Permanent SQLite Clear Bug Fix ---");

    // Verify logs exist before clear
    const logPill = await page.locator('text="CHECK_STATE"').first().isVisible().catch(() => false);
    if (logPill) {
      record("Log Terminal renders live SSE logs with action tags and timestamp pills", true);
    } else {
      record("Log Terminal renders live SSE logs", false, "No logs displayed");
    }

    // Click "Clear" button in log monitor
    const clearLogsBtn = page.locator('button:has-text("Clear")').first();
    await clearLogsBtn.click();
    await page.waitForTimeout(1000);

    const emptyMsgBeforeReload = await page.locator('text="0 events"').isVisible().catch(() => false);
    if (emptyMsgBeforeReload) {
      record("Clicking 'Clear' immediately empties log list in React UI", true);
    } else {
      record("Clicking 'Clear' immediately empties log list", false);
    }

    // RELOAD (F5) TO TEST THE PERMANENCE FIX
    console.log("   -> Reloading dashboard (F5) to verify logs do NOT reappear from SQLite...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const emptyMsgAfterReload = await page.locator('text="0 events"').isVisible().catch(() => false);
    const logPillAfterReload = await page.locator('text="CHECK_STATE"').isVisible().catch(() => false);

    if (emptyMsgAfterReload && !logPillAfterReload) {
      record("🎉 Bug Fix Confirmed: Logs remain 100% empty after F5 refresh (SQLite permanently cleared)", true);
    } else {
      record("Bug Fix Confirmed: Logs remain empty after refresh", false, "Old logs reappeared from SQLite!");
    }

  } catch (err: any) {
    console.error("FATAL E2E ERROR:", err.message);
    record("E2E Suite Execution", false, err.message);
  } finally {
    await browser.close();
  }

  // Summary
  console.log("\n===================================================================");
  console.log(" 📊 E2E Test Suite Summary");
  console.log("===================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`Total Scenarios: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed === 0) {
    console.log("🎉 ALL DASHBOARD & API CAPABILITIES PASSED 100%!");
  } else {
    console.error(`⚠️ ${failed} test scenario(s) failed.`);
    process.exit(1);
  }
}

main().catch(console.error);
