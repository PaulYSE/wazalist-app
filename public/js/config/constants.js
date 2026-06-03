/* constants.js — shared constants for field names, label templates, shape symbols, and mappings. */

// Waza fields
export const SE_FIELDS = [
  'name_jp',
  'name_en',
  'name_en_literal',
  'name_en_gtranslate',
  'tag',
  'reference',
  'parent_jp0',
  'parent_en0',
  'parent_jp1',
  'parent_en1',
  'author_jp0',
  'author_en0',
  'author_jp1',
  'author_en1',
  'video0',
  'video1',
  'video2',
  'video3',
  'video4',
  'video5',
  'video6',
  'video7',
  'video8',
  'video9',
];
export const NW_FIELDS = [
  'name_jp',
  'name_en',
  'name_en_literal',
  'tag',
  'parent_jp0',
  'parent_en0',
  'author_jp0',
  'author_en0',
  'author_jp1',
  'author_en1',
  'video0',
  'video1',
  'video2',
  'video3',
  'video4',
  'reference',
];

// Template for Marking Labels
export const MARKING_LABELS_TEMPLATE = [
  'Want to Learn',
  'Learning',
  'Complete',
  'Favourite',
  'Oriwaza',
  'Forgotten',
];

// Shapes for markings 1-6 (index 0-5)
export const SHAPES = ['●', '▲', '■', '♥', '★', '◆'];
// export const SHAPES_HUES = [200, 45, 123, 280, 80, 330];
export const SHAPES_HUES = [4, 28, 54, 118, 212, 272];

// Platform labels and colors for video links
export const platLabel = {
  yt: 'YouTube',
  bili: 'Bilibili',
  tw: 'Twitter/X',
  nico: 'NicoNico',
  fb: 'Facebook',
  other: 'Video',
};
export const platColor = {
  yt: '#ff0000',
  bili: '#00a1d6',
  tw: '#1da1f2',
  nico: '#e6007b',
  fb: '#1877f2',
  other: '#555',
};

// Like/dislike values (stored as integers in database)
export const LIKE_NONE = null; // No preference (neutral)
export const LIKE_UP = 1; // Like/thumbs up
export const LIKE_DOWN = -1; // Dislike/thumbs down

// Cell Fill color mapping for Excel export (indexed by marking index)
export const EXPORT_MARK_COLORS = [
  'FF4F8FF7',
  'FF4CAF82',
  'FFE8A030',
  'FFE0557F',
  'FFF5C518',
  'FF7C6FF7',
];

// Common status labels mapping to Wazalist markings
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
export const DECORATIVE_PATTERNS = [
  /˗ˏˋ ★ ˎˊ˗/g, // Star decorations
  /\s*\(optional\)\s*/gi, // (Optional) tags
  /\s*-\s*(center|left|right)\s*/gi, // Position markers
  /\s*-\s*tutorial\s*\d+\s*/gi, // Tutorial year markers
  /\s*\(private\s*link\)\s*/gi, // Private link markers
  /\s*\(outdated\)\s*/gi, // Outdated markers
];
