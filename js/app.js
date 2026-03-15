/**
 * App Entry Point
 * Initialize Wild Animal Cards
 */
(async function() {
  'use strict';

  // Show loading state
  console.log('🐾 Wild Animal Cards - Loading...');

  try {
    // Detect deck and update UI
    const deck = AnimalData.getCurrentDeck();
    const isDino = deck === 'dinosaurs';
    if (isDino) {
      document.title = 'Dinosaur Cards';
      const logo = document.querySelector('.logo');
      if (logo) logo.textContent = 'Dinosaur Cards';
      document.body.classList.add('dino-deck');
    }

    // Load animal data
    const animals = await AnimalData.loadAnimals();
    console.log(`✅ Loaded ${animals.length} ${isDino ? 'dinosaurs' : 'wild animals'}`);

    // Setup audio toggle
    const audioToggle = document.getElementById('audio-toggle');
    if (AudioManager.isMuted()) {
      audioToggle.classList.add('muted');
    }
    audioToggle.addEventListener('click', () => {
      const nowMuted = AudioManager.toggleMute();
      audioToggle.classList.toggle('muted', nowMuted);
    });

    // Setup deck switch link
    const deckSwitch = document.getElementById('deck-switch');
    if (deckSwitch) {
      if (isDino) {
        deckSwitch.href = 'index.html';
        deckSwitch.textContent = '\uD83D\uDC3E Animals';
      } else {
        deckSwitch.href = 'index.html?deck=dinosaurs';
        deckSwitch.textContent = '\uD83E\uDD96 Dinosaurs';
      }
    }

    // Initialize game
    Game.init(animals);

    // Load first card
    Game.loadCurrentCard();

    console.log('🎮 Game ready! Tap a card to flip it.');

  } catch (error) {
    console.error('Failed to initialize game:', error);

    // Show error to user
    const main = document.querySelector('.main');
    main.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <h2 style="color: var(--color-danger);">Oops!</h2>
        <p>Failed to load the game. Please refresh and try again.</p>
        <button onclick="location.reload()"
                style="margin-top: 1rem; padding: 0.5rem 1rem;
                       background: var(--color-primary); color: #000;
                       border: none; border-radius: 8px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
  }

  // Register Service Worker for PWA (optional, for future)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('Service Worker registered:', reg.scope);
    }).catch(err => {
      console.warn('Service Worker registration failed:', err);
    });
  }

  // Prevent pull-to-refresh on mobile
  document.body.addEventListener('touchmove', (e) => {
    if (e.target.closest('.card-carousel, .collection-grid')) {
      // Allow scrolling in these areas
      return;
    }
  }, { passive: true });

  // Add touch feedback
  document.querySelectorAll('button, .card, .collection-card').forEach(el => {
    el.addEventListener('touchstart', () => {
      el.style.opacity = '0.8';
    }, { passive: true });

    el.addEventListener('touchend', () => {
      el.style.opacity = '1';
    }, { passive: true });
  });

})();
