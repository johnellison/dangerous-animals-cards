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
   * Play celebration sound
   * @param {string} type - Celebration type: 'confetti', 'laser', 'fireworks', 'whipped-cream'
   * @returns {Promise} Resolves when playback completes
   */
  function playCelebration(type) {
    return new Promise((resolve) => {
      const path = getCelebrationAudioPath(type);
      const audio = getAudioElement();
      audio.src = path;
      audio.currentTime = 0;

      const handleEnd = () => {
        cleanup();
        resolve();
      };

      const handleError = () => {
        cleanup();
        // Graceful fallback
        console.warn(`Celebration audio not found: ${path}`);
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
        console.warn('Celebration audio blocked:', err.message);
        resolve();
      });
    });
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
    clearCache,
    ANIMAL_AUDIO_TYPES,
    CELEBRATION_TYPES
  };
})();
