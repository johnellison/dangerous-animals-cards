#!/usr/bin/env node

/**
 * Download dinosaur images from Wikipedia
 *
 * Usage:
 *   node scripts/download-dinosaur-images.cjs           # download missing images only
 *   node scripts/download-dinosaur-images.cjs --force   # re-download all images
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(PROJECT_ROOT, "images", "dinosaurs");

const DINOSAUR_IMAGES = {
  "tyrannosaurus-rex": "Tyrannosaurus",
  "triceratops": "Triceratops",
  "velociraptor": "Velociraptor",
  "stegosaurus": "Stegosaurus",
  "brachiosaurus": "Brachiosaurus",
  "spinosaurus": "Spinosaurus",
  "ankylosaurus": "Ankylosaurus",
  "allosaurus": "Allosaurus",
  "diplodocus": "Diplodocus",
  "apatosaurus": "Apatosaurus",
  "dilophosaurus": "Dilophosaurus",
  "pachycephalosaurus": "Pachycephalosaurus",
  "parasaurolophus": "Parasaurolophus",
  "carnotaurus": "Carnotaurus",
  "giganotosaurus": "Giganotosaurus",
  "therizinosaurus": "Therizinosaurus",
  "deinonychus": "Deinonychus",
  "iguanodon": "Iguanodon",
  "baryonyx": "Baryonyx",
  "ceratosaurus": "Ceratosaurus",
  "albertosaurus": "Albertosaurus",
};

const forceFlag = process.argv.includes("--force");

function findExistingFile(dinoId) {
  try {
    const files = fs.readdirSync(IMAGES_DIR);
    for (const file of files) {
      const nameWithoutExt = path.parse(file).name;
      if (nameWithoutExt === dinoId) {
        return path.join(IMAGES_DIR, file);
      }
    }
  } catch {
    // directory might not exist yet
  }
  return null;
}

function extensionFromUrl(imageUrl) {
  try {
    const pathname = new URL(imageUrl).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"].includes(ext)) {
      return ext;
    }
  } catch {
    // ignore
  }
  return ".jpg";
}

function httpsGet(requestUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error("Too many redirects"));
    }

    const parsed = new URL(requestUrl);
    const transport = parsed.protocol === "https:" ? https : http;

    const req = transport.get(
      requestUrl,
      {
        headers: {
          "User-Agent": "DinosaurCardGame/1.0 (educational project)",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, requestUrl).href;
          res.resume();
          return resolve(httpsGet(redirectUrl, maxRedirects - 1));
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${requestUrl}`));
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${requestUrl}`));
    });
  });
}

async function fetchWikipediaImageUrl(title) {
  const apiUrl =
    `https://en.wikipedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent(title)}` +
    `&prop=pageimages&pithumbsize=800&format=json`;

  const body = await httpsGet(apiUrl);
  const json = JSON.parse(body.toString("utf-8"));

  const pages = json.query && json.query.pages;
  if (!pages) return null;

  const pageId = Object.keys(pages)[0];
  if (!pageId || pageId === "-1") return null;

  const page = pages[pageId];
  return (page.thumbnail && page.thumbnail.source) || null;
}

async function downloadFile(imageUrl, destPath) {
  const data = await httpsGet(imageUrl);
  fs.writeFileSync(destPath, data);
}

async function main() {
  console.log("=== Dinosaur Image Downloader ===\n");
  console.log(`Images directory : ${IMAGES_DIR}`);
  console.log(`Force re-download: ${forceFlag ? "YES" : "NO"}`);
  console.log(`Total dinosaurs  : ${Object.keys(DINOSAUR_IMAGES).length}\n`);

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log(`Created directory: ${IMAGES_DIR}\n`);
  }

  const results = { downloaded: [], skipped: [], failed: [] };
  const dinoIds = Object.keys(DINOSAUR_IMAGES);

  for (let i = 0; i < dinoIds.length; i++) {
    const dinoId = dinoIds[i];
    const wikiTitle = DINOSAUR_IMAGES[dinoId];
    const progress = `[${i + 1}/${dinoIds.length}]`;

    const existingFile = findExistingFile(dinoId);

    if (existingFile && !forceFlag) {
      console.log(`${progress} SKIP   ${dinoId} (already exists: ${path.basename(existingFile)})`);
      results.skipped.push(dinoId);
      continue;
    }

    try {
      process.stdout.write(`${progress} FETCH  ${dinoId} (${wikiTitle})...`);
      const imageUrl = await fetchWikipediaImageUrl(wikiTitle);

      if (!imageUrl) {
        console.log(" NO IMAGE FOUND on Wikipedia");
        results.failed.push({ dinoId, reason: "No thumbnail on Wikipedia page" });
        continue;
      }

      const ext = extensionFromUrl(imageUrl);
      const destPath = path.join(IMAGES_DIR, `${dinoId}${ext}`);

      if (existingFile && existingFile !== destPath) {
        fs.unlinkSync(existingFile);
      }

      process.stdout.write(` downloading...`);
      await downloadFile(imageUrl, destPath);

      const stats = fs.statSync(destPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(` OK (${sizeKB} KB) -> ${path.basename(destPath)}`);
      results.downloaded.push(dinoId);
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
      results.failed.push({ dinoId, reason: err.message });
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Downloaded : ${results.downloaded.length}`);
  console.log(`Skipped    : ${results.skipped.length}`);
  console.log(`Failed     : ${results.failed.length}`);

  if (results.downloaded.length > 0) {
    console.log(`\nDownloaded images:`);
    results.downloaded.forEach((id) => console.log(`  + ${id}`));
  }

  if (results.failed.length > 0) {
    console.log(`\nFailed images:`);
    results.failed.forEach(({ dinoId, reason }) =>
      console.log(`  ! ${dinoId}: ${reason}`)
    );
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
