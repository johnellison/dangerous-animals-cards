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

  /**
   * Initialize game with animal data
   */
  function init(animalData) {
    animals = animalData;
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
        renderCollection(btn.dataset.filter);
      });
    });

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
    const cardStage = document.querySelector('.card-stage');
    let touchStartX = 0;
    let touchEndX = 0;

    cardStage.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    cardStage.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextCard();
        } else {
          prevCard();
        }
      }
    }
  }

  /**
   * Switch between game modes
   */
  function switchMode(mode) {
    currentMode = mode;

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
      CardRenderer.flipCard(card, () => {
        // Mark as discovered
        const wasNew = Collection.discover(animal.id);
        if (wasNew && animal.rarity === 'legendary') {
          CardRenderer.celebrate();
        }
      });
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
    hasGuessed = false;

    // Pick random animal
    currentGuessAnimal = AnimalData.getRandom();

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
    const result = document.getElementById('guess-result');
    const resultText = result.querySelector('.result-text');

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
      if (streak % 5 === 0) {
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
      });
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
   * Render collection grid
   */
  function renderCollection(filter = 'all') {
    const grid = document.getElementById('collection-grid');
    grid.innerHTML = '';

    const discovered = Collection.getDiscovered();

    let filteredAnimals = animals;
    if (filter === 'discovered') {
      filteredAnimals = animals.filter(a => discovered.includes(a.id));
    } else if (filter === 'undiscovered') {
      filteredAnimals = animals.filter(a => !discovered.includes(a.id));
    }

    filteredAnimals.forEach(animal => {
      const isDiscovered = discovered.includes(animal.id);
      const card = CardRenderer.renderCollectionCard(animal, isDiscovered);

      if (isDiscovered) {
        card.addEventListener('click', () => openCardModal(animal));
      }

      grid.appendChild(card);
    });

    // Update progress
    updateCollectionProgress();
  }

  /**
   * Update collection progress bar
   */
  function updateCollectionProgress() {
    const total = animals.length;
    const discovered = Collection.getCount();
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
