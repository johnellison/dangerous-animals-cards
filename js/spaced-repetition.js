/**
 * Spaced Repetition Module (SM2 Algorithm)
 * Implements scientifically-proven algorithm for optimal learning retention
 */
const SpacedRepetition = (function() {
  const STORAGE_KEY = 'wild_animal_cards_sr';
  const OLD_STORAGE_KEY = 'dangerous_animals_sr';

  // Default values for new cards
  const DEFAULT_EASE_FACTOR = 2.5;
  const MIN_EASE_FACTOR = 1.3;

  // Quality rating thresholds
  const QUALITY = {
    BLACKOUT: 0,      // Complete blackout, no recall
    INCORRECT: 1,     // Incorrect, but recognized on reveal
    HARD: 2,          // Incorrect, seemed easy after reveal
    DIFFICULT: 3,     // Correct with difficulty
    GOOD: 4,          // Correct with hesitation
    PERFECT: 5        // Perfect, instant recall
  };

  // SR data structure
  let data = {
    animals: {},
    lastSessionDate: null
  };

  /**
   * Migrate data from old localStorage key if needed
   */
  function migrate() {
    try {
      if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(OLD_STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, localStorage.getItem(OLD_STORAGE_KEY));
        localStorage.removeItem(OLD_STORAGE_KEY);
        console.log('Migrated SR data to new key');
      }
    } catch (error) {
      console.error('Error migrating SR data:', error);
    }
  }

  /**
   * Load SR data from localStorage
   */
  function load() {
    migrate();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        data = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading SR data:', error);
    }
  }

  /**
   * Save SR data to localStorage
   */
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving SR data:', error);
    }
  }

  /**
   * Get or initialize animal SR record
   */
  function getAnimalRecord(animalId) {
    if (!data.animals[animalId]) {
      data.animals[animalId] = {
        easeFactor: DEFAULT_EASE_FACTOR,
        interval: 0,
        repetitions: 0,
        nextReview: getTodayString(),
        totalReviews: 0,
        correctReviews: 0,
        lastReviewDate: null
      };
    }
    return data.animals[animalId];
  }

  /**
   * Get today's date as YYYY-MM-DD string
   */
  function getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Calculate quality rating based on guess result
   * @param {boolean} isCorrect - Whether the guess was correct
   * @param {number} responseTime - Response time in milliseconds
   * @param {number} streak - Current streak count
   * @returns {number} Quality rating 0-5
   */
  function calculateQuality(isCorrect, responseTime, streak) {
    if (!isCorrect) {
      // Incorrect answers get quality 0-2
      if (responseTime < 3000) {
        return QUALITY.INCORRECT; // Quick wrong = recognized it
      }
      return QUALITY.BLACKOUT; // Slow wrong = complete blank
    }

    // Correct answers get quality 3-5
    // Fast response = better recall
    if (responseTime < 2000) {
      // Very fast correct
      return streak >= 3 ? QUALITY.PERFECT : QUALITY.GOOD;
    } else if (responseTime < 5000) {
      // Medium speed correct
      return QUALITY.GOOD;
    } else {
      // Slow but correct
      return QUALITY.DIFFICULT;
    }
  }

  /**
   * Record a review and update SR data using SM2 algorithm
   * @param {string} animalId - Animal ID
   * @param {number} quality - Quality rating 0-5
   */
  function recordReview(animalId, quality) {
    const record = getAnimalRecord(animalId);

    record.totalReviews++;
    record.lastReviewDate = getTodayString();

    if (quality >= 3) {
      // Correct response
      record.correctReviews++;

      if (record.repetitions === 0) {
        record.interval = 1; // First review: 1 day
      } else if (record.repetitions === 1) {
        record.interval = 6; // Second review: 6 days
      } else {
        // Subsequent reviews: interval * easeFactor
        record.interval = Math.round(record.interval * record.easeFactor);
      }
      record.repetitions++;
    } else {
      // Incorrect response - reset to beginning
      record.repetitions = 0;
      record.interval = 1;
    }

    // Update ease factor using SM2 formula
    // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    const ef = record.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    record.easeFactor = Math.max(MIN_EASE_FACTOR, ef);

    // Calculate next review date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + record.interval);
    record.nextReview = nextDate.toISOString().split('T')[0];

    save();

    return record;
  }

  /**
   * Get all animals due for review today
   * @returns {string[]} Array of animal IDs due for review
   */
  function getDueCards() {
    const today = getTodayString();
    const dueCards = [];

    for (const [animalId, record] of Object.entries(data.animals)) {
      if (record.nextReview <= today) {
        dueCards.push(animalId);
      }
    }

    return dueCards;
  }

  /**
   * Get animals that have never been reviewed
   * @param {string[]} allAnimalIds - All animal IDs in the game
   * @returns {string[]} Array of animal IDs never reviewed
   */
  function getNewCards(allAnimalIds) {
    return allAnimalIds.filter(id => !data.animals[id]);
  }

  /**
   * Get SR status for an animal
   * @param {string} animalId - Animal ID
   * @returns {string} 'new' | 'due' | 'learning' | 'mastered'
   */
  function getStatus(animalId) {
    const record = data.animals[animalId];
    if (!record) return 'new';

    const today = getTodayString();

    if (record.nextReview <= today) {
      return 'due';
    } else if (record.interval < 7) {
      return 'learning';
    } else if (record.interval >= 30) {
      return 'mastered';
    } else {
      return 'learning';
    }
  }

  /**
   * Get detailed stats for an animal
   * @param {string} animalId - Animal ID
   * @returns {object} SR statistics
   */
  function getAnimalStats(animalId) {
    const record = getAnimalRecord(animalId);
    return {
      ...record,
      status: getStatus(animalId),
      accuracy: record.totalReviews > 0
        ? Math.round((record.correctReviews / record.totalReviews) * 100)
        : 0
    };
  }

  /**
   * Get overall SR statistics
   * @param {string[]} allAnimalIds - All animal IDs
   * @returns {object} Overall statistics
   */
  function getOverallStats(allAnimalIds) {
    const today = getTodayString();
    let newCount = 0;
    let dueCount = 0;
    let learningCount = 0;
    let masteredCount = 0;
    let totalReviews = 0;
    let totalCorrect = 0;

    for (const id of allAnimalIds) {
      const status = getStatus(id);
      switch (status) {
        case 'new': newCount++; break;
        case 'due': dueCount++; break;
        case 'learning': learningCount++; break;
        case 'mastered': masteredCount++; break;
      }

      if (data.animals[id]) {
        totalReviews += data.animals[id].totalReviews;
        totalCorrect += data.animals[id].correctReviews;
      }
    }

    return {
      newCount,
      dueCount,
      learningCount,
      masteredCount,
      totalReviews,
      totalCorrect,
      accuracy: totalReviews > 0
        ? Math.round((totalCorrect / totalReviews) * 100)
        : 0
    };
  }

  /**
   * Select optimal card for review (prioritizes due cards)
   * @param {string[]} allAnimalIds - All animal IDs
   * @returns {string|null} Animal ID to review or null
   */
  function selectCardForReview(allAnimalIds) {
    // Priority 1: Due cards
    const dueCards = getDueCards();
    if (dueCards.length > 0) {
      // Sort by how overdue they are
      dueCards.sort((a, b) => {
        const recordA = data.animals[a];
        const recordB = data.animals[b];
        return recordA.nextReview.localeCompare(recordB.nextReview);
      });
      return dueCards[0];
    }

    // Priority 2: New cards
    const newCards = getNewCards(allAnimalIds);
    if (newCards.length > 0) {
      return newCards[Math.floor(Math.random() * newCards.length)];
    }

    // Priority 3: Random from learning pool
    const learningCards = allAnimalIds.filter(id => getStatus(id) === 'learning');
    if (learningCards.length > 0) {
      return learningCards[Math.floor(Math.random() * learningCards.length)];
    }

    // Fallback: Random card
    return allAnimalIds[Math.floor(Math.random() * allAnimalIds.length)];
  }

  /**
   * Reset all SR data
   */
  function reset() {
    data = {
      animals: {},
      lastSessionDate: null
    };
    save();
  }

  // Initialize on module load
  load();

  return {
    QUALITY,
    load,
    save,
    recordReview,
    calculateQuality,
    getDueCards,
    getNewCards,
    getStatus,
    getAnimalStats,
    getOverallStats,
    selectCardForReview,
    reset
  };
})();
