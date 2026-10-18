import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

async function verifyWithXiaomiApi(cUserId: string, serviceToken: string, tokenName: string, region: string = "global") {
  console.log("\n=======================================================");
  console.log(` Menguji cookie [${tokenName}] ke endpoint Xiaomi API...`);
  console.log(` cUserId: ${cUserId}`);
  console.log(` token  : ${serviceToken.substring(0, 25)}...`);
  console.log("=======================================================");

  const url = `https://new.c.mi.com/${region}/user/bl-switch/state`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Cookie": `cUserId=${cUserId}; serviceToken=${serviceToken}`,
        "User-Agent": "Mozilla/5.0 (Linux; Android 14; 23117PN0CG Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.88 Mobile Safari/537.36 XiaoMi/MiuiBrowser/4.3",
        "Accept": "application/json, text/plain, */*",
      },
    });

    const data = await res.json();
    console.log("HTTP Status:", res.status);
    console.log("Xiaomi API Response:\n", JSON.stringify(data, null, 2));

    if (data.code === 0) {
      console.log(`\n🎉 [SUCCESS] KREDENSIAL VALID 100%!`);
      console.log(`- button_state : ${data.data?.button_state ?? data.data?.buttonState}`);
      console.log(`- is_pass      : ${data.data?.is_pass ?? data.data?.isPass}`);
      console.log(`- deadline     : ${data.data?.deadline_format ?? data.data?.deadlineFormat ?? "N/A"}`);
    } else {
      console.log(`\n[RESPONSE] Server Xiaomi mengembalikan code: ${data.code} (${data.message})`);
    }
    return data;
  } catch (err: any) {
    console.error("[ERROR] Gagal menghubungi Xiaomi API:", err.message);
    return null;
  }
}

async function main() {
  console.log("=======================================================");
  console.log(" OpenMi - Interactive Xiaomi Live Cookie Capture v3");
  console.log("=======================================================\n");

  const userDataDir = path.resolve(process.cwd(), ".chrome-session");

  console.log("Membuka Google Chrome dengan sesi tersimpan...");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: "chrome",
    args: ["--start-maximized"],
    viewport: null,
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log("Membuka halaman Xiaomi Community Global...");
  await page.goto("https://new.c.mi.com/global", { waitUntil: "domcontentloaded" });

  let isDone = false;
  let capturedCookies: any[] = [];
  const maxAttempts = 300;
  let attempts = 0;
  let navigatedToLock = false;

  console.log("[Status] Menunggu login & sinkronisasi token serviceToken...");

  while (!isDone && attempts < maxAttempts) {
    attempts++;
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const currentCookies = await context.cookies();
      const currentUrl = page.url();

      // Check for valid non-empty tokens
      const serviceTokenCookie = currentCookies.find(
        (c) =>
          (c.name === "serviceToken" || c.name === "new_bbs_serviceToken" || c.name === "bbs_serviceToken") &&
          c.value &&
          c.value.trim().length > 5
      );

      const userCookie = currentCookies.find(
        (c) => (c.name === "cUserId" || c.name === "userId") && c.value && c.value.trim().length > 0
      );

      const passTokenCookie = currentCookies.find(
        (c) => c.name === "passToken" && c.value && c.value.trim().length > 5
      );

      // If user has logged in (passToken exists) but serviceToken not yet generated on mi.com,
      // navigate to the bootloader unlock page to trigger the SSO serviceToken exchange!
      if (passTokenCookie && !serviceTokenCookie && !navigatedToLock && currentUrl.includes("mi.com")) {
        console.log("\n[Info] Mendeteksi login berhasil! Membuka halaman Bootloader Unlock untuk sinkronisasi serviceToken...");
        navigatedToLock = true;
        await page.goto("https://new.c.mi.com/global/embedded/app/bl/lock", { waitUntil: "domcontentloaded" });
        continue;
      }

      // If both user and serviceToken are ready:
      if (userCookie && serviceTokenCookie) {
        console.log(`\n🎉 [Auto-Detect] SERVICE TOKEN BERHASIL DITANGKAP pada attempt ${attempts}!`);
        console.log(`- Token Name : ${serviceTokenCookie.name}`);
        console.log(`- Domain     : ${serviceTokenCookie.domain}`);
        console.log(`- cUserId    : ${userCookie.value}`);
        capturedCookies = currentCookies;
        isDone = true;
        break;
      }
    } catch {
      // Ignore navigation errors
    }
  }

  if (capturedCookies.length === 0) {
    capturedCookies = await context.cookies();
  }

  console.log(`\nTotal ${capturedCookies.length} cookie ditemukan.`);
  console.log("---------------------------------------------------------------------------------------------------");
  console.log("| Nama Cookie               | Domain                         | Value (Preview)      | HTTP |");
  console.log("---------------------------------------------------------------------------------------------------");

  let cUserId = "";
  let serviceToken = "";
  let bbsServiceToken = "";
  let newBbsServiceToken = "";

  for (const c of capturedCookies) {
    const valPreview = c.value.length > 25 ? `${c.value.substring(0, 22)}...` : c.value || "<EMPTY>";
    console.log(
      `| ${c.name.padEnd(25)} | ${c.domain.padEnd(30)} | ${valPreview.padEnd(20)} | ${c.httpOnly ? "Yes" : "No "} |`
    );

    if (c.name === "cUserId" && c.value) cUserId = c.value;
    if (c.name === "userId" && !cUserId && c.value) cUserId = c.value;
    if (c.name === "serviceToken" && c.value) serviceToken = c.value;
    if (c.name === "bbs_serviceToken" && c.value) bbsServiceToken = c.value;
    if (c.name === "new_bbs_serviceToken" && c.value) newBbsServiceToken = c.value;
  }
  console.log("---------------------------------------------------------------------------------------------------\n");

  const activeToken = serviceToken || newBbsServiceToken || bbsServiceToken;
  const activeTokenName = serviceToken ? "serviceToken" : newBbsServiceToken ? "new_bbs_serviceToken" : "bbs_serviceToken";

  console.log("HASIL EKSTRAKSI KREDENSIAL XIAOMI:");
  console.log(`cUserId      : ${cUserId || "KOSONG"}`);
  console.log(`serviceToken : ${activeToken ? activeToken.substring(0, 30) + "... (Length: " + activeToken.length + ")" : "KOSONG"}`);

  // Save to file
  const outputPath = path.resolve(process.cwd(), "captured-cookies.json");
  const outputData = {
    capturedAt: new Date().toISOString(),
    totalCookies: capturedCookies.length,
    foundKeyCredentials: {
      cUserId,
      serviceToken: activeToken || null,
      tokenName: activeTokenName,
    },
    allCookies: capturedCookies,
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf-8");
  console.log(`\nSeluruh data cookie telah disimpan ke: ${outputPath}`);

  if (cUserId && activeToken) {
    await verifyWithXiaomiApi(cUserId, activeToken, activeTokenName, "global");
  }

  console.log("\nBrowser akan tetap terbuka selama 40 detik untuk observasi Anda...");
  await new Promise((r) => setTimeout(r, 40000));
  await context.close();
  console.log("Browser ditutup. Selesai!");
}

main().catch(console.error);
