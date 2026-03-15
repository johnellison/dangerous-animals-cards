/**
 * Animal Data Module
 * Handles loading, querying, and managing animal data
 */
const AnimalData = (function() {
  let animals = [];
  let loaded = false;

  // Dinosaur collection definitions
  const DINO_COLLECTIONS = {
    theropods: {
      name: 'Theropods',
      icon: '\uD83E\uDD96',
      description: 'Two-legged meat-eating dinosaurs',
      filter: (a) => a.type === 'theropod' && a.category === 'predator'
    },
    sauropods: {
      name: 'Sauropods',
      icon: '\uD83E\uDD95',
      description: 'Long-necked gentle giants',
      filter: (a) => a.type === 'sauropod'
    },
    armored: {
      name: 'Armored Dinos',
      icon: '\uD83D\uDEE1\uFE0F',
      description: 'Plated, horned, and armored dinosaurs',
      filter: (a) => ['ceratopsian', 'stegosaurid', 'ankylosaur'].includes(a.type)
    },
    raptors: {
      name: 'Raptors & Claws',
      icon: '\uD83E\uDE83',
      description: 'Fast, smart, deadly hunters',
      filter: (a) => ['velociraptor', 'deinonychus', 'therizinosaurus'].includes(a.id)
    },
    waterDinos: {
      name: 'Water & Coastal',
      icon: '\uD83C\uDF0A',
      description: 'Dinosaurs that lived near water',
      filter: (a) => a.type === 'spinosaurid' || a.habitat === 'coastal' || a.habitat === 'swamp'
    },
    herbivores: {
      name: 'Plant Eaters',
      icon: '\uD83C\uDF3F',
      description: 'Peaceful plant-munching dinosaurs',
      filter: (a) => a.category === 'herbivore'
    }
  };

  // Collection definitions with display info
  const COLLECTIONS = {
    snakes: {
      name: 'Snakes',
      icon: '🐍',
      description: 'Slithering serpents from around the world',
      filter: (a) => a.type === 'reptile' && (
        a.name.toLowerCase().includes('snake') ||
        a.name.toLowerCase().includes('cobra') ||
        a.name.toLowerCase().includes('mamba') ||
        a.name.toLowerCase().includes('viper') ||
        a.name.toLowerCase().includes('adder') ||
        a.name.toLowerCase().includes('taipan') ||
        a.name.toLowerCase().includes('anaconda') ||
        a.name.toLowerCase().includes('boomslang') ||
        a.name.toLowerCase().includes('lancehead') ||
        a.name.toLowerCase().includes('cottonmouth') ||
        a.name.toLowerCase().includes('fer-de-lance')
      )
    },
    frogs: {
      name: 'Frogs & Toads',
      icon: '🐸',
      description: 'Colorful amphibians with surprising powers',
      filter: (a) => a.type === 'amphibian'
    },
    felines: {
      name: 'Big Cats',
      icon: '🐆',
      description: 'Powerful feline predators',
      filter: (a) => a.type === 'mammal' && (
        a.name.toLowerCase().includes('leopard') ||
        a.name.toLowerCase().includes('jaguar') ||
        a.name.toLowerCase().includes('lion') ||
        a.name.toLowerCase().includes('tiger') ||
        a.name.toLowerCase().includes('cheetah') ||
        a.name.toLowerCase().includes('cougar') ||
        a.name.toLowerCase().includes('ocelot') ||
        a.name.toLowerCase().includes('cat')
      )
    },
    spiders: {
      name: 'Spiders & Scorpions',
      icon: '🕷️',
      description: 'Eight-legged terrors and stinging arachnids',
      filter: (a) => a.type === 'arachnid'
    },
    sharks: {
      name: 'Sharks',
      icon: '🦈',
      description: 'Apex predators of the ocean',
      filter: (a) => a.type === 'fish' && a.name.toLowerCase().includes('shark')
    },
    birds: {
      name: 'Birds',
      icon: '🦅',
      description: 'Fearsome feathered hunters',
      filter: (a) => a.type === 'bird'
    },
    riverMonsters: {
      name: 'River Monsters',
      icon: '🐟',
      description: 'Terrifying freshwater fish from rivers around the world',
      filter: (a) => a.type === 'fish' && a.habitat === 'freshwater'
    },
    marine: {
      name: 'Marine Life',
      icon: '🐋',
      description: 'Whales, dolphins, and ocean dwellers',
      filter: (a) => (
        (a.type === 'mammal' && a.habitat === 'sea') ||
        a.type === 'cnidarian' ||
        a.type === 'mollusk' ||
        a.type === 'crustacean' ||
        (a.type === 'fish' && a.habitat !== 'freshwater' && !a.name.toLowerCase().includes('shark'))
      )
    },
    canines: {
      name: 'Wolves & Dogs',
      icon: '🐺',
      description: 'Pack hunters and wild canines',
      filter: (a) => a.type === 'mammal' && (
        a.name.toLowerCase().includes('wolf') ||
        a.name.toLowerCase().includes('dog') ||
        a.name.toLowerCase().includes('fox') ||
        a.name.toLowerCase().includes('dhole')
      )
    },
    australian: {
      name: 'Australian Animals',
      icon: '🦘',
      description: 'Amazing creatures from the land down under',
      filter: (a) => a.region.toLowerCase().includes('australia')
    },
    insects: {
      name: 'Insects & Bugs',
      icon: '🐛',
      description: 'Six-legged wonders and tiny terrors',
      filter: (a) => a.type === 'insect'
    },
    centipedes: {
      name: 'Centipedes',
      icon: '🐛',
      description: 'Venomous many-legged predators that hunt bats, snakes, and more',
      filter: (a) => a.type === 'centipede'
    }
  };

  /**
   * Get the active collections based on current deck
   */
  function getActiveCollectionDefs() {
    return getCurrentDeck() === 'dinosaurs' ? DINO_COLLECTIONS : COLLECTIONS;
  }

  /**
   * Get collection for an animal
   */
  function getAnimalCollection(animal) {
    const defs = getActiveCollectionDefs();
    for (const [key, collection] of Object.entries(defs)) {
      if (collection.filter(animal)) {
        return key;
      }
    }
    return 'other';
  }

  /**
   * Get all collections with their animals
   */
  function getCollections() {
    const defs = getActiveCollectionDefs();
    const result = {};
    for (const [key, collection] of Object.entries(defs)) {
      const collectionAnimals = animals.filter(collection.filter);
      if (collectionAnimals.length > 0) {
        result[key] = {
          ...collection,
          animals: collectionAnimals,
          count: collectionAnimals.length
        };
      }
    }
    return result;
  }

  /**
   * Get animals by collection key
   */
  function getByCollection(collectionKey) {
    if (collectionKey === 'all') return animals;
    const defs = getActiveCollectionDefs();
    const collection = defs[collectionKey];
    if (!collection) return [];
    return animals.filter(collection.filter);
  }

  /**
   * Get current deck from URL parameter
   */
  function getCurrentDeck() {
    const params = new URLSearchParams(window.location.search);
    return params.get('deck') || 'animals';
  }

  /**
   * Load animals from JSON file
   */
  async function loadAnimals() {
    if (loaded) return animals;

    const deck = getCurrentDeck();
    const dataFile = deck === 'dinosaurs' ? 'data/dinosaurs.json' : 'data/animals.json';

    try {
      const response = await fetch(dataFile);
      if (!response.ok) throw new Error(`Failed to load ${deck} data`);
      animals = await response.json();
      loaded = true;
      console.log(`Loaded ${animals.length} ${deck}`);
      return animals;
    } catch (error) {
      console.error(`Error loading ${deck}:`, error);
      // Return demo data if file doesn't exist yet
      animals = getDemoAnimals();
      loaded = true;
      return animals;
    }
  }

  /**
   * Demo animals for testing before real data is added
   */
  function getDemoAnimals() {
    return [
      {
        id: "king-cobra",
        name: "King Cobra",
        epithet: "The Serpent King",
        type: "reptile",
        category: "venomous",
        habitat: "forest",
        region: "Southeast Asia",
        rarity: "rare",
        image: "images/animals/king-cobra.jpg",
        stats: {
          dangerLevel: 9,
          speed: 7,
          size: 8
        },
        facts: [
          "Can deliver enough venom to kill an elephant in a single bite",
          "The world's longest venomous snake, reaching up to 18 feet",
          "The only snake that builds a nest for its eggs"
        ]
      },
      {
        id: "box-jellyfish",
        name: "Box Jellyfish",
        epithet: "The Invisible Killer",
        type: "cnidarian",
        category: "venomous",
        habitat: "sea",
        region: "Australia & Indo-Pacific",
        rarity: "uncommon",
        image: "images/animals/box-jellyfish.jpg",
        stats: {
          dangerLevel: 10,
          speed: 5,
          size: 4
        },
        facts: [
          "Has enough venom to kill 60 adult humans",
          "Nearly invisible in the water",
          "Has 24 eyes but no brain"
        ]
      },
      {
        id: "inland-taipan",
        name: "Inland Taipan",
        epithet: "The Fierce Snake",
        type: "reptile",
        category: "venomous",
        habitat: "desert",
        region: "Central Australia",
        rarity: "legendary",
        image: "images/animals/inland-taipan.jpg",
        stats: {
          dangerLevel: 10,
          speed: 8,
          size: 5
        },
        facts: [
          "The most venomous snake on Earth",
          "One bite contains enough venom to kill 100 adult men",
          "Changes color with the seasons - darker in winter"
        ]
      },
      {
        id: "blue-ringed-octopus",
        name: "Blue-Ringed Octopus",
        epithet: "The Tiny Terror",
        type: "mollusk",
        category: "venomous",
        habitat: "sea",
        region: "Pacific Ocean",
        rarity: "rare",
        image: "images/animals/blue-ringed-octopus.jpg",
        stats: {
          dangerLevel: 9,
          speed: 4,
          size: 1
        },
        facts: [
          "Only the size of a golf ball but deadly venomous",
          "Blue rings flash as a warning before it attacks",
          "Venom can paralyze and kill a human in minutes"
        ]
      },
      {
        id: "poison-dart-frog",
        name: "Poison Dart Frog",
        epithet: "The Living Jewel",
        type: "amphibian",
        category: "poisonous",
        habitat: "forest",
        region: "Central & South America",
        rarity: "uncommon",
        image: "images/animals/poison-dart-frog.jpg",
        stats: {
          dangerLevel: 8,
          speed: 3,
          size: 1
        },
        facts: [
          "One golden poison frog has enough toxin to kill 10 grown men",
          "Indigenous people used their poison on blow darts",
          "Bright colors warn predators: Don't eat me!"
        ]
      },
      {
        id: "great-white-shark",
        name: "Great White Shark",
        epithet: "The Ocean's Apex",
        type: "fish",
        category: "predator",
        habitat: "sea",
        region: "Worldwide",
        rarity: "rare",
        image: "images/animals/great-white-shark.jpg",
        stats: {
          dangerLevel: 8,
          speed: 9,
          size: 10
        },
        facts: [
          "Can smell a single drop of blood from 3 miles away",
          "Has 300 serrated teeth arranged in rows",
          "Can leap completely out of the water when hunting"
        ]
      },
      {
        id: "komodo-dragon",
        name: "Komodo Dragon",
        epithet: "The Living Dinosaur",
        type: "reptile",
        category: "venomous",
        habitat: "land",
        region: "Indonesia",
        rarity: "legendary",
        image: "images/animals/komodo-dragon.jpg",
        stats: {
          dangerLevel: 8,
          speed: 6,
          size: 9
        },
        facts: [
          "The largest living lizard, up to 10 feet long",
          "Has venomous glands that prevent blood clotting",
          "Can eat 80% of its body weight in one meal"
        ]
      },
      {
        id: "saltwater-crocodile",
        name: "Saltwater Crocodile",
        epithet: "The Ancient Predator",
        type: "reptile",
        category: "predator",
        habitat: "freshwater",
        region: "Australia & Southeast Asia",
        rarity: "rare",
        image: "images/animals/saltwater-crocodile.jpg",
        stats: {
          dangerLevel: 9,
          speed: 7,
          size: 10
        },
        facts: [
          "Has the strongest bite force of any animal - 3,700 PSI",
          "Can grow over 20 feet long and live 70+ years",
          "Survived the dinosaur extinction 65 million years ago"
        ]
      },
      {
        id: "deathstalker-scorpion",
        name: "Deathstalker Scorpion",
        epithet: "The Desert Demon",
        type: "arachnid",
        category: "venomous",
        habitat: "desert",
        region: "North Africa & Middle East",
        rarity: "uncommon",
        image: "images/animals/deathstalker-scorpion.jpg",
        stats: {
          dangerLevel: 7,
          speed: 5,
          size: 2
        },
        facts: [
          "The most dangerous scorpion in the world",
          "Venom is worth $39 million per gallon for medical research",
          "Glows under ultraviolet light"
        ]
      },
      {
        id: "cone-snail",
        name: "Cone Snail",
        epithet: "The Beautiful Assassin",
        type: "mollusk",
        category: "venomous",
        habitat: "sea",
        region: "Tropical Oceans",
        rarity: "uncommon",
        image: "images/animals/cone-snail.jpg",
        stats: {
          dangerLevel: 8,
          speed: 1,
          size: 2
        },
        facts: [
          "Fires a venomous harpoon-like tooth at prey",
          "No antivenom exists for their sting",
          "Nicknamed 'cigarette snail' - time for one last smoke"
        ]
      }
    ];
  }

  /**
   * Get all animals
   */
  function getAll() {
    return animals;
  }

  /**
   * Get animal by ID
   */
  function getById(id) {
    return animals.find(animal => animal.id === id);
  }

  /**
   * Get animals by category
   */
  function getByCategory(category) {
    return animals.filter(animal => animal.category === category);
  }

  /**
   * Get animals by habitat
   */
  function getByHabitat(habitat) {
    return animals.filter(animal => animal.habitat === habitat);
  }

  /**
   * Get animals by rarity
   */
  function getByRarity(rarity) {
    return animals.filter(animal => animal.rarity === rarity);
  }

  /**
   * Get animals by type
   */
  function getByType(type) {
    return animals.filter(animal => animal.type === type);
  }

  /**
   * Get random animal
   */
  function getRandom() {
    return animals[Math.floor(Math.random() * animals.length)];
  }

  /**
   * Get random animals (excluding one)
   */
  function getRandomExcluding(excludeId, count = 3) {
    const filtered = animals.filter(a => a.id !== excludeId);
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Shuffle array
   */
  function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  return {
    loadAnimals,
    getAll,
    getById,
    getByCategory,
    getByHabitat,
    getByRarity,
    getByType,
    getRandom,
    getRandomExcluding,
    shuffle,
    getCollections,
    getByCollection,
    getAnimalCollection,
    getCurrentDeck,
    COLLECTIONS,
    DINO_COLLECTIONS
  };
})();

/**
 * Collection/Progress Module
 * Handles saving and loading player progress
 */
const Collection = (function() {
  const deck = AnimalData.getCurrentDeck();
  const STORAGE_KEY = deck === 'dinosaurs' ? 'dinosaur_cards_collection' : 'wild_animal_cards_collection';
  const OLD_STORAGE_KEY = 'dangerous_animals_collection';

  let discovered = new Set();
  let stats = {
    totalFlips: 0,
    correctGuesses: 0,
    wrongGuesses: 0,
    currentStreak: 0,
    bestStreak: 0
  };

  /**
   * Migrate data from old localStorage key if needed
   */
  function migrate() {
    try {
      if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(OLD_STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, localStorage.getItem(OLD_STORAGE_KEY));
        localStorage.removeItem(OLD_STORAGE_KEY);
        console.log('Migrated collection data to new key');
      }
    } catch (error) {
      console.error('Error migrating collection data:', error);
    }
  }

  /**
   * Load progress from localStorage
   */
  function load() {
    migrate();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        discovered = new Set(data.discovered || []);
        stats = { ...stats, ...data.stats };
      }
    } catch (error) {
      console.error('Error loading collection:', error);
    }
  }

  /**
   * Save progress to localStorage
   */
  function save() {
    try {
      const data = {
        discovered: Array.from(discovered),
        stats: stats
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving collection:', error);
    }
  }

  /**
   * Mark animal as discovered
   */
  function discover(animalId) {
    const wasNew = !discovered.has(animalId);
    discovered.add(animalId);
    stats.totalFlips++;
    save();
    return wasNew;
  }

  /**
   * Check if animal is discovered
   */
  function isDiscovered(animalId) {
    return discovered.has(animalId);
  }

  /**
   * Get all discovered animal IDs
   */
  function getDiscovered() {
    return Array.from(discovered);
  }

  /**
   * Get discovery count
   */
  function getCount() {
    return discovered.size;
  }

  /**
   * Record correct guess
   */
  function recordCorrectGuess() {
    stats.correctGuesses++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
    save();
  }

  /**
   * Record wrong guess
   */
  function recordWrongGuess() {
    stats.wrongGuesses++;
    stats.currentStreak = 0;
    save();
  }

  /**
   * Get stats
   */
  function getStats() {
    return { ...stats };
  }

  /**
   * Reset streak (when starting new session)
   */
  function resetStreak() {
    stats.currentStreak = 0;
    save();
  }

  return {
    load,
    save,
    discover,
    isDiscovered,
    getDiscovered,
    getCount,
    recordCorrectGuess,
    recordWrongGuess,
    getStats,
    resetStreak
  };
})();
