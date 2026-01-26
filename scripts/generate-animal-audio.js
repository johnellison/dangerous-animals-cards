/**
 * Generate Animal Audio Script
 * Generates audio clips for all animals using Eleven Labs API
 *
 * For each animal, generates 4 clips:
 * - {id}-name.mp3 - Animal name
 * - {id}-epithet.mp3 - Epithet/nickname
 * - {id}-fact.mp3 - Fun fact with intro
 * - {id}-intro.mp3 - Combined name + epithet + fact
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

const API_KEY = process.env.ELEVEN_LABS_API_KEY;
const VOICE_ID_FILE = path.join(ROOT_DIR, '.voice-id');
const ANIMALS_JSON = path.join(ROOT_DIR, 'data', 'animals.json');
const OUTPUT_DIR = path.join(ROOT_DIR, 'audio', 'animals');

// API Settings
const MODEL_ID = 'eleven_flash_v2_5'; // Fast, 50% cheaper
const OUTPUT_FORMAT = 'mp3_44100_128';
const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true
};

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 500; // ms

if (!API_KEY) {
  console.error('Error: ELEVEN_LABS_API_KEY not found in .env file');
  process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateSpeech(text, voiceId, outputPath) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: VOICE_SETTINGS
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

async function generateAnimalAudio(animal, voiceId, stats) {
  const animalId = animal.id;
  const clips = [
    {
      type: 'name',
      text: animal.name
    },
    {
      type: 'epithet',
      text: animal.epithet
    },
    {
      type: 'fact',
      text: `Did you know? ${animal.facts[0]}`
    },
    {
      type: 'intro',
      text: `${animal.name}. ${animal.epithet}. Did you know? ${animal.facts[0]}`
    }
  ];

  for (const clip of clips) {
    const outputPath = path.join(OUTPUT_DIR, `${animalId}-${clip.type}.mp3`);

    // Skip if file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`  Skipping ${clip.type} (already exists)`);
      stats.skipped++;
      continue;
    }

    try {
      await generateSpeech(clip.text, voiceId, outputPath);
      console.log(`  Generated: ${animalId}-${clip.type}.mp3`);
      stats.generated++;
      await sleep(DELAY_BETWEEN_REQUESTS);
    } catch (error) {
      console.error(`  Failed ${clip.type}: ${error.message}`);
      stats.failed++;
    }
  }
}

async function main() {
  console.log('Generating animal audio clips...\n');

  // Check for voice ID
  if (!fs.existsSync(VOICE_ID_FILE)) {
    console.error('Error: Voice ID not found. Run create-voice-clone.js first.');
    process.exit(1);
  }

  const voiceId = fs.readFileSync(VOICE_ID_FILE, 'utf-8').trim();
  console.log(`Using voice ID: ${voiceId}\n`);

  // Load animals
  const animals = JSON.parse(fs.readFileSync(ANIMALS_JSON, 'utf-8'));
  console.log(`Found ${animals.length} animals\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const stats = { generated: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < animals.length; i++) {
    const animal = animals[i];
    console.log(`[${i + 1}/${animals.length}] ${animal.name}`);
    await generateAnimalAudio(animal, voiceId, stats);
  }

  console.log('\n--- Summary ---');
  console.log(`Generated: ${stats.generated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Total files expected: ${animals.length * 4}`);

  // List output directory
  const files = fs.readdirSync(OUTPUT_DIR);
  console.log(`\nFiles in output directory: ${files.length}`);
}

main().catch(console.error);
