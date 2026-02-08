/**
 * Game Logic Module
 * Handles game modes, scoring, and game state
 */
const Game = (function() {
  let currentMode = 'discover';
  let currentAnimalIndex = 0;
  let animals = [];

  // Guess mode state
  let currentGuessAnimal = null;
  let guessOptions = [];
  let hasGuessed = false;
  let score = 0;
  let streak = 0;

  // Response time tracking for spaced repetition
  let guessStartTime = null;

  // Collection state
  let currentCollection = 'all';
  let currentFilter = 'all';

  /**
   * Initialize game with animal data
   */
  function init(animalData) {
    animals = AnimalData.shuffle([...animalData]);
    Collection.load();
    setupEventListeners();
    updateCardCounter();
  }

  /**
   * Setup all event listeners
   */
  function setupEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        switchMode(mode);
      });
    });

    // Card carousel buttons
    document.querySelector('.carousel-btn.prev').addEventListener('click', prevCard);
    document.querySelector('.carousel-btn.next').addEventListener('click', nextCard);

    // Main card click (flip)
    document.getElementById('main-card').addEventListener('click', handleCardClick);

    // Guess card click
    document.getElementById('guess-card').addEventListener('click', handleGuessCardClick);

    // Next guess button
    document.getElementById('next-guess-btn').addEventListener('click', nextGuessRound);

    // Collection filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderCollectionGrid();
      });
    });

    // Collection tabs (will be set up when collection mode is entered)
    setupCollectionTabs();

    // Audio replay button
    const audioReplayBtn = document.querySelector('.audio-replay-btn');
    if (audioReplayBtn) {
      audioReplayBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Don't trigger card flip
        const animal = animals[currentAnimalIndex];
        if (animal && typeof AudioManager !== 'undefined') {
          AudioManager.playAnimalAudio(animal.id, 'intro');
        }
      });
    }

    // Keyboard navigation
    document.addEventListener('keydown', handleKeydown);

    // Touch swipe support
    setupSwipeGestures();
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeydown(e) {
    if (currentMode === 'discover') {
      if (e.key === 'ArrowLeft') prevCard();
      if (e.key === 'ArrowRight') nextCard();
      if (e.key === ' ' || e.key === 'Enter') handleCardClick();
    }
  }

  /**
   * Setup swipe gestures for touch devices
   */
  function setupSwipeGestures() {
    const discoverMode = document.getElementById('discover-mode');
    const card = document.getElementById('main-card');
    let touchStartX = 0;
    let touchCurrentX = 0;
    let isSwiping = false;

    discoverMode.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].clientX;
      touchCurrentX = touchStartX;
      isSwiping = true;
      card.style.transition = 'none';
    }, { passive: true });

    discoverMode.addEventListener('touchmove', (e) => {
      if (!isSwiping) return;
      touchCurrentX = e.changedTouches[0].clientX;
      const diff = touchCurrentX - touchStartX;
      // Dampen the drag so it feels natural
      const dampened = diff * 0.4;
      card.style.transform = `translateX(${dampened}px) rotate(${dampened * 0.05}deg)`;
    }, { passive: true });

    discoverMode.addEventListener('touchend', (e) => {
      if (!isSwiping) return;
      isSwiping = false;
      const diff = touchStartX - touchCurrentX;
      card.style.transition = 'transform 0.3s ease';
      card.style.transform = '';

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextCard();
        } else {
          prevCard();
        }
      }
    }, { passive: true });
  }

  /**
   * Switch between game modes
   */
  function switchMode(mode) {
    currentMode = mode;

    if (typeof AudioManager !== 'undefined') AudioManager.stopAll();

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update mode sections
    document.querySelectorAll('.mode').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(`${mode}-mode`).classList.add('active');

    // Initialize mode-specific content
    if (mode === 'discover') {
      loadCurrentCard();
    } else if (mode === 'guess') {
      startGuessRound();
    } else if (mode === 'collection') {
      renderCollection('all');
    }
  }

  /**
   * Load and display current card in discover mode
   */
  function loadCurrentCard() {
    if (animals.length === 0) return;

    const animal = animals[currentAnimalIndex];
    const card = document.getElementById('main-card');

    CardRenderer.unflipCard(card);
    CardRenderer.renderCard(animal, card);
    updateCardCounter();
  }

  /**
   * Handle card click in discover mode
   */
  function handleCardClick() {
    const card = document.getElementById('main-card');
    const animal = animals[currentAnimalIndex];

    if (!card.classList.contains('flipped')) {
      // Preload adjacent cards' audio
      if (typeof AudioManager !== 'undefined') {
        AudioManager.preloadAdjacentAnimals(animal.id, animals);
      }

      CardRenderer.flipCard(card, () => {
        // Mark as discovered
        const wasNew = Collection.discover(animal.id);
        if (wasNew) {
          if (animal.rarity === 'legendary' || animal.rarity === 'rare') {
            CardRenderer.celebrate();
          } else if (Math.random() < 0.15) {
            CardRenderer.celebrate();
          }
        }
      }, animal.id); // Pass animal ID for audio playback
    } else {
      // Allow flipping back to see the photo again
      CardRenderer.unflipCard(card);
    }
  }

  /**
   * Go to previous card
   */
  function prevCard() {
    if (animals.length === 0) return;

    if (typeof AudioManager !== 'undefined') AudioManager.stopAll();

    const card = document.getElementById('main-card');
    CardRenderer.unflipCard(card);

    CardRenderer.transitionCard(card, 'prev', () => {
      currentAnimalIndex = (currentAnimalIndex - 1 + animals.length) % animals.length;
      loadCurrentCard();
    });
  }

  /**
   * Go to next card
   */
  function nextCard() {
    if (animals.length === 0) return;

    if (typeof AudioManager !== 'undefined') AudioManager.stopAll();

    const card = document.getElementById('main-card');
    CardRenderer.unflipCard(card);

    CardRenderer.transitionCard(card, 'next', () => {
      currentAnimalIndex = (currentAnimalIndex + 1) % animals.length;
      loadCurrentCard();
    });
  }

  /**
   * Update card counter display
   */
  function updateCardCounter() {
    document.querySelector('.card-counter .current').textContent = currentAnimalIndex + 1;
    document.querySelector('.card-counter .total').textContent = animals.length;
  }

  // ========================================
  // GUESS MODE
  // ========================================

  /**
   * Start a new guess round
   */
  function startGuessRound() {
    if (typeof AudioManager !== 'undefined') AudioManager.stopAll();
    hasGuessed = false;
    guessStartTime = Date.now(); // Track response time for SR

    // Use SR to pick optimal animal for review
    const allAnimalIds = animals.map(a => a.id);
    const selectedId = SpacedRepetition.selectCardForReview(allAnimalIds);
    currentGuessAnimal = AnimalData.getById(selectedId) || AnimalData.getRandom();

    // Get 3 wrong options
    const wrongOptions = AnimalData.getRandomExcluding(currentGuessAnimal.id, 3);

    // Create options array with correct + wrong, then shuffle
    guessOptions = AnimalData.shuffle([currentGuessAnimal, ...wrongOptions]);

    // Setup card
    const card = document.getElementById('guess-card');
    CardRenderer.unflipCard(card);

    // Render silhouette on front
    const front = card.querySelector('.card-front');
    CardRenderer.renderSilhouette(currentGuessAnimal, front);

    // Render full info on back
    const back = card.querySelector('.card-back');
    CardRenderer.renderCardBack(currentGuessAnimal, back);

    // Render options
    renderGuessOptions();

    // Reset UI
    document.getElementById('guess-result').classList.remove('show', 'correct', 'incorrect');
    document.getElementById('next-guess-btn').classList.remove('show');

    // Update score display
    updateScoreDisplay();
  }

  /**
   * Render guess option buttons
   */
  function renderGuessOptions() {
    const container = document.getElementById('guess-options');
    container.innerHTML = '';

    guessOptions.forEach(animal => {
      const btn = document.createElement('button');
      btn.className = 'guess-option';
      btn.textContent = animal.name;
      btn.dataset.id = animal.id;
      btn.addEventListener('click', () => handleGuess(animal.id));
      container.appendChild(btn);
    });
  }

  /**
   * Handle guess selection
   */
  function handleGuess(selectedId) {
    if (hasGuessed) return;
    hasGuessed = true;

    const isCorrect = selectedId === currentGuessAnimal.id;
    const responseTime = Date.now() - guessStartTime;
    const result = document.getElementById('guess-result');
    const resultText = result.querySelector('.result-text');

    // Calculate quality and record review for spaced repetition
    const quality = SpacedRepetition.calculateQuality(isCorrect, responseTime, streak);
    SpacedRepetition.recordReview(currentGuessAnimal.id, quality);

    // Update option button styles
    document.querySelectorAll('.guess-option').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.id === currentGuessAnimal.id) {
        btn.classList.add('correct');
      } else if (btn.dataset.id === selectedId) {
        btn.classList.add('incorrect');
      }
    });

    // Show result
    if (isCorrect) {
      result.classList.add('show', 'correct');
      resultText.textContent = 'Correct!';
      score += 10 + (streak * 2);
      streak++;
      Collection.recordCorrectGuess();
      CardRenderer.playSound('correct');

      // Celebrate for streak milestones
      if (streak > 0 && streak % 3 === 0) {
        CardRenderer.celebrate();
      }
    } else {
      result.classList.add('show', 'incorrect');
      resultText.textContent = `Nope! It was ${currentGuessAnimal.name}`;
      streak = 0;
      Collection.recordWrongGuess();
    }

    // Flip the card to reveal
    setTimeout(() => {
      const card = document.getElementById('guess-card');
      // Remove silhouette mode so image shows properly
      const front = card.querySelector('.card-front');
      CardRenderer.revealSilhouette(front);
      CardRenderer.flipCard(card, () => {
        Collection.discover(currentGuessAnimal.id);
      }, currentGuessAnimal.id); // Pass animal ID for audio
    }, 500);

    // Show next button
    document.getElementById('next-guess-btn').classList.add('show');

    updateScoreDisplay();
  }

  /**
   * Handle guess card click
   */
  function handleGuessCardClick() {
    if (!hasGuessed) return;
    // Allow flipping back and forth to see the animal photo
    const card = document.getElementById('guess-card');
    if (card.classList.contains('flipped')) {
      CardRenderer.unflipCard(card);
    } else {
      CardRenderer.flipCard(card);
    }
  }

  /**
   * Start next guess round
   */
  function nextGuessRound() {
    startGuessRound();
  }

  /**
   * Update score display
   */
  function updateScoreDisplay() {
    document.getElementById('score-value').textContent = score;
    document.getElementById('streak-value').textContent = streak;
  }

  // ========================================
  // COLLECTION MODE
  // ========================================

  /**
   * Setup collection tabs
   */
  function setupCollectionTabs() {
    const tabsContainer = document.getElementById('collection-tabs');
    if (!tabsContainer) return;

    // Clear existing tabs (except "All")
    tabsContainer.innerHTML = `
      <button class="collection-tab active" data-collection="all">
        <span class="tab-icon">🌍</span>
        <span class="tab-name">All</span>
        <span class="tab-count">${animals.length}</span>
      </button>
    `;

    // Add tabs for each collection
    const collections = AnimalData.getCollections();
    for (const [key, collection] of Object.entries(collections)) {
      const tab = document.createElement('button');
      tab.className = 'collection-tab';
      tab.dataset.collection = key;
      tab.innerHTML = `
        <span class="tab-icon">${collection.icon}</span>
        <span class="tab-name">${collection.name}</span>
        <span class="tab-count">${collection.count}</span>
      `;
      tabsContainer.appendChild(tab);
    }

    // Add click handlers
    tabsContainer.querySelectorAll('.collection-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabsContainer.querySelectorAll('.collection-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentCollection = tab.dataset.collection;
        renderCollectionGrid();
      });
    });
  }

  /**
   * Render collection grid
   */
  function renderCollection(filter = 'all') {
    currentFilter = filter;
    setupCollectionTabs();
    renderCollectionGrid();
  }

  /**
   * Render the collection grid based on current collection and filter
   */
  function renderCollectionGrid() {
    const grid = document.getElementById('collection-grid');
    grid.innerHTML = '';

    const discovered = Collection.getDiscovered();

    // Start with animals in current collection
    let collectionAnimals = AnimalData.getByCollection(currentCollection);

    // Apply filter
    let filteredAnimals = collectionAnimals;
    if (currentFilter === 'discovered') {
      filteredAnimals = collectionAnimals.filter(a => discovered.includes(a.id));
    } else if (currentFilter === 'undiscovered') {
      filteredAnimals = collectionAnimals.filter(a => !discovered.includes(a.id));
    } else if (currentFilter === 'due') {
      const dueIds = SpacedRepetition.getDueCards();
      filteredAnimals = collectionAnimals.filter(a => dueIds.includes(a.id));
    } else if (currentFilter === 'mastered') {
      filteredAnimals = collectionAnimals.filter(a => SpacedRepetition.getStatus(a.id) === 'mastered');
    }

    filteredAnimals.forEach(animal => {
      const isDiscovered = discovered.includes(animal.id);
      const srStatus = SpacedRepetition.getStatus(animal.id);
      const card = CardRenderer.renderCollectionCard(animal, isDiscovered, srStatus);

      if (isDiscovered) {
        card.addEventListener('click', () => openCardModal(animal));
      }

      grid.appendChild(card);
    });

    // Update progress for current collection
    updateCollectionProgress(collectionAnimals);
    updateSRStats();
  }

  /**
   * Update SR statistics display
   */
  function updateSRStats() {
    const allAnimalIds = animals.map(a => a.id);
    const stats = SpacedRepetition.getOverallStats(allAnimalIds);

    const statsEl = document.getElementById('sr-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <span class="sr-stat due" title="Due for review">${stats.dueCount} due</span>
        <span class="sr-stat learning" title="Learning">${stats.learningCount} learning</span>
        <span class="sr-stat mastered" title="Mastered">${stats.masteredCount} mastered</span>
      `;
    }
  }

  /**
   * Update collection progress bar
   */
  function updateCollectionProgress(collectionAnimals = null) {
    const animalsToCount = collectionAnimals || animals;
    const total = animalsToCount.length;
    const discoveredIds = Collection.getDiscovered();
    const discovered = animalsToCount.filter(a => discoveredIds.includes(a.id)).length;
    const percentage = total > 0 ? (discovered / total) * 100 : 0;

    document.getElementById('collection-progress').style.width = `${percentage}%`;
    document.getElementById('collection-text').textContent = `${discovered} / ${total}`;
  }

  /**
   * Open card detail modal
   */
  function openCardModal(animal) {
    const modal = document.getElementById('card-modal');
    const modalCard = modal.querySelector('.modal-card');

    // Create full card view for modal
    modalCard.innerHTML = `
      <div class="card flipped" style="max-width: 340px; margin: 0 auto;">
        <div class="card-inner">
          <div class="card-front">
            <div class="card-photo-frame ${animal.rarity}">
              <div class="card-rarity-glow"></div>
              <div class="card-image-wrapper">
                <img class="card-photo" src="${animal.image}" alt="${animal.name}"
                     onerror="this.src='https://placehold.co/400x500/1a1a3a/ffd700?text=${encodeURIComponent(animal.name)}'">
              </div>
            </div>
          </div>
          <div class="card-back">
            <div class="card-info-frame ${animal.rarity}">
              <div class="card-rarity-badge ${animal.rarity}">${animal.rarity}</div>
              <div class="card-type-icon" data-type="${animal.type}"></div>
              <div class="card-name-section">
                <h2 class="card-name">${animal.name}</h2>
                <p class="card-epithet">${animal.epithet || ''}</p>
              </div>
              <div class="card-stats">
                <div class="stat">
                  <span class="stat-label">DANGER</span>
                  <div class="stat-bar"><div class="stat-fill danger" style="width: ${animal.stats.dangerLevel * 10}%"></div></div>
                  <span class="stat-value">${animal.stats.dangerLevel}/10</span>
                </div>
                <div class="stat">
                  <span class="stat-label">SPEED</span>
                  <div class="stat-bar"><div class="stat-fill speed" style="width: ${animal.stats.speed * 10}%"></div></div>
                  <span class="stat-value">${animal.stats.speed}/10</span>
                </div>
                <div class="stat">
                  <span class="stat-label">SIZE</span>
                  <div class="stat-bar"><div class="stat-fill size" style="width: ${animal.stats.size * 10}%"></div></div>
                  <span class="stat-value">${animal.stats.size}/10</span>
                </div>
              </div>
              <div class="card-facts">
                <h3 class="facts-title">Fun Facts</h3>
                <ul class="facts-list">
                  ${animal.facts.map(fact => `<li class="fact-item">${fact}</li>`).join('')}
                </ul>
              </div>
              <div class="card-footer">
                <span class="card-habitat" data-habitat="${animal.habitat}">${animal.habitat}</span>
                <span class="card-region">${animal.region}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');

    // Close handlers
    const closeModal = () => modal.classList.remove('open');
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  }

  return {
    init,
    switchMode,
    loadCurrentCard
  };
})();
