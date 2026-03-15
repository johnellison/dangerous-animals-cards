#!/usr/bin/env node

/**
 * Download dinosaur LIFE RESTORATION images from Wikimedia Commons
 * Uses category listings to find the best colorful paleoart for each dinosaur.
 * Avoids skeletons, fossils, museum photos, and B&W drawings.
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(PROJECT_ROOT, "images", "dinosaurs");

// CURATED: exact Wikimedia Commons filenames for colorful life restorations
// Each has been verified as an artistic reconstruction (not skeleton/fossil)
const DINO_RESTORATIONS = {
  "tyrannosaurus-rex": "File:Tyrannosaurus rex mmartyniuk.png",
  "triceratops": "File:Triceratops liveDB.jpg",
  "velociraptor": "File:Velociraptor restraining an oviraptorosaur by durbed.jpg",
  "stegosaurus": "File:Stegosaurus stenops Life Restoration.png",
  "brachiosaurus": "File:Brachiosaurus DB.jpg",
  "spinosaurus": "File:Spinosaurus swimming.jpg",
  "ankylosaurus": "File:Ankylosaurus magniventris reconstruction.png",
  "allosaurus": "File:Allosaurus Revised.jpg",
  "diplodocus": "File:Diplodocus carnegii.jpg",
  "apatosaurus": "File:Apatosaurus louisae by durbed.jpg",
  "dilophosaurus": "File:Dilophosaurus wetherilli.PNG",
  "pachycephalosaurus": "File:Pachycephalosaurus reconstruction.jpg",
  "parasaurolophus": "File:Parasaurolophus cyrtocristatus.jpg",
  "carnotaurus": "File:Carnotaurus DB 2.jpg",
  "giganotosaurus": "File:Giganotosaurus carolinii by durbed.jpg",
  "therizinosaurus": "File:Therizinosaurus Restoration.png",
  "deinonychus": "File:Deinonychus ewilloughby.png",
  "iguanodon": "File:Iguanodon bernissartensis restoration.jpg",
  "baryonyx": "File:Baryonyx walkeri restoration.jpg",
  "ceratosaurus": "File:Ceratosaurus nasicornis DB.jpg",
  "albertosaurus": "File:Albertosaurus sarcophagus copia.jpg",
};

// Fallback: search these Wikimedia categories for life restorations if primary fails
const CATEGORY_FALLBACKS = {
  "tyrannosaurus-rex": "Category:Tyrannosaurus life restorations",
  "triceratops": "Category:Triceratops life restorations",
  "velociraptor": "Category:Velociraptor life restorations",
  "stegosaurus": "Category:Stegosaurus life restorations",
  "brachiosaurus": "Category:Brachiosaurus life restorations",
  "spinosaurus": "Category:Spinosaurus life restorations",
  "ankylosaurus": "Category:Ankylosaurus life restorations",
  "allosaurus": "Category:Allosaurus life restorations",
  "diplodocus": "Category:Diplodocus life restorations",
  "apatosaurus": "Category:Apatosaurus life restorations",
  "dilophosaurus": "Category:Dilophosaurus life restorations",
  "pachycephalosaurus": "Category:Pachycephalosaurus life restorations",
  "parasaurolophus": "Category:Parasaurolophus life restorations",
  "carnotaurus": "Category:Carnotaurus life restorations",
  "giganotosaurus": "Category:Giganotosaurus life restorations",
  "therizinosaurus": "Category:Therizinosaurus life restorations",
  "deinonychus": "Category:Deinonychus life restorations",
  "iguanodon": "Category:Iguanodon life restorations",
  "baryonyx": "Category:Baryonyx life restorations",
  "ceratosaurus": "Category:Ceratosaurus life restorations",
  "albertosaurus": "Category:Albertosaurus",
};

function extensionFromUrl(imageUrl) {
  try {
    const pathname = new URL(imageUrl).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
      return ext;
    }
  } catch {}
  return ".jpg";
}

function httpsGet(requestUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
    const parsed = new URL(requestUrl);
    const transport = parsed.protocol === "https:" ? https : http;
    const req = transport.get(
      requestUrl,
      { headers: { "User-Agent": "DinosaurCardGame/1.0 (educational project)" } },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, requestUrl).href;
          res.resume();
          return resolve(httpsGet(redirectUrl, maxRedirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

/**
 * Get the actual image URL from Wikimedia Commons using the imageinfo API
 */
async function fetchCommonsImageUrl(fileTitle, width = 960) {
  const apiUrl =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent(fileTitle)}` +
    `&prop=imageinfo&iiprop=url|mime&iiurlwidth=${width}&format=json`;

  const body = await httpsGet(apiUrl);
  const json = JSON.parse(body.toString("utf-8"));
  const pages = json.query && json.query.pages;
  if (!pages) return null;

  const pageId = Object.keys(pages)[0];
  if (!pageId || pageId === "-1") return null;

  const page = pages[pageId];
  if (page.imageinfo && page.imageinfo[0]) {
    const info = page.imageinfo[0];
    // Skip SVG files (they render poorly as raster at small sizes)
    if (info.mime === "image/svg+xml") return null;
    return info.thumburl || info.url;
  }
  return null;
}

/**
 * Search a Wikimedia category for image files (life restorations)
 */
async function searchCategory(categoryTitle) {
  const apiUrl =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&list=categorymembers&cmtitle=${encodeURIComponent(categoryTitle)}` +
    `&cmtype=file&cmlimit=50&format=json`;

  const body = await httpsGet(apiUrl);
  const json = JSON.parse(body.toString("utf-8"));
  const members = json.query && json.query.categorymembers;
  if (!members || members.length === 0) return [];

  // Filter to image files, prefer known artists and avoid skeletons
  const skipWords = ["skeleton", "fossil", "mount", "skull", "bone", "museum", "diagram", "scale", "size", "silhouette", "BW", "range"];
  const preferWords = ["restoration", "reconstruction", "life", "paleoart", "durbed", "DB", "Wierum", "willoughby", "Tamura", "Bogdanov"];

  return members
    .map(m => m.title)
    .filter(title => {
      const lower = title.toLowerCase();
      // Must be an image file
      if (!/\.(jpg|jpeg|png|gif)$/i.test(lower)) return false;
      // Skip skeleton/fossil images
      if (skipWords.some(w => lower.includes(w.toLowerCase()))) return false;
      return true;
    })
    .sort((a, b) => {
      // Score by preferred keywords
      const scoreA = preferWords.filter(w => a.toLowerCase().includes(w.toLowerCase())).length;
      const scoreB = preferWords.filter(w => b.toLowerCase().includes(w.toLowerCase())).length;
      return scoreB - scoreA;
    });
}

async function downloadFile(imageUrl, destPath) {
  const data = await httpsGet(imageUrl);
  fs.writeFileSync(destPath, data);
}

async function main() {
  const forceDownload = process.argv.includes("--force");
  console.log("=== Dinosaur Life Restoration Image Downloader ===\n");

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  const results = { downloaded: [], skipped: [], failed: [] };
  const dinoIds = Object.keys(DINO_RESTORATIONS);

  for (let i = 0; i < dinoIds.length; i++) {
    const dinoId = dinoIds[i];
    const progress = `[${i + 1}/${dinoIds.length}]`;

    // Check if file already exists (unless --force)
    if (!forceDownload) {
      const existing = [".jpg", ".jpeg", ".png", ".webp"].find(ext =>
        fs.existsSync(path.join(IMAGES_DIR, `${dinoId}${ext}`))
      );
      if (existing) {
        const existingPath = path.join(IMAGES_DIR, `${dinoId}${existing}`);
        const stats = fs.statSync(existingPath);
        // Skip if file is reasonably sized (> 20KB)
        if (stats.size > 20000) {
          console.log(`${progress} SKIP   ${dinoId} (already exists, ${(stats.size / 1024).toFixed(1)} KB)`);
          results.skipped.push(dinoId);
          continue;
        }
      }
    }

    let imageUrl = null;
    let source = "";

    // Try primary file title first
    try {
      process.stdout.write(`${progress} FETCH  ${dinoId}...`);
      const primaryTitle = DINO_RESTORATIONS[dinoId];
      imageUrl = await fetchCommonsImageUrl(primaryTitle);
      if (imageUrl) source = "primary";
    } catch (err) {
      // Will try fallback
    }

    // If primary failed, try category search
    if (!imageUrl && CATEGORY_FALLBACKS[dinoId]) {
      try {
        process.stdout.write(` searching category...`);
        const categoryFiles = await searchCategory(CATEGORY_FALLBACKS[dinoId]);
        for (const fileTitle of categoryFiles.slice(0, 5)) {
          imageUrl = await fetchCommonsImageUrl(fileTitle);
          if (imageUrl) {
            source = `category (${fileTitle})`;
            break;
          }
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        // Will report as failed
      }
    }

    if (!imageUrl) {
      console.log(` NO IMAGE FOUND`);
      results.failed.push({ dinoId, reason: "No suitable image found" });
      continue;
    }

    try {
      const ext = extensionFromUrl(imageUrl);
      const destPath = path.join(IMAGES_DIR, `${dinoId}${ext}`);

      // Remove old files with different extensions
      for (const oldExt of [".jpg", ".jpeg", ".png", ".webp"]) {
        const oldPath = path.join(IMAGES_DIR, `${dinoId}${oldExt}`);
        if (oldPath !== destPath && fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      process.stdout.write(` downloading...`);
      await downloadFile(imageUrl, destPath);

      const stats = fs.statSync(destPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(` OK (${sizeKB} KB) [${source}] -> ${path.basename(destPath)}`);
      results.downloaded.push(dinoId);
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
      results.failed.push({ dinoId, reason: err.message });
    }

    // Delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 600));
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Downloaded : ${results.downloaded.length}`);
  console.log(`Skipped    : ${results.skipped.length}`);
  console.log(`Failed     : ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log(`\nFailed:`);
    results.failed.forEach(({ dinoId, reason }) => console.log(`  ! ${dinoId}: ${reason}`));
  }

  // Update dinosaurs.json with correct extensions
  const dinoJsonPath = path.join(PROJECT_ROOT, "data", "dinosaurs.json");
  if (fs.existsSync(dinoJsonPath)) {
    const dinos = JSON.parse(fs.readFileSync(dinoJsonPath, "utf-8"));
    let changed = false;
    for (const dino of dinos) {
      const actualFile = [".jpg", ".jpeg", ".png", ".webp"]
        .map(ext => ({ ext, exists: fs.existsSync(path.join(IMAGES_DIR, `${dino.id}${ext}`)) }))
        .find(f => f.exists);
      if (actualFile) {
        const correctPath = `images/dinosaurs/${dino.id}${actualFile.ext}`;
        if (dino.image !== correctPath) {
          console.log(`  Updated ${dino.id}: ${dino.image} -> ${correctPath}`);
          dino.image = correctPath;
          changed = true;
        }
      }
    }
    if (changed) {
      fs.writeFileSync(dinoJsonPath, JSON.stringify(dinos, null, 2) + "\n");
      console.log("\nUpdated dinosaurs.json with correct image paths.");
    }
  }

  console.log("\nDone.");
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
