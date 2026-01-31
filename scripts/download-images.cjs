#!/usr/bin/env node

/**
 * Download animal images from Wikipedia
 *
 * Usage:
 *   node scripts/download-images.js           # download missing images only
 *   node scripts/download-images.js --force   # re-download all images
 *
 * Uses the Wikipedia API to fetch page thumbnail images and saves them
 * to images/animals/ with the correct file extension.
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(PROJECT_ROOT, "images", "animals");

// Animals with WRONG images that must always be re-downloaded
const WRONG_IMAGES = {
  "blue-ringed-octopus": "Blue-ringed_octopus",
  "red-kite": "Red_kite",
  "peregrine-falcon": "Peregrine_falcon",
  "barn-owl": "Barn_owl",
};

// Animals with MISSING images
const MISSING_IMAGES = {
  "red-eyed-tree-frog": "Agalychnis_callidryas",
  "tomato-frog": "Dyscophus_antongilii",
  "cane-toad": "Cane_toad",
  "brazilian-wandering-spider": "Phoneutria",
  "black-widow": "Latrodectus_mactans",
  "brown-recluse": "Brown_recluse_spider",
  "redback-spider": "Redback_spider",
  "goliath-birdeater": "Goliath_birdeater",
  "camel-spider": "Solifugae",
  "deathstalker-scorpion": "Deathstalker",
  "emperor-scorpion": "Emperor_scorpion",
  "arizona-bark-scorpion": "Arizona_bark_scorpion",
  "harpy-eagle": "Harpy_eagle",
  "cassowary": "Cassowary",
  "secretary-bird": "Secretarybird",
  "shortfin-mako": "Shortfin_mako_shark",
  "goblin-shark": "Goblin_shark",
  "thresher-shark": "Thresher_shark",
  "oceanic-whitetip": "Oceanic_whitetip_shark",
  "blue-shark": "Blue_shark",
};

// NEW animal images to download
const NEW_IMAGES = {
  "golden-tailed-gecko": "Strophurus_taenicauda",
  "cardboard-frog": "Pouched_frog",
  "frill-necked-lizard": "Frill-necked_lizard",
  "blue-banded-bee": "Amegilla_cingulata",
  "green-tree-python": "Green_tree_python",
  "bulloak-jewel-butterfly": "Hypochrysops",
  "tree-iguana": "Green_iguana",
  "blue-tongued-lizard": "Blue-tongued_skink",
  "australian-tiger-moth": "Amata_(moth)",
  "indian-red-scorpion": "Hottentotta_tamulus",
  "fattail-scorpion": "Fat-tailed_scorpion",
  "striped-bark-scorpion": "Striped_bark_scorpion",
};

// Combined mapping of all animals to download
const ALL_ANIMALS = {
  ...WRONG_IMAGES,
  ...MISSING_IMAGES,
  ...NEW_IMAGES,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const forceFlag = process.argv.includes("--force");

/**
 * Find any existing file for a given animal ID (any extension).
 * Returns the full path if found, or null.
 */
function findExistingFile(animalId) {
  try {
    const files = fs.readdirSync(IMAGES_DIR);
    for (const file of files) {
      const nameWithoutExt = path.parse(file).name;
      if (nameWithoutExt === animalId) {
        return path.join(IMAGES_DIR, file);
      }
    }
  } catch {
    // directory might not exist yet
  }
  return null;
}

/**
 * Extract file extension from a URL, defaulting to ".jpg".
 */
function extensionFromUrl(imageUrl) {
  try {
    const pathname = new URL(imageUrl).pathname;
    const ext = path.extname(pathname).toLowerCase();
    // Keep common image extensions; fall back to .jpg
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"].includes(ext)) {
      return ext;
    }
  } catch {
    // ignore parse errors
  }
  return ".jpg";
}

/**
 * Make an HTTPS GET request and return the full response body as a string.
 * Follows up to `maxRedirects` redirects.
 */
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
          "User-Agent": "DangerousAnimalsCardGame/1.0 (educational project; contact: none)",
        },
      },
      (res) => {
        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, requestUrl).href;
          res.resume(); // drain the response
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

/**
 * Query the Wikipedia API for the thumbnail URL of a given article title.
 * Returns the image source URL or null if not found.
 */
async function fetchWikipediaImageUrl(title) {
  const apiUrl =
    `https://en.wikipedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent(title)}` +
    `&prop=pageimages&pithumbsize=800&format=json`;

  const body = await httpsGet(apiUrl);
  const json = JSON.parse(body.toString("utf-8"));

  const pages = json.query && json.query.pages;
  if (!pages) return null;

  // The pages object is keyed by page ID; grab the first one.
  const pageId = Object.keys(pages)[0];
  if (!pageId || pageId === "-1") return null;

  const page = pages[pageId];
  return (page.thumbnail && page.thumbnail.source) || null;
}

/**
 * Download a binary file from `imageUrl` and save it to `destPath`.
 */
async function downloadFile(imageUrl, destPath) {
  const data = await httpsGet(imageUrl);
  fs.writeFileSync(destPath, data);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Dangerous Animals Image Downloader ===\n");
  console.log(`Images directory : ${IMAGES_DIR}`);
  console.log(`Force re-download: ${forceFlag ? "YES" : "NO"}`);
  console.log(`Total animals    : ${Object.keys(ALL_ANIMALS).length}\n`);

  // Ensure the target directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log(`Created directory: ${IMAGES_DIR}\n`);
  }

  const results = { downloaded: [], skipped: [], failed: [] };
  const animalIds = Object.keys(ALL_ANIMALS);

  for (let i = 0; i < animalIds.length; i++) {
    const animalId = animalIds[i];
    const wikiTitle = ALL_ANIMALS[animalId];
    const progress = `[${i + 1}/${animalIds.length}]`;

    const isWrongImage = animalId in WRONG_IMAGES;
    const existingFile = findExistingFile(animalId);

    // Decide whether to skip
    if (existingFile && !forceFlag && !isWrongImage) {
      console.log(`${progress} SKIP   ${animalId} (already exists: ${path.basename(existingFile)})`);
      results.skipped.push(animalId);
      continue;
    }

    if (existingFile && isWrongImage) {
      console.log(`${progress} REPLACE ${animalId} (wrong image, re-downloading)`);
    }

    try {
      // Step 1: Get the thumbnail URL from Wikipedia
      process.stdout.write(`${progress} FETCH  ${animalId} (${wikiTitle})...`);
      const imageUrl = await fetchWikipediaImageUrl(wikiTitle);

      if (!imageUrl) {
        console.log(" NO IMAGE FOUND on Wikipedia");
        results.failed.push({ animalId, reason: "No thumbnail on Wikipedia page" });
        continue;
      }

      // Step 2: Determine file extension and destination path
      const ext = extensionFromUrl(imageUrl);
      const destPath = path.join(IMAGES_DIR, `${animalId}${ext}`);

      // If replacing and old file has a different extension, remove the old one
      if (existingFile && existingFile !== destPath) {
        fs.unlinkSync(existingFile);
      }

      // Step 3: Download the image
      process.stdout.write(` downloading...`);
      await downloadFile(imageUrl, destPath);

      const stats = fs.statSync(destPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(` OK (${sizeKB} KB) -> ${path.basename(destPath)}`);
      results.downloaded.push(animalId);
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
      results.failed.push({ animalId, reason: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
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
    results.failed.forEach(({ animalId, reason }) =>
      console.log(`  ! ${animalId}: ${reason}`)
    );
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
