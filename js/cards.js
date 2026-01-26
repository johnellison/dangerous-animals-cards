/**
 * Card Rendering Module
 * Handles creating and updating card UI elements
 */
const CardRenderer = (function() {

  /**
   * Render a full card with photo on front, info on back
   */
  function renderCard(animal, cardElement) {
    const front = cardElement.querySelector('.card-front');
    const back = cardElement.querySelector('.card-back');

    // Render front (photo side)
    renderCardFront(animal, front);

    // Render back (info side)
    renderCardBack(animal, back);
  }

  /**
   * Render front of card (photo)
   */
  function renderCardFront(animal, frontElement) {
    const photoFrame = frontElement.querySelector('.card-photo-frame');
    const photo = frontElement.querySelector('.card-photo');

    // Set rarity class on frame
    photoFrame.className = 'card-photo-frame ' + animal.rarity;

    // Set image
    photo.src = animal.image;
    photo.alt = animal.name;
    photo.onerror = () => {
      photo.src = `https://placehold.co/400x500/1a1a3a/ffd700?text=${encodeURIComponent(animal.name)}`;
    };
  }

  /**
   * Render back of card (info)
   */
  function renderCardBack(animal, backElement) {
    const infoFrame = backElement.querySelector('.card-info-frame');

    // Set rarity class on frame
    infoFrame.className = 'card-info-frame ' + animal.rarity;

    // Rarity badge
    const rarityBadge = infoFrame.querySelector('.card-rarity-badge');
    rarityBadge.className = 'card-rarity-badge ' + animal.rarity;
    rarityBadge.textContent = animal.rarity;

    // Type icon
    const typeIcon = infoFrame.querySelector('.card-type-icon');
    typeIcon.setAttribute('data-type', animal.type);

    // Name
    const name = infoFrame.querySelector('.card-name');
    name.textContent = animal.name;

    const epithet = infoFrame.querySelector('.card-epithet');
    epithet.textContent = animal.epithet || '';

    // Stats
    renderStats(infoFrame, animal.stats);

    // Facts - all three
    const factItems = infoFrame.querySelectorAll('.fact-item');
    animal.facts.forEach((fact, index) => {
      if (factItems[index]) {
        factItems[index].textContent = fact;
      }
    });

    // Footer
    const habitat = infoFrame.querySelector('.card-habitat');
    habitat.setAttribute('data-habitat', animal.habitat);
    habitat.textContent = capitalize(animal.habitat);

    const region = infoFrame.querySelector('.card-region');
    region.textContent = animal.region;
  }

  /**
   * Render stats bars
   */
  function renderStats(frame, stats) {
    const statElements = frame.querySelectorAll('.stat');

    // Danger
    const dangerStat = statElements[0];
    const dangerFill = dangerStat.querySelector('.stat-fill');
    const dangerValue = dangerStat.querySelector('.stat-value');
    dangerFill.style.width = `${stats.dangerLevel * 10}%`;
    dangerValue.textContent = `${stats.dangerLevel}/10`;

    // Speed
    const speedStat = statElements[1];
    const speedFill = speedStat.querySelector('.stat-fill');
    const speedValue = speedStat.querySelector('.stat-value');
    speedFill.style.width = `${stats.speed * 10}%`;
    speedValue.textContent = `${stats.speed}/10`;

    // Size
    const sizeStat = statElements[2];
    const sizeFill = sizeStat.querySelector('.stat-fill');
    const sizeValue = sizeStat.querySelector('.stat-value');
    sizeFill.style.width = `${stats.size * 10}%`;
    sizeValue.textContent = `${stats.size}/10`;
  }

  /**
   * Render collection card (mini version)
   * @param {object} animal - Animal data
   * @param {boolean} isDiscovered - Whether animal has been discovered
   * @param {string} srStatus - Spaced repetition status: 'new', 'due', 'learning', 'mastered'
   */
  function renderCollectionCard(animal, isDiscovered, srStatus = 'new') {
    const card = document.createElement('div');
    card.className = `collection-card ${isDiscovered ? 'discovered' : 'undiscovered'}`;
    card.dataset.id = animal.id;

    // Build SR badge HTML
    let srBadgeHtml = '';
    if (isDiscovered && srStatus !== 'new') {
      const badgeClass = `sr-badge sr-${srStatus}`;
      const badgeLabel = {
        due: 'Due',
        learning: 'Learning',
        mastered: 'Mastered'
      }[srStatus] || '';
      if (badgeLabel) {
        srBadgeHtml = `<div class="${badgeClass}">${badgeLabel}</div>`;
      }
    }

    if (isDiscovered) {
      card.innerHTML = `
        <img src="${animal.image}" alt="${animal.name}"
             onerror="this.src='https://placehold.co/200x150/1a1a3a/ffd700?text=${encodeURIComponent(animal.name)}'">
        <div class="card-mini-name">${animal.name}</div>
        <div class="rarity-indicator ${animal.rarity}"></div>
        ${srBadgeHtml}
      `;
    } else {
      card.innerHTML = `
        <div class="undiscovered-placeholder">
          <span class="mystery-mark">?</span>
        </div>
        <div class="card-mini-name">???</div>
      `;
    }

    return card;
  }

  /**
   * Render silhouette for guess mode
   */
  function renderSilhouette(animal, frontElement) {
    const photoFrame = frontElement.querySelector('.card-photo-frame');
    const photo = frontElement.querySelector('.card-photo');

    // Add silhouette mode class
    photoFrame.classList.add('silhouette-mode');

    // Set image (will be blacked out by CSS)
    photo.src = animal.image;
    photo.alt = 'Mystery Animal';
    photo.onerror = () => {
      photo.src = `https://placehold.co/400x500/000/000?text=?`;
    };
  }

  /**
   * Remove silhouette mode
   */
  function revealSilhouette(frontElement) {
    const photoFrame = frontElement.querySelector('.card-photo-frame');
    photoFrame.classList.remove('silhouette-mode');
  }

  /**
   * Flip card animation
   * @param {HTMLElement} cardElement - Card element to flip
   * @param {Function} callback - Optional callback after flip
   * @param {string} animalId - Optional animal ID to play audio for
   */
  function flipCard(cardElement, callback, animalId = null) {
    cardElement.classList.add('flipped');

    // Play flip sound
    playSound('flip');

    // Wait for flip animation to complete
    setTimeout(() => {
      // Play reveal sound for rare+ cards
      const infoFrame = cardElement.querySelector('.card-info-frame');
      if (infoFrame && (infoFrame.classList.contains('rare') || infoFrame.classList.contains('legendary'))) {
        playSound('reveal');
      }

      // Play animal intro audio if AudioManager is available
      if (animalId && typeof AudioManager !== 'undefined') {
        AudioManager.playAnimalAudio(animalId, 'intro');
      }

      if (callback) callback();
    }, 300);
  }

  /**
   * Unflip card
   */
  function unflipCard(cardElement) {
    cardElement.classList.remove('flipped');
  }

  /**
   * Transition to next/prev card
   */
  function transitionCard(cardElement, direction, callback) {
    cardElement.classList.add('card-transitioning', `to-${direction}`);

    setTimeout(() => {
      if (callback) callback();

      cardElement.classList.remove('to-' + direction);
      cardElement.classList.add('from-' + direction);

      setTimeout(() => {
        cardElement.classList.remove('card-transitioning', 'from-' + direction);
      }, 300);
    }, 200);
  }

  /**
   * Play sound effect
   */
  function playSound(soundName) {
    const audio = document.getElementById(`${soundName}-sound`);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }

  /**
   * Capitalize first letter
   */
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Add celebration - randomly picks one of 4 types
   */
  function celebrate() {
    const celebrationTypes = ['confetti', 'laser', 'fireworks', 'whipped-cream'];
    const celebrations = [confettiCelebration, laserCelebration, fireworksCelebration, whippedCreamCelebration];
    const index = Math.floor(Math.random() * celebrations.length);

    // Play celebration sound if AudioManager is available
    if (typeof AudioManager !== 'undefined') {
      AudioManager.playCelebration(celebrationTypes[index]);
    }

    celebrations[index]();
  }

  /**
   * Original confetti celebration
   */
  function confettiCelebration() {
    const container = document.createElement('div');
    container.className = 'particles-container';
    document.body.appendChild(container);

    const colors = ['#ffd700', '#ff44ff', '#44ffff', '#44ff44', '#ff4444'];

    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + 'vw';
      particle.style.top = '-20px';
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.animationDelay = Math.random() * 0.5 + 's';
      particle.style.animationDuration = (1.5 + Math.random()) + 's';
      container.appendChild(particle);
    }

    setTimeout(() => container.remove(), 3000);
  }

  /**
   * Laser light show celebration
   */
  function laserCelebration() {
    const container = document.createElement('div');
    container.className = 'laser-container';
    document.body.appendChild(container);

    // Add flash overlay
    const flash = document.createElement('div');
    flash.className = 'laser-flash';
    container.appendChild(flash);

    // Add laser beams
    for (let i = 0; i < 5; i++) {
      const beam = document.createElement('div');
      beam.className = 'laser-beam';
      container.appendChild(beam);
    }

    // Add extra sweeping beams
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const extraBeam = document.createElement('div');
        extraBeam.className = 'laser-beam';
        extraBeam.style.left = (30 + Math.random() * 40) + '%';
        extraBeam.style.background = `linear-gradient(to bottom, hsl(${Math.random() * 360}, 100%, 50%), transparent)`;
        container.appendChild(extraBeam);
      }, i * 200);
    }

    setTimeout(() => container.remove(), 2500);
  }

  /**
   * Fireworks celebration
   */
  function fireworksCelebration() {
    const container = document.createElement('div');
    container.className = 'fireworks-container';
    document.body.appendChild(container);

    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ffd700'];

    // Launch multiple fireworks
    for (let f = 0; f < 5; f++) {
      setTimeout(() => {
        const x = 15 + Math.random() * 70;
        const y = 20 + Math.random() * 30;
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Trail
        const trail = document.createElement('div');
        trail.className = 'firework-trail';
        trail.style.left = x + '%';
        trail.style.bottom = '0';
        trail.style.background = `linear-gradient(to top, transparent, ${color})`;
        container.appendChild(trail);

        // Burst after trail
        setTimeout(() => {
          trail.remove();
          const burst = document.createElement('div');
          burst.className = 'firework-burst';
          burst.style.left = x + '%';
          burst.style.top = y + '%';
          container.appendChild(burst);

          // Create sparks
          for (let i = 0; i < 20; i++) {
            const spark = document.createElement('div');
            spark.className = 'firework-spark';
            spark.style.background = color;
            const angle = (i / 20) * Math.PI * 2;
            const distance = 60 + Math.random() * 40;
            spark.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
            spark.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
            spark.style.animationDelay = Math.random() * 0.1 + 's';
            burst.appendChild(spark);
          }

          setTimeout(() => burst.remove(), 1500);
        }, 700);
      }, f * 400);
    }

    setTimeout(() => container.remove(), 4000);
  }

  /**
   * Whipped cream with sparkles celebration
   */
  function whippedCreamCelebration() {
    const container = document.createElement('div');
    container.className = 'cream-container';
    document.body.appendChild(container);

    // Create cream splats
    const splatPositions = [
      { x: 50, y: 50, size: 200 },
      { x: 30, y: 40, size: 120 },
      { x: 70, y: 45, size: 140 },
      { x: 45, y: 65, size: 100 },
      { x: 55, y: 35, size: 110 },
    ];

    splatPositions.forEach((pos, i) => {
      setTimeout(() => {
        const splat = document.createElement('div');
        splat.className = 'cream-splat';
        splat.style.left = pos.x + '%';
        splat.style.top = pos.y + '%';
        splat.style.width = pos.size + 'px';
        splat.style.height = pos.size * 0.7 + 'px';
        splat.style.setProperty('--rot', (Math.random() * 30 - 15) + 'deg');
        splat.style.transform = 'translate(-50%, -50%)';
        container.appendChild(splat);

        // Add drips
        for (let d = 0; d < 3; d++) {
          const drip = document.createElement('div');
          drip.className = 'cream-drip';
          drip.style.left = (pos.x - 5 + Math.random() * 10) + '%';
          drip.style.top = (pos.y + pos.size * 0.02) + '%';
          drip.style.animationDelay = (0.3 + Math.random() * 0.5) + 's';
          container.appendChild(drip);
        }
      }, i * 100);
    });

    // Add sparkles
    for (let i = 0; i < 25; i++) {
      setTimeout(() => {
        const sparkle = document.createElement('div');
        sparkle.className = 'cream-sparkle';
        sparkle.style.left = (20 + Math.random() * 60) + '%';
        sparkle.style.top = (25 + Math.random() * 50) + '%';
        sparkle.style.animationDelay = Math.random() * 0.3 + 's';
        container.appendChild(sparkle);
      }, 200 + i * 50);
    }

    // Add star emojis
    const stars = ['✨', '⭐', '🌟', '💫'];
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        const star = document.createElement('div');
        star.className = 'cream-star';
        star.textContent = stars[Math.floor(Math.random() * stars.length)];
        star.style.left = (15 + Math.random() * 70) + '%';
        star.style.top = (20 + Math.random() * 60) + '%';
        container.appendChild(star);
      }, 300 + i * 100);
    }

    setTimeout(() => container.remove(), 3500);
  }

  return {
    renderCard,
    renderCardFront,
    renderCardBack,
    renderCollectionCard,
    renderSilhouette,
    revealSilhouette,
    flipCard,
    unflipCard,
    transitionCard,
    playSound,
    celebrate
  };
})();
