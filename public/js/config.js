/* config.js — constants only. Shared globals (SHAPES, platform maps, LIKE_*).
   No DOM, no logic. Edit here to add/rename markings or video platforms. */
    const SHAPES = ['●', '▲', '■', '♥', '★', '◆'];
    const platLabel = { yt: 'YouTube', bili: 'Bilibili', tw: 'Twitter/X', nico: 'NicoNico', fb: 'Facebook', other: 'Video' };
    const platColor = { yt: '#ff0000', bili: '#00a1d6', tw: '#1da1f2', nico: '#e6007b', fb: '#1877f2', other: '#555' };

    // Like/dislike values (stored as integers in database)
    const LIKE_NONE = null;   // No preference (neutral)
    const LIKE_UP = 1;         // Like/thumbs up
    const LIKE_DOWN = -1;      // Dislike/thumbs down


