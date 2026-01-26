/**
 * Create Voice Clone Script
 * Creates a voice clone OR selects a pre-made voice from Eleven Labs
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

const API_KEY = process.env.ELEVEN_LABS_API_KEY;
const VOICE_SAMPLE_PATH = path.join(ROOT_DIR, 'audio', 'voice-sample.wav');
const VOICE_ID_FILE = path.join(ROOT_DIR, '.voice-id');

// Recommended pre-made voices for educational narration
const PREMADE_VOICES = {
  'Daniel': 'onwK4e9ZLuTAKqWW03F9',      // British, calm, documentary style
  'Charlie': 'IKne3meq5aSn9XLyUdCD',     // Australian, natural
  'George': 'JBFqnCBsd6RMkjVDRZzb',      // British, warm
  'Callum': 'N2lVS1w4EtoT3dr4eOWO',      // Scottish, distinctive
  'Brian': 'nPczCjzI2devNBz1zQrb',       // American, deep narrator
};

// Default to Daniel (British documentary style - great for educational content)
const DEFAULT_VOICE = 'Daniel';

if (!API_KEY) {
  console.error('Error: ELEVEN_LABS_API_KEY not found in .env file');
  process.exit(1);
}

async function listAvailableVoices() {
  console.log('Fetching available voices...\n');

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': API_KEY }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();

  console.log('Available voices:');
  console.log('─'.repeat(50));

  data.voices.slice(0, 15).forEach(voice => {
    const labels = voice.labels ? Object.values(voice.labels).join(', ') : '';
    console.log(`  ${voice.name.padEnd(20)} ${voice.voice_id}`);
    if (labels) console.log(`    └─ ${labels}`);
  });

  console.log('─'.repeat(50));
  return data.voices;
}

async function tryVoiceCloning() {
  console.log('Attempting voice cloning from audio sample...');

  if (!fs.existsSync(VOICE_SAMPLE_PATH)) {
    console.log('Voice sample not found, skipping clone attempt.');
    return null;
  }

  const form = new FormData();
  form.append('name', 'John Ellison - Dangerous Animals');
  form.append('description', 'Voice clone for Dangerous Animals Card Game narration');
  form.append('files', fs.createReadStream(VOICE_SAMPLE_PATH));

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.detail?.status === 'can_not_use_instant_voice_cloning') {
        console.log('Voice cloning not available on current subscription.');
        return null;
      }
      throw new Error(JSON.stringify(errorData));
    }

    const data = await response.json();
    return data.voice_id;
  } catch (error) {
    console.log('Voice cloning failed:', error.message);
    return null;
  }
}

async function usePremadeVoice(voiceName = DEFAULT_VOICE) {
  const voiceId = PREMADE_VOICES[voiceName];

  if (!voiceId) {
    console.error(`Unknown voice: ${voiceName}`);
    console.log('Available options:', Object.keys(PREMADE_VOICES).join(', '));
    process.exit(1);
  }

  console.log(`\nUsing pre-made voice: ${voiceName}`);
  console.log(`Voice ID: ${voiceId}`);

  return voiceId;
}

async function main() {
  console.log('Voice Setup for Dangerous Animals Card Game\n');
  console.log('═'.repeat(50));

  // Check if voice ID already exists
  if (fs.existsSync(VOICE_ID_FILE)) {
    const existingId = fs.readFileSync(VOICE_ID_FILE, 'utf-8').trim();
    console.log(`Voice already configured: ${existingId}`);
    console.log('Delete .voice-id file to reconfigure.');
    return existingId;
  }

  // Try voice cloning first
  let voiceId = await tryVoiceCloning();

  // Fall back to pre-made voice
  if (!voiceId) {
    console.log('\nFalling back to pre-made voice library...');

    // Show available voices
    await listAvailableVoices();

    // Use command line arg or default
    const selectedVoice = process.argv[2] || DEFAULT_VOICE;
    voiceId = await usePremadeVoice(selectedVoice);
  }

  // Save voice ID
  fs.writeFileSync(VOICE_ID_FILE, voiceId);

  console.log('\n═'.repeat(50));
  console.log('Voice configured successfully!');
  console.log(`Saved to: ${VOICE_ID_FILE}`);
  console.log('\nNext step: npm run generate-audio');

  return voiceId;
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
