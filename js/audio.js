/**
 * Audio Manager Module
 * Handles audio playback for animal narration and celebrations
 */
const AudioManager = (function() {
  // Audio element pool for performance
  const audioPool = [];
  const POOL_SIZE = 3;

  // Preloaded audio cache
  const preloadedAudio = new Map();

  // Audio types for animals
  const ANIMAL_AUDIO_TYPES = ['name', 'epithet', 'fact', 'intro'];

  // Celebration types
  const CELEBRATION_TYPES = ['confetti', 'laser', 'fireworks', 'whipped-cream'];

  // Track if audio has been unlocked (requires user interaction on mobile)
  let audioUnlocked = false;

  // Global mute state (persisted in localStorage)
  let muted = localStorage.getItem('audioMuted') === 'true';

  // Web Audio context for synthesized sounds
  let audioContext = null;

  function getAudioContext() {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not available');
        return null;
      }
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  }

  /**
   * Initialize audio pool
   */
  function init() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const audio = new Audio();
      audio.preload = 'auto';
      audioPool.push(audio);
    }

    // Unlock audio on first user interaction (for mobile Safari)
    const unlockAudio = () => {
      if (!audioUnlocked) {
        audioPool.forEach(audio => {
          audio.play().catch(() => {});
          audio.pause();
          audio.currentTime = 0;
        });
        audioUnlocked = true;
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('click', unlockAudio);
      }
    };

    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });
  }

  /**
   * Get an available audio element from the pool
   */
  function getAudioElement() {
    // Find an audio element that's not playing
    for (const audio of audioPool) {
      if (audio.paused || audio.ended) {
        return audio;
      }
    }
    // All busy, create a new temporary one
    return new Audio();
  }

  /**
   * Get audio path for an animal
   */
  function getAnimalAudioPath(animalId, type) {
    return `audio/animals/${animalId}-${type}.mp3`;
  }

  /**
   * Get audio path for celebration
   */
  function getCelebrationAudioPath(type) {
    return `audio/celebrations/${type}.mp3`;
  }

  /**
   * Preload audio file
   */
  function preload(path) {
    if (preloadedAudio.has(path)) return;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = path;
    preloadedAudio.set(path, audio);
  }

  /**
   * Preload all audio for an animal
   */
  function preloadAnimal(animalId) {
    ANIMAL_AUDIO_TYPES.forEach(type => {
      preload(getAnimalAudioPath(animalId, type));
    });
  }

  /**
   * Preload audio for adjacent cards (for smooth transitions)
   */
  function preloadAdjacentAnimals(currentId, animals) {
    const currentIndex = animals.findIndex(a => a.id === currentId);
    if (currentIndex === -1) return;

    // Preload current, prev, and next
    const indices = [
      currentIndex,
      (currentIndex - 1 + animals.length) % animals.length,
      (currentIndex + 1) % animals.length
    ];

    indices.forEach(i => preloadAnimal(animals[i].id));
  }

  /**
   * Play animal audio
   * @param {string} animalId - Animal ID
   * @param {string} type - Audio type: 'name', 'epithet', 'fact', 'intro'
   * @returns {Promise} Resolves when playback completes or fails
   */
  function playAnimalAudio(animalId, type = 'intro') {
    return new Promise((resolve, reject) => {
      if (muted) return resolve();
      const path = getAnimalAudioPath(animalId, type);

      // Check if preloaded
      let audio = preloadedAudio.get(path);
      if (!audio) {
        audio = getAudioElement();
        audio.src = path;
      }

      audio.currentTime = 0;

      const handleEnd = () => {
        cleanup();
        resolve();
      };

      const handleError = (e) => {
        cleanup();
        // Graceful fallback - don't reject, just log
        console.warn(`Audio not found: ${path}`);
        resolve();
      };

      const cleanup = () => {
        audio.removeEventListener('ended', handleEnd);
        audio.removeEventListener('error', handleError);
      };

      audio.addEventListener('ended', handleEnd);
      audio.addEventListener('error', handleError);

      audio.play().catch(err => {
        cleanup();
        // Graceful fallback for autoplay restrictions
        console.warn('Audio playback blocked:', err.message);
        resolve();
      });
    });
  }

  /**
   * Play celebration sound using Web Audio API synthesis
   * @param {string} type - Celebration type: 'confetti', 'laser', 'fireworks', 'whipped-cream'
   * @returns {Promise} Resolves when playback completes
   */
  function playCelebration(type) {
    return new Promise((resolve) => {
      if (muted) return resolve();
      const ctx = getAudioContext();
      if (!ctx) return resolve();

      try {
        switch (type) {
          case 'confetti':
            synthConfetti(ctx);
            break;
          case 'laser':
            synthLaser(ctx);
            break;
          case 'fireworks':
            synthFireworks(ctx);
            break;
          case 'whipped-cream':
            synthWhippedCream(ctx);
            break;
        }
      } catch (e) {
        console.warn('Celebration sound synthesis failed:', e);
      }

      // Resolve after typical sound duration
      setTimeout(resolve, 1000);
    });
  }

  /**
   * Confetti: rapid ascending sparkle pops
   */
  function synthConfetti(ctx) {
    const now = ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000 + i * 400, now + i * 0.07);
      osc.frequency.exponentialRampToValueAtTime(2000 + i * 500, now + i * 0.07 + 0.05);
      gain.gain.setValueAtTime(0.15, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.12);
    }
  }

  /**
   * Laser: sawtooth sweep from high to low
   */
  function synthLaser(ctx) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.4);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * Fireworks: low boom + white noise crackle
   */
  function synthFireworks(ctx) {
    const now = ctx.currentTime;
    // Low boom
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, now);
    boom.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    boomGain.gain.setValueAtTime(0.3, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);
    boom.start(now);
    boom.stop(now + 0.4);

    // Crackle (noise burst)
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, now + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now + 0.1);
    noise.stop(now + 0.7);
  }

  /**
   * Whipped cream: noise burst through low-pass filter + high shimmer
   */
  function synthWhippedCream(ctx) {
    const now = ctx.currentTime;
    // Noise burst through low-pass filter (whoosh)
    const bufferSize = ctx.sampleRate * 0.6;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(500, now);
    lpf.frequency.linearRampToValueAtTime(2000, now + 0.3);
    lpf.frequency.linearRampToValueAtTime(300, now + 0.6);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    noise.connect(lpf);
    lpf.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.6);

    // High shimmer tones
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3000 + i * 500, now + 0.1 + i * 0.08);
      gain.gain.setValueAtTime(0.08, now + 0.1 + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + i * 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.1 + i * 0.08);
      osc.stop(now + 0.35 + i * 0.08);
    }
  }

  /**
   * Stop all playing audio
   */
  function stopAll() {
    audioPool.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  /**
   * Check if any audio is currently playing
   */
  function isPlaying() {
    return audioPool.some(audio => !audio.paused && !audio.ended);
  }

  /**
   * Set volume for all audio (0.0 - 1.0)
   */
  function setVolume(volume) {
    audioPool.forEach(audio => {
      audio.volume = Math.max(0, Math.min(1, volume));
    });
  }

  /**
   * Toggle global mute on/off
   */
  function toggleMute() {
    muted = !muted;
    localStorage.setItem('audioMuted', muted);
    if (muted) stopAll();
    return muted;
  }

  /**
   * Check if audio is muted
   */
  function isMuted() {
    return muted;
  }

  /**
   * Clear preloaded audio cache
   */
  function clearCache() {
    preloadedAudio.clear();
  }

  // Initialize on module load
  init();

  return {
    init,
    preload,
    preloadAnimal,
    preloadAdjacentAnimals,
    playAnimalAudio,
    playCelebration,
    stopAll,
    isPlaying,
    setVolume,
    toggleMute,
    isMuted,
    clearCache,
    ANIMAL_AUDIO_TYPES,
    CELEBRATION_TYPES
  };
})();
