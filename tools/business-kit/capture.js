// Screenshots of the guest site and the organiser portal at phone, tablet and
// desktop sizes, driven through the real UI in headless Chrome.
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const DEVICES = {
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function settle(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  await wait(500);
}
async function scrollTo(page, selector, offset) {
  await page.evaluate((sel, off) => {
    const el = document.querySelector(sel);
    if (el) window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - off);
  }, selector, offset);
  await wait(450);
}
async function openSite(page, base, device) {
  await page.setViewport(DEVICES[device]);
  await page.goto(base + "/?g=guest_demo", { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
  await settle(page);
}
async function openInvite(page) {
  await page.click("#openInviteBtn");
  await wait(1300);
}
async function openPortal(page, base, device, tab) {
  await page.setViewport(DEVICES[device]);
  await page.goto(base + "/admin", { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
  await settle(page);
  if (tab) {
    await page.evaluate((t) => {
      const btn = document.querySelector('.navitem[data-tab="' + t + '"]');
      if (btn && btn.offsetParent) btn.click();
      else { const sel = document.getElementById("mobileNavSelect"); sel.value = t; sel.dispatchEvent(new Event("change")); }
    }, tab);
    await wait(400);
  }
}

async function capture(base, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--hide-scrollbars", "--force-color-profile=srgb", "--lang=en-GB"] });
  const page = await browser.newPage();
  const shots = [];
  async function shot(name, device, fn) {
    await fn();
    const file = path.join(outDir, name + ".png");
    await page.screenshot({ path: file });
    shots.push({ name, device, file });
    console.log("  captured", name);
  }

  // ---------- guest site ----------
  await shot("site-phone-cover", "phone", async () => { await openSite(page, base, "phone"); });
  await shot("site-phone-home", "phone", async () => { await openInvite(page); await page.evaluate(() => window.scrollTo(0, 0)); await wait(300); });
  await shot("site-phone-rsvp", "phone", async () => { await scrollTo(page, ".rsvp-stage", 70); });
  await shot("site-phone-card", "phone", async () => { await scrollTo(page, "#inviteCard", 90); });
  await shot("site-phone-programme", "phone", async () => { await scrollTo(page, "#programme .head", 20); });

  await shot("site-tablet-home", "tablet", async () => { await openSite(page, base, "tablet"); await openInvite(page); await page.evaluate(() => window.scrollTo(0, 0)); await wait(300); });
  await shot("site-tablet-lovenote", "tablet", async () => { await scrollTo(page, ".message-card", 140); });
  await shot("site-tablet-card", "tablet", async () => { await scrollTo(page, "#card .head", 40); });

  await shot("site-desktop-cover", "desktop", async () => { await openSite(page, base, "desktop"); });
  await shot("site-desktop-home", "desktop", async () => { await openInvite(page); await page.evaluate(() => window.scrollTo(0, 0)); await wait(300); });
  await shot("site-desktop-card", "desktop", async () => { await scrollTo(page, "#card .head", 90); });
  await shot("site-desktop-rsvp", "desktop", async () => {
    await page.evaluate(() => {
      document.getElementById("toStep1").click();
      document.querySelector('#attendChoices input[value="attending"]').click();
      document.getElementById("toStep2").click();
      document.getElementById("incGuests").click();
      document.getElementById("g-message").value = "Can't wait to celebrate with you both!";
      document.getElementById("toStep3").click();
      document.getElementById("otherWays").open = true;
    });
    await wait(300);
    await scrollTo(page, ".rsvp-stage", 90);
  });

  // ---------- organiser portal (demo data) ----------
  await shot("portal-desktop-dashboard", "desktop", async () => { await openPortal(page, base, "desktop", "dashboard"); });
  await shot("portal-desktop-guests", "desktop", async () => { await openPortal(page, base, "desktop", "guests"); });
  await shot("portal-desktop-approvals", "desktop", async () => { await openPortal(page, base, "desktop", "approvals"); });
  await shot("portal-desktop-gifts", "desktop", async () => { await openPortal(page, base, "desktop", "gifts"); });
  await shot("portal-desktop-providers", "desktop", async () => { await openPortal(page, base, "desktop", "providers"); });
  await shot("portal-desktop-reports", "desktop", async () => { await openPortal(page, base, "desktop", "reports"); });
  await shot("portal-desktop-badge", "desktop", async () => {
    await openPortal(page, base, "desktop", "guests");
    await page.evaluate(() => document.querySelector('#guestRows .icon-btn[data-action="badge"][data-id="g8"]').click());
    await wait(1800);
  });
  await shot("portal-tablet-dashboard", "tablet", async () => { await openPortal(page, base, "tablet", "dashboard"); });
  await shot("portal-tablet-guests", "tablet", async () => { await openPortal(page, base, "tablet", "guests"); });
  await shot("portal-phone-dashboard", "phone", async () => { await openPortal(page, base, "phone", "dashboard"); });
  await shot("portal-phone-checkin", "phone", async () => {
    await openPortal(page, base, "phone", "checkin");
    await page.evaluate(() => { const s = document.getElementById("checkinSearch"); s.value = "Ru"; s.dispatchEvent(new Event("input")); });
    await wait(300);
    await scrollTo(page, "#checkinSearch", 170);
  });

  await browser.close();
  return shots;
}

module.exports = { capture, DEVICES };
