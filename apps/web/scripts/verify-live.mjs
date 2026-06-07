// Headless verification that the live site renders the AI conclusions.
// Usage: node scripts/verify-live.mjs [url]
import { chromium } from "playwright";

const URL = process.argv[2] || "https://myanalyst.net/analyze?demo=1";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

console.log("Loading", URL);
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

// The sample auto-runs (?demo=1). Wait for the conclusions section to render.
await page.getByText("Conclusions & recommendations").first().waitFor({ timeout: 60000 });

const section = page.locator("section", { hasText: "Conclusions & recommendations" }).first();
const sectionText = await section.innerText();

const hasDisclaimer = sectionText.includes("consult a qualified professional");
const hasBadge = (await page.getByText("AI-generated").count()) > 0;
const cardCount = await section.locator("text=/based on/").count();

console.log("\n--- CONCLUSIONS SECTION (live) ---\n");
console.log(sectionText.slice(0, 1400));

console.log("\n--- CHECKS ---");
console.log("Heading present     :", true);
console.log("Disclaimer present  :", hasDisclaimer);
console.log("AI-generated badge  :", hasBadge);
console.log("Conclusion cards    :", cardCount);
console.log("Console/page errors :", errors.length, errors.slice(0, 3));

await page.screenshot({ path: "scripts/live-conclusions.png", fullPage: false });
await browser.close();

const ok = hasDisclaimer && hasBadge && cardCount >= 1 && errors.length === 0;
console.log("\nRESULT:", ok ? "PASS — conclusions render live" : "FAIL");
process.exit(ok ? 0 : 1);
