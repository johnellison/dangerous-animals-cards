#!/usr/bin/env node

/**
 * Add a new animal to the Dangerous Animals card game.
 *
 * Usage:
 *   node scripts/add-animal.cjs "Tuna"
 *   node scripts/add-animal.cjs "Blue-Ringed Octopus" --wiki "Blue-ringed_octopus"
 *   node scripts/add-animal.cjs "Tuna" --dry-run
 *
 * What it does:
 *   1. Looks up the animal on Wikipedia
 *   2. Downloads the thumbnail image from Wikimedia Commons
 *   3. Extracts facts from the Wikipedia summary
 *   4. Auto-categorises (type, habitat, category, rarity, stats)
 *   5. Adds the entry to data/animals.json
 *
 * Options:
 *   --wiki <title>   Override the Wikipedia article title
 *   --dry-run        Print the JSON entry without saving anything
 *   --force          Overwrite if animal already exists
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(PROJECT_ROOT, "images", "animals");
const DATA_FILE = path.join(PROJECT_ROOT, "data", "animals.json");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes("--dry-run"),
  force: args.includes("--force"),
};

let animalName = null;
let wikiOverride = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--wiki" && args[i + 1]) {
    wikiOverride = args[i + 1];
    i++;
  } else if (!args[i].startsWith("--")) {
    animalName = args[i];
  }
}

if (!animalName) {
  console.error("Usage: node scripts/add-animal.cjs \"Animal Name\" [--wiki Title] [--dry-run] [--force]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toId(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toWikiTitle(name) {
  return name.replace(/\s+/g, "_");
}

function httpsGet(requestUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
    const parsed = new URL(requestUrl);
    const transport = parsed.protocol === "https:" ? https : http;
    const req = transport.get(
      requestUrl,
      {
        headers: {
          "User-Agent":
            "DangerousAnimalsCardGame/1.0 (educational project; contact: none)",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return resolve(httpsGet(new URL(res.headers.location, requestUrl).href, maxRedirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${requestUrl}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function extensionFromUrl(imageUrl) {
  try {
    const ext = path.extname(new URL(imageUrl).pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)) return ext;
  } catch {}
  return ".jpg";
}

// ---------------------------------------------------------------------------
// Wikipedia API calls
// ---------------------------------------------------------------------------

async function fetchWikiData(title) {
  // Fetch extract (plain text summary) + page image + categories
  const apiUrl =
    `https://en.wikipedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent(title)}` +
    `&prop=extracts|pageimages|categories` +
    `&exintro=1&explaintext=1&exsectionformat=plain` +
    `&pithumbsize=800` +
    `&cllimit=50` +
    `&format=json&redirects=1`;

  const body = await httpsGet(apiUrl);
  const json = JSON.parse(body.toString("utf-8"));
  const pages = json.query && json.query.pages;
  if (!pages) return null;

  const pageId = Object.keys(pages)[0];
  if (!pageId || pageId === "-1") return null;

  return pages[pageId];
}

async function fetchWikiSections(title) {
  // Fetch full article text to mine for facts, habitat, distribution, etc.
  const apiUrl =
    `https://en.wikipedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent(title)}` +
    `&prop=extracts` +
    `&explaintext=1&exsectionformat=plain` +
    `&format=json&redirects=1`;

  const body = await httpsGet(apiUrl);
  const json = JSON.parse(body.toString("utf-8"));
  const pages = json.query && json.query.pages;
  if (!pages) return "";

  const pageId = Object.keys(pages)[0];
  if (!pageId || pageId === "-1") return "";

  return pages[pageId].extract || "";
}

// ---------------------------------------------------------------------------
// Auto-classification from Wikipedia text & categories
// ---------------------------------------------------------------------------

function classify(text, categories, name) {
  const lowerText = text.toLowerCase();
  const lowerName = name.toLowerCase();
  const catNames = (categories || []).map((c) => (c.title || "").toLowerCase());

  // --- Type ---
  const typeMap = [
    { keywords: ["snake", "viper", "cobra", "python", "boa", "mamba", "adder", "rattlesnake", "taipan", "krait", "lizard", "gecko", "iguana", "monitor", "crocodil", "alligator", "turtle", "tortoise", "chameleon", "skink"], type: "reptile" },
    { keywords: ["spider", "scorpion", "tick", "mite", "solifugae", "camel spider", "tarantula", "arachnid"], type: "arachnid" },
    { keywords: ["frog", "toad", "salamander", "newt", "caecilian", "amphibian"], type: "amphibian" },
    { keywords: ["shark", "ray", "fish", "eel", "piranha", "barracuda", "stingray", "catfish", "tuna", "marlin", "swordfish", "perch", "bass", "cod", "grouper", "pufferfish", "lionfish", "stonefish", "moray"], type: "fish" },
    { keywords: ["jellyfish", "anemone", "coral", "man o' war", "man-of-war", "box jelly", "cnidarian"], type: "cnidarian" },
    { keywords: ["octopus", "squid", "cone snail", "slug", "snail", "mollus"], type: "mollusk" },
    { keywords: ["centipede", "scolopendra"], type: "centipede" },
    { keywords: ["ant ", "ants ", "wasp", "hornet", "bee ", "bees ", "beetle", "mosquito", "fly ", "flies ", "moth", "butterfly", "mantis", "locust", "cricket", "cockroach", "insect", "dragonfly"], type: "insect" },
    { keywords: ["crab", "lobster", "shrimp", "crustacean", "barnacle"], type: "crustacean" },
    { keywords: ["eagle", "hawk", "falcon", "owl", "vulture", "condor", "swan", "goose", "cassowary", "ostrich", "emu", "pelican", "heron", "stork", "kite ", "bird"], type: "bird" },
  ];

  let type = "mammal"; // default
  for (const { keywords, type: t } of typeMap) {
    for (const kw of keywords) {
      if (lowerName.includes(kw.trim()) || lowerText.slice(0, 500).includes(kw.trim())) {
        type = t;
        break;
      }
    }
    if (type !== "mammal") break;
  }

  // Also check Wikipedia categories for confirmation
  for (const cat of catNames) {
    if (cat.includes("fish") && type === "mammal") type = "fish";
    if (cat.includes("reptile") && type === "mammal") type = "reptile";
    if (cat.includes("bird") && type === "mammal") type = "bird";
    if (cat.includes("amphibian") && type === "mammal") type = "amphibian";
    if (cat.includes("arachnid") && type === "mammal") type = "arachnid";
    if (cat.includes("insect") && type === "mammal") type = "insect";
  }

  // --- Category (danger type) ---
  let category = "predator"; // default
  if (/venom|venomous|toxic|poison|sting|envenomation|neurotoxin/.test(lowerText.slice(0, 2000))) {
    category = "venomous";
  } else if (/electric|electroc|shock|voltage/.test(lowerText)) {
    category = "electric";
  } else if (/parasit/.test(lowerText.slice(0, 1000))) {
    category = "parasite";
  } else if (/filter.?feed/.test(lowerText)) {
    category = "filter feeder";
  } else if (/camouflage|mimic|crypsis|cryptic/.test(lowerText.slice(0, 1500))) {
    category = "camouflage";
  } else if (/herbivor|plant.?eat|vegetation|grazer/.test(lowerText.slice(0, 1500))) {
    category = "herbivore";
  } else if (/defensive|defense|defence|shell|armor|armour|quill|spike/.test(lowerText.slice(0, 1500))) {
    category = "defensive";
  }

  // --- Habitat ---
  let habitat = "land"; // default
  if (/ocean|marine|pelagic|deep.?sea|saltwater|sea floor|coral reef|open water/.test(lowerText)) {
    habitat = "sea";
  } else if (/freshwater|river|lake|stream|pond|swamp|marsh|wetland|estuar/.test(lowerText)) {
    if (/swamp|marsh|wetland|mangrove/.test(lowerText)) {
      habitat = "swamp";
    } else {
      habitat = "freshwater";
    }
  } else if (/desert|arid|dry|sand dune/.test(lowerText.slice(0, 2000))) {
    habitat = "desert";
  } else if (/forest|jungle|rainfo|woodland|canopy|tropical/.test(lowerText.slice(0, 2000))) {
    habitat = "forest";
  } else if (/coast|shore|beach|tidal|intertidal/.test(lowerText)) {
    habitat = "coastal";
  }

  // --- Region ---
  let region = "Worldwide";
  const regionPatterns = [
    { pattern: /australia/i, region: "Australia" },
    { pattern: /brazil/i, region: "South America" },
    { pattern: /amazon/i, region: "Amazon Basin" },
    { pattern: /africa/i, region: "Africa" },
    { pattern: /india/i, region: "South Asia" },
    { pattern: /southeast asia/i, region: "Southeast Asia" },
    { pattern: /asia/i, region: "Asia" },
    { pattern: /north america/i, region: "North America" },
    { pattern: /south america/i, region: "South America" },
    { pattern: /europe/i, region: "Europe" },
    { pattern: /pacific/i, region: "Pacific Ocean" },
    { pattern: /atlantic/i, region: "Atlantic Ocean" },
    { pattern: /indian ocean/i, region: "Indian Ocean" },
    { pattern: /mediterranean/i, region: "Mediterranean" },
    { pattern: /arctic/i, region: "Arctic" },
    { pattern: /antarctic/i, region: "Antarctica" },
    { pattern: /japan/i, region: "Japan" },
    { pattern: /china/i, region: "China" },
    { pattern: /indonesia/i, region: "Indonesia" },
    { pattern: /madagascar/i, region: "Madagascar" },
    { pattern: /caribbean/i, region: "Caribbean" },
    { pattern: /central america/i, region: "Central America" },
    { pattern: /middle east/i, region: "Middle East" },
  ];
  // Search distribution/range sections first, then full text
  const distSection = lowerText.match(/(?:distribution|range|habitat|geography)[^\n]*\n([\s\S]{0,2000})/i);
  const searchText = distSection ? distSection[1] : lowerText;
  for (const { pattern, region: r } of regionPatterns) {
    if (pattern.test(searchText)) {
      region = r;
      break;
    }
  }

  // --- Stats ---
  // Danger level: based on keywords
  let dangerLevel = 5;
  if (/fatal|deadly|lethal|kill.*human|death|died/.test(lowerText.slice(0, 3000))) dangerLevel = 8;
  if (/most deadly|most dangerous|most venomous|most lethal|extremely dangerous/.test(lowerText)) dangerLevel = 9;
  if (category === "venomous" && dangerLevel < 6) dangerLevel = 6;
  if (/rarely dangerous|not.{0,20}dangerous|harmless|docile|not.{0,20}fatal/.test(lowerText.slice(0, 2000))) dangerLevel = Math.max(2, dangerLevel - 3);
  // Large predators get a boost
  if (category === "predator" && /apex|top predator|large predator|powerful/.test(lowerText)) dangerLevel = Math.min(10, dangerLevel + 1);

  // Speed: based on keywords
  let speed = 5;
  const speedMatch = lowerText.match(/(\d+)\s*(?:km\/h|mph|kilometers? per hour|miles? per hour)/);
  if (speedMatch) {
    const kmh = lowerText.includes("mph") ? parseInt(speedMatch[1]) * 1.6 : parseInt(speedMatch[1]);
    if (kmh > 100) speed = 10;
    else if (kmh > 70) speed = 9;
    else if (kmh > 50) speed = 8;
    else if (kmh > 35) speed = 7;
    else if (kmh > 20) speed = 6;
    else if (kmh > 10) speed = 5;
    else speed = 4;
  }
  if (/slow|sluggish|sedentary|ambush/.test(lowerText.slice(0, 2000))) speed = Math.max(2, speed - 2);
  if (/fast|rapid|swift|agile|burst/.test(lowerText.slice(0, 2000))) speed = Math.min(9, speed + 1);

  // Size: based on length/weight mentions
  let size = 5;
  const lengthMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*(?:m |m\b|metres?|meters?)\s*(?:long|in length|total length)?/);
  const weightMatch = lowerText.match(/(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:kg|kilograms?)\b/);
  if (lengthMatch) {
    const meters = parseFloat(lengthMatch[1]);
    if (meters > 6) size = 10;
    else if (meters > 4) size = 9;
    else if (meters > 2) size = 8;
    else if (meters > 1) size = 6;
    else if (meters > 0.5) size = 4;
    else if (meters > 0.1) size = 3;
    else size = 2;
  }
  if (weightMatch) {
    const kg = parseFloat(weightMatch[1].replace(/,/g, ""));
    if (kg > 1000) size = 10;
    else if (kg > 500) size = 9;
    else if (kg > 100) size = 8;
    else if (kg > 30) size = 7;
    else if (kg > 5) size = 5;
    else if (kg > 1) size = 4;
    else size = 3;
  }
  if (/tiny|small|miniature|little/.test(lowerText.slice(0, 1000))) size = Math.max(1, size - 2);
  if (/massive|enormous|huge|giant|largest/.test(lowerText.slice(0, 1000))) size = Math.min(10, size + 2);

  // Clamp all stats to 1-10
  dangerLevel = Math.max(1, Math.min(10, dangerLevel));
  speed = Math.max(1, Math.min(10, speed));
  size = Math.max(1, Math.min(10, size));

  // --- Rarity ---
  let rarity = "common";
  if (/critically endangered|extremely rare/i.test(lowerText)) rarity = "legendary";
  else if (/endangered|rare species/i.test(lowerText)) rarity = "rare";
  else if (/vulnerable|near.?threatened|threatened/i.test(lowerText)) rarity = "uncommon";
  // Also boost rarity for particularly famous/dangerous animals
  if (dangerLevel >= 9 && rarity === "common") rarity = "uncommon";
  if (dangerLevel >= 10) rarity = "rare";

  return { type, category, habitat, region, rarity, dangerLevel, speed, size };
}

// ---------------------------------------------------------------------------
// Fact extraction
// ---------------------------------------------------------------------------

function extractFacts(extract, fullText, name) {
  // Split into sentences
  const allText = fullText || extract;
  const sentences = allText
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 30 && s.length < 200)
    .filter((s) => !/\brefer|see also|citation|isbn|doi\b/i.test(s))
    .filter((s) => !/^\d+\s/.test(s));

  // Score sentences by interestingness
  const interestingWords = /record|largest|smallest|fastest|deadl|fatal|venom|unique|only|first|ancient|million|can grow|can reach|known to|capable|attack|kill|prey|hunt|teeth|jaw|bite|sting|speed|weigh|length|deep|survive|adapt|evolv|special|remarkable|unusual|surprising|interesting|rare|endangered|threaten/i;

  const scored = sentences.map((s) => {
    let score = 0;
    if (interestingWords.test(s)) score += 3;
    if (/\d/.test(s)) score += 2; // sentences with numbers are often factual
    if (s.length > 50 && s.length < 150) score += 1; // good length
    // Penalise generic/boring sentences
    if (/is a (species|genus|family|type)/i.test(s)) score -= 2;
    if (/was (first |originally )?described/i.test(s)) score -= 3;
    if (/taxonom|classif|nomenclat|synonym/i.test(s)) score -= 3;
    return { sentence: s, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick top 3 unique, non-overlapping facts
  const facts = [];
  for (const { sentence } of scored) {
    if (facts.length >= 3) break;
    // Skip if too similar to an already-picked fact
    const isDuplicate = facts.some((f) => {
      const words1 = new Set(f.toLowerCase().split(/\s+/));
      const words2 = new Set(sentence.toLowerCase().split(/\s+/));
      let overlap = 0;
      for (const w of words2) if (words1.has(w)) overlap++;
      return overlap / Math.max(words1.size, words2.size) > 0.5;
    });
    if (!isDuplicate) {
      // Clean up the sentence
      let clean = sentence.trim();
      // Remove trailing period for card style
      if (clean.endsWith(".")) clean = clean.slice(0, -1);
      // Capitalise first letter
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
      facts.push(clean);
    }
  }

  // Pad with generic facts if we couldn't find 3
  while (facts.length < 3) {
    const fallbacks = [
      `The ${name} is one of nature's most fascinating creatures`,
      `Found in various habitats around the world`,
      `Has evolved unique adaptations for survival`,
    ];
    facts.push(fallbacks[facts.length] || `A remarkable animal worth learning about`);
  }

  return facts;
}

// ---------------------------------------------------------------------------
// Epithet generation
// ---------------------------------------------------------------------------

function generateEpithet(classification, name) {
  const epithets = {
    venomous: ["The Toxic Terror", "The Venomous Villain", "The Poison Master", "The Silent Stinger", "The Deadly Dose"],
    predator: ["The Apex Hunter", "The Ruthless Predator", "The Fierce Fighter", "The Silent Stalker", "The Ocean Hunter", "The Swift Striker"],
    defensive: ["The Living Fortress", "The Armored One", "The Spiny Survivor", "The Tough Shield"],
    electric: ["The Living Battery", "The Shocking Swimmer", "The Volt Machine"],
    parasite: ["The Unwanted Guest", "The Silent Invader", "The Tiny Terror"],
    camouflage: ["The Invisible Hunter", "The Master of Disguise", "The Hidden Danger"],
    herbivore: ["The Gentle Giant", "The Peaceful Powerhouse", "The Mighty Grazer"],
    "filter feeder": ["The Gentle Giant", "The Ocean Sieve", "The Peaceful Titan"],
    "fish eater": ["The Fish Hunter", "The River Raider", "The Aquatic Ace"],
  };
  const options = epithets[classification.category] || epithets.predator;
  // Pick one pseudo-randomly based on name hash
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return options[Math.abs(hash) % options.length];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const id = toId(animalName);
  const wikiTitle = wikiOverride || toWikiTitle(animalName);

  console.log(`\n🃏 Adding "${animalName}" (id: ${id})`);
  console.log(`   Wikipedia: ${wikiTitle}\n`);

  // Check if already exists
  const animals = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const existing = animals.find((a) => a.id === id);
  if (existing && !flags.force) {
    console.error(`❌ Animal "${id}" already exists in animals.json. Use --force to overwrite.`);
    process.exit(1);
  }

  // Fetch Wikipedia data
  process.stdout.write("📖 Fetching Wikipedia data...");
  const wikiData = await fetchWikiData(wikiTitle);
  if (!wikiData) {
    console.error(` FAILED\n❌ Could not find "${wikiTitle}" on Wikipedia.`);
    console.error(`   Try: node scripts/add-animal.cjs "${animalName}" --wiki "Exact_Wikipedia_Title"`);
    process.exit(1);
  }
  console.log(" OK");

  // Fetch full article for fact mining
  process.stdout.write("📝 Fetching full article for facts...");
  const fullText = await fetchWikiSections(wikiTitle);
  console.log(" OK");

  const extract = wikiData.extract || "";
  const imageUrl = wikiData.thumbnail && wikiData.thumbnail.source;

  // Classify
  process.stdout.write("🏷️  Auto-classifying...");
  const classification = classify(extract + "\n" + fullText, wikiData.categories, animalName);
  console.log(" OK");

  // Extract facts
  process.stdout.write("💡 Extracting facts...");
  const facts = extractFacts(extract, fullText, animalName);
  console.log(" OK");

  // Generate epithet
  const epithet = generateEpithet(classification, animalName);

  // Download image
  let imagePath = `images/animals/${id}.jpg`;
  if (imageUrl && !flags.dryRun) {
    process.stdout.write("🖼️  Downloading image...");
    const ext = extensionFromUrl(imageUrl);
    const destPath = path.join(IMAGES_DIR, `${id}${ext}`);
    const data = await httpsGet(imageUrl);
    fs.writeFileSync(destPath, data);
    const sizeKB = (data.length / 1024).toFixed(1);
    imagePath = `images/animals/${id}${ext}`;
    console.log(` OK (${sizeKB} KB) -> ${id}${ext}`);
  } else if (!imageUrl) {
    console.log("⚠️  No image found on Wikipedia — using placeholder path");
  }

  // Build the animal entry
  const entry = {
    id,
    name: animalName,
    epithet,
    type: classification.type,
    category: classification.category,
    habitat: classification.habitat,
    region: classification.region,
    rarity: classification.rarity,
    image: imagePath,
    stats: {
      dangerLevel: classification.dangerLevel,
      speed: classification.speed,
      size: classification.size,
    },
    facts,
  };

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Generated card entry:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(JSON.stringify(entry, null, 2));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (flags.dryRun) {
    console.log("🏃 Dry run — nothing saved.");
    return;
  }

  // Add to animals.json
  if (existing && flags.force) {
    const idx = animals.findIndex((a) => a.id === id);
    animals[idx] = entry;
    console.log(`♻️  Replaced existing entry for "${id}"`);
  } else {
    animals.push(entry);
    console.log(`✅ Added "${animalName}" to animals.json (total: ${animals.length})`);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(animals, null, 2) + "\n");

  console.log(`\n🎉 Done! "${animalName}" is ready to play.`);
  console.log(`   Card: ${entry.name} — "${entry.epithet}"`);
  console.log(`   Type: ${entry.type} | Category: ${entry.category} | Rarity: ${entry.rarity}`);
  console.log(`   Stats: ⚠️${entry.stats.dangerLevel} ⚡${entry.stats.speed} 📏${entry.stats.size}`);
  console.log(`   Image: ${entry.image}`);
  console.log(`\n   Review the entry and tweak if needed. You can re-run with --force to update.`);
}

main().catch((err) => {
  console.error(`\n❌ Error: ${err.message}`);
  process.exit(1);
});
