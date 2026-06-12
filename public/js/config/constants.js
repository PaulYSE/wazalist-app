/**
 * @file constants.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Shared constants for marking labels, shape symbols, platform mappings, like/dislike values, Excel colors, and import text parsing utilities.
 */

// Template for Marking Labels

/**
 * @brief Default template for the six marking labels.
 *
 * Index order: 0=Want to Learn, 1=Learning, 2=Complete, 3=Favourite, 4=Oriwaza, 5=Forgotten.
 *
 * @type {string[]}
 */
export const MARKING_LABELS_TEMPLATE = [
  'Want to Learn',
  'Learning',
  'Complete',
  'Favourite',
  'Oriwaza',
  'Forgotten',
];

// Shapes for markings 1-6 (index 0-5)

/**
 * @brief Unicode shape symbols for each marking index.
 *
 * @type {string[]}
 */
export const SHAPES = ['●', '▲', '■', '♥', '★', '◆'];
// export const SHAPES_HUES = [200, 45, 123, 280, 80, 330];

/**
 * @brief Hue angles (in degrees) for each shape symbol.
 *
 * Used for generating marking blend colors.
 *
 * @type {number[]}
 */
export const SHAPES_HUES = [4, 28, 54, 118, 212, 272];

// Platform labels and colors for video links

/**
 * @brief Display labels for video platforms.
 *
 * @type {Object.<string, string>}
 */
export const platLabel = {
  yt: 'YouTube',
  bili: 'Bilibili',
  tw: 'Twitter/X',
  nico: 'NicoNico',
  fb: 'Facebook',
  other: 'Video',
};

/**
 * @brief Brand colors for video platforms.
 *
 * @type {Object.<string, string>}
 */
export const platColor = {
  yt: '#ff0000',
  bili: '#00a1d6',
  tw: '#1da1f2',
  nico: '#e6007b',
  fb: '#1877f2',
  other: '#555',
};

// Like/dislike values (stored as integers in database)

/**
 * @brief Neutral like state (no preference).
 *
 * @type {null}
 */
export const LIKE_NONE = null; // No preference (neutral)

/**
 * @brief Like/thumbs up value.
 *
 * @type {number}
 */
export const LIKE_UP = 1; // Like/thumbs up

/**
 * @brief Dislike/thumbs down value.
 *
 * @type {number}
 */
export const LIKE_DOWN = -1; // Dislike/thumbs down

// Cell Fill color mapping for Excel export (indexed by marking index)

/**
 * @brief Hexadecimal fill colors for Excel export, indexed by marking index (0-5).
 *
 * @type {string[]}
 */
export const EXPORT_MARK_COLORS = [
  'FFFF0000', // 0 ● red    #ff0000
  'FFFF9900', // 1 ▲ orange #ff9900
  'FFFFFF00', // 2 ■ yellow #ffff00
  'FF00FF00', // 3 ♥ green  #00ff00
  'FF00FFFF', // 4 ★ cyan   #00ffff
  'FFFF00FF', // 5 ◆ pink   #ff00ff
];

// Common status labels mapping to Wazalist markings

/**
 * @brief Maps common status keywords to marking indices.
 *
 * Used during text import to auto-assign markings based on descriptive text.
 *
 * @type {Object.<string, number>}
 */
export const STATUS_TO_SHAPE_MAP = {
  // Completed/Learnt → Marking 3 (Complete)
  learnt: 2,
  completed: 2,
  mastered: 2,
  done: 2,
  finished: 2,
  // Learning/In Progress → Marking 2 (Learning)
  learning: 1,
  'in progress': 1,
  wip: 1,
  practicing: 1,
  // Forgot/Review → Marking 5 (Forgot)
  forgot: 4,
  forgotten: 4,
  review: 4,
  'needs review': 4,
  outdated: 4,
  // Want to Learn → Marking 1 (Want to Learn)
  'want to learn': 0,
  planned: 0,
  'not learnt': 0,
  todo: 0,
  future: 0,
  // Original/Favourite → Marking 4 (My Favourite)
  original: 3,
  'own skills': 3,
  oriwaza: 3,
  favourite: 3,
  favorite: 3,
  custom: 3,
  // Decorative markers → Marking 4 (My Favourite)
  '★': 3,
  '˗ˏˋ ★ ˎˊ˗': 3,
};

// Common header keywords to skip

/**
 * @brief Keywords that indicate header rows to skip during text import.
 *
 * @type {string[]}
 */
export const HEADER_KEYWORDS = [
  'basic waza',
  'learn first',
  'learn after',
  'useful to learn',
  'fundamental',
  'advanced',
  'optional',
  'niche',
  'recommended',
  'labels',
  'completed',
  'forgot',
  'learning',
  'want to learn',
  'videos',
  'channels',
  'wazaren',
  'tutorial',
  'compilation',
  'insert name here',
  '>>>',
];

// Decorative markers to strip

/**
 * @brief Regular expression patterns for stripping decorative markers from text during import.
 *
 * @type {RegExp[]}
 */
export const DECORATIVE_PATTERNS = [
  /˗ˏˋ ★ ˎˊ˗/g, // Star decorations
  /\s*\(optional\)\s*/gi, // (Optional) tags
  /\s*-\s*(center|left|right)\s*/gi, // Position markers
  /\s*-\s*tutorial\s*\d+\s*/gi, // Tutorial year markers
  /\s*\(private\s*link\)\s*/gi, // Private link markers
  /\s*\(outdated\)\s*/gi, // Outdated markers
];
