/* import-parser.js — the text-import engine: column/status/label detection,
   tab-separated parsing, and findWazaForLine()/parseTextImport(). No DOM here. */
    let _tiMatched = [];        // [{waza, rawLine, category, manualMarkings}]
    let _tiUnmatched = [];      // [rawLine]
    let _tiParsed = false;
    let _tiFoundLabels = [];    // ordered unique label strings found in the text e.g. "[Learning]", "{Done}" (Note: () reserved for English(Japanese) format)
    let _tiAutoMapping = {};    // { [labelStr]: markingIndex (-1 = none) }
    let _tiLabelNames = {};     // { [labelStr]: displayName } — user-editable
    let _tiPreviewMode = false; // true when auto-labels have been applied to manualMarkings as preview

    // ── Phase 1 Import Enhancements ──────────────────────────────

    // Common status labels mapping to Wazalist markings
    const STATUS_TO_SHAPE_MAP = {
      // Completed/Learnt → Marking 3 (Complete)
      'learnt': 2, 'completed': 2, 'mastered': 2, 'done': 2, 'finished': 2,
      // Learning/In Progress → Marking 2 (Learning)
      'learning': 1, 'in progress': 1, 'wip': 1, 'practicing': 1,
      // Forgot/Review → Marking 5 (Forgot)
      'forgot': 4, 'forgotten': 4, 'review': 4, 'needs review': 4, 'outdated': 4,
      // Want to Learn → Marking 1 (Want to Learn)
      'want to learn': 0, 'planned': 0, 'not learnt': 0, 'todo': 0, 'future': 0,
      // Original/Favourite → Marking 4 (My Favourite)
      'original': 3, 'own skills': 3, 'oriwaza': 3, 'favourite': 3, 'favorite': 3, 'custom': 3,
      // Decorative markers → Marking 4 (My Favourite)
      '★': 3, '˗ˏˋ ★ ˎˊ˗': 3
    };

    // Common header keywords to skip
    const HEADER_KEYWORDS = [
      'basic waza', 'learn first', 'learn after', 'useful to learn',
      'fundamental', 'advanced', 'optional', 'niche', 'recommended',
      'labels', 'completed', 'forgot', 'learning', 'want to learn',
      'videos', 'channels', 'wazaren', 'tutorial', 'compilation',
      'insert name here', '>>>'
    ];

    // Decorative markers to strip
    const DECORATIVE_PATTERNS = [
      /˗ˏˋ ★ ˎˊ˗/g,  // Star decorations
      /\s*\(optional\)\s*/gi,  // (Optional) tags
      /\s*-\s*(center|left|right)\s*/gi,  // Position markers
      /\s*-\s*tutorial\s*\d+\s*/gi,  // Tutorial year markers
      /\s*\(private\s*link\)\s*/gi,  // Private link markers
      /\s*\(outdated\)\s*/gi  // Outdated markers
    ];

    // ── Phase 2 Import Enhancements ──────────────────────────────

    // Fuzzy status matching - find closest known status label
    function fuzzyMatchStatus(text) {
      if (!text) return null;
      const normalized = text.toLowerCase().trim();
      
      // Exact match first
      if (STATUS_TO_SHAPE_MAP[normalized] !== undefined) {
        return STATUS_TO_SHAPE_MAP[normalized];
      }
      
      // Fuzzy match - check if status text contains any known keywords
      for (const [key, value] of Object.entries(STATUS_TO_SHAPE_MAP)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          return value;
        }
      }
      
      // Check for partial word matches
      const words = normalized.split(/\s+/);
      for (const word of words) {
        if (STATUS_TO_SHAPE_MAP[word] !== undefined) {
          return STATUS_TO_SHAPE_MAP[word];
        }
      }
      
      return null;
    }

    // Enhanced multi-column detection with better heuristics
    function detectColumnLayout(lines) {
      const tabLines = lines.filter(l => l.includes('\t'));
      if (tabLines.length === 0) return null;
      
      // Sample first few tab-separated lines to detect pattern
      const samples = tabLines.slice(0, Math.min(10, tabLines.length));
      let wazaFirstCount = 0;
      let statusFirstCount = 0;
      
      samples.forEach(line => {
        const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
        if (parts.length < 2) return;
        
        const firstHasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(parts[0]);
        const firstHasParens = parts[0].includes('(');
        const secondHasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(parts[1]);
        const secondHasParens = parts[1].includes('(');
        
        // Check if first column looks like a status
        const firstIsStatus = fuzzyMatchStatus(parts[0]) !== null;
        const secondIsStatus = fuzzyMatchStatus(parts[1]) !== null;
        
        // Heuristic: waza names have Japanese + parentheses, statuses don't
        if ((firstHasParens && firstHasJapanese) || (firstIsStatus === false && secondIsStatus === true)) {
          wazaFirstCount++;
        }
        if ((secondHasParens && secondHasJapanese) || (secondIsStatus === false && firstIsStatus === true)) {
          statusFirstCount++;
        }
      });
      
      // Return most common pattern
      if (wazaFirstCount > statusFirstCount) {
        return 'WAZA_STATUS'; // Column A = Waza, Column B = Status
      } else if (statusFirstCount > wazaFirstCount) {
        return 'STATUS_WAZA'; // Column A = Status, Column B = Waza
      }
      
      return 'WAZA_STATUS'; // Default assumption
    }

    // Category detection and preservation
    function detectCategory(line) {
      // Check if line is a category header
      const lower = line.toLowerCase();
      
      // Common category patterns
      const categoryPatterns = [
        { pattern: /fundamental|basic|beginner/i, category: 'Fundamental' },
        { pattern: /advanced|expert|master/i, category: 'Advanced' },
        { pattern: /intermediate/i, category: 'Intermediate' },
        { pattern: /optional|niche/i, category: 'Optional' },
        { pattern: /favourite|favorite|custom|original|own/i, category: 'Favourite' }
      ];
      
      for (const { pattern, category } of categoryPatterns) {
        if (pattern.test(lower)) {
          return category;
        }
      }
      
      return null; // Not a category header
    }

    // Check if line is a header/instruction row (should be skipped)
    function isHeaderLine(line) {
      const lower = line.toLowerCase();
      return HEADER_KEYWORDS.some(keyword => lower.includes(keyword));
    }

    // Strip decorative markers and return cleaned text + detected favorite flag
    function stripDecorations(text) {
      let cleaned = text;
      let isFavorite = false;
      
      // Check for star decoration before stripping
      if (text.includes('˗ˏˋ ★ ˎˊ˗') || text.includes('★')) {
        isFavorite = true;
      }
      
      // Strip all decorative patterns
      DECORATIVE_PATTERNS.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
      });
      
      return { cleaned: cleaned.trim(), isFavorite };
    }

    // Extract waza name from Excel hyperlink formula
    function extractFromHyperlink(text) {
      // Pattern: =HYPERLINK("URL", "Waza Name")
      const match = text.match(/=HYPERLINK\s*\(\s*"[^"]*"\s*,\s*"([^"]+)"\s*\)/i);
      return match ? match[1] : null;
    }

    // Parse "English (Japanese)" format and extract both parts
    function parseWazaName(text) {
      // Try to extract from "English (Japanese)" format
      const match = text.match(/^(.+?)\s*\(([^()]*)\)\s*$/);
      if (match) {
        const english = match[1].trim();
        const japanese = match[2].trim();
        return { english, japanese, original: text };
      }
      return { english: text, japanese: '', original: text };
    }

    // Detect tab-separated format and parse status + waza (Phase 2: enhanced)
    function parseTabSeparated(line, columnLayout = null) {
      if (!line.includes('\t')) return null;
      
      const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
      if (parts.length < 2) return null;
      
      // Phase 2: Use detected layout if available
      if (columnLayout === 'STATUS_WAZA') {
        return { waza: parts[1], status: parts[0] || null };
      } else if (columnLayout === 'WAZA_STATUS') {
        return { waza: parts[0], status: parts[1] || null };
      }
      
      // Auto-detect if no layout provided
      const firstHasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(parts[0]);
      const secondHasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(parts[1]);
      
      // Phase 2: Use fuzzy status detection
      const firstIsStatus = fuzzyMatchStatus(parts[0]) !== null;
      const secondIsStatus = fuzzyMatchStatus(parts[1]) !== null;
      
      if (parts[0].includes('(') && firstHasJapanese) {
        // Column A = Waza, Column B = Status
        return { waza: parts[0], status: parts[1] || null };
      } else if (parts[1].includes('(') && secondHasJapanese) {
        // Column A = Status, Column B = Waza
        return { waza: parts[1], status: parts[0] || null };
      } else if (firstIsStatus && !secondIsStatus) {
        return { waza: parts[1], status: parts[0] };
      } else if (secondIsStatus && !firstIsStatus) {
        return { waza: parts[0], status: parts[1] };
      } else {
        // Ambiguous - assume first is waza
        return { waza: parts[0], status: parts[1] || null };
      }
    }

    // Map status text to marking index (0-5) - Phase 2: with fuzzy matching
    function mapStatusToMarking(statusText) {
      if (!statusText) return null;
      return fuzzyMatchStatus(statusText); // Use Phase 2 fuzzy matcher
    }

    // Matches any [...], {...} encapsulation on a line
    // Returns array of matched token strings (with brackets), e.g. ["[Learning]", "{WIP}"]
    // Note: () are reserved for "English(Japanese)" naming convention
    function extractEncapsulations(line) {
      const matches = [];
      const re = /\[([^\[\]]+)\]|\{([^{}]+)\}/g;
      let m;
      while ((m = re.exec(line)) !== null) matches.push(m[0]);
      return matches;
    }

    // Strip ALL encapsulated tokens from a line to get the bare waza name
    // Note: () are NOT stripped - they're part of the "English(Japanese)" format
    function stripAllLabels(line) {
      return line.replace(/\[([^\[\]]+)\]|\{([^{}]+)\}/g, '').replace(/\s+/g, ' ').trim();
    }

    // Detect which known label(s) appear on this line; returns first match or null
    function detectLabelOnLine(line) {
      const tokens = extractEncapsulations(line);
      for (const tok of tokens) {
        if (_tiFoundLabels.includes(tok)) return tok;
      }
      return null;
    }

    // Collect all unique labels across the entire text
    function collectLabels(rawText) {
      const seen = new Set();
      const ordered = [];
      rawText.split('\n').forEach(line => {
        extractEncapsulations(line.trim()).forEach(tok => {
          const key = tok.toLowerCase();
          if (!seen.has(key)) { seen.add(key); ordered.push(tok); }
        });
      });
      return ordered;
    }

    function findWazaForLine(line) {
      // Phase 1: Try hyperlink extraction first
      const hyperlinkMatch = extractFromHyperlink(line);
      if (hyperlinkMatch) {
        line = hyperlinkMatch;
      }
      
      // Phase 1: Strip decorations (but we'll check for favorites later)
      const { cleaned: decorationStripped } = stripDecorations(line);
      line = decorationStripped;
      
      const cleaned = stripAllLabels(line);
      if (!cleaned) return null;
      
      // Phase 1: Parse "English (Japanese)" format
      const { english, japanese } = parseWazaName(cleaned);
      
      // Try matching with both English and Japanese parts
      const norm = normalizeForSearch(cleaned);
      const normEnglish = normalizeForSearch(english);
      const normJapanese = normalizeForSearch(japanese);
      
      // Exact match - prioritize Japanese, then English, then full text
      let hit = null;
      
      // 1. Try exact Japanese match
      if (japanese) {
        hit = wazaData.find(w =>
          normalizeForSearch(w.name_jp || '') === normJapanese
        );
        if (hit) return hit;
      }
      
      // 2. Try exact English match
      hit = wazaData.find(w =>
        normalizeForSearch(w.name_en || '') === normEnglish ||
        normalizeForSearch(w.name_en_literal || '') === normEnglish ||
        normalizeForSearch(w.name_en_gtranslate || '') === normEnglish
      );
      if (hit) return hit;
      
      // 3. Try exact match on full cleaned text (fallback)
      hit = wazaData.find(w =>
        normalizeForSearch(w.name_jp || '') === norm ||
        normalizeForSearch(w.name_en || '') === norm ||
        normalizeForSearch(w.name_en_literal || '') === norm
      );
      if (hit) return hit;
      
      // Fuzzy match - try Japanese first, then English (STRICT: maxDistance=1)
      if (japanese) {
        hit = wazaData.find(w => isFuzzyMatch(w.name_jp, japanese, 2));
        if (hit) return hit;
      }
      
      hit = wazaData.find(w =>
        isFuzzyMatch(w.name_en, english, 2) ||
        isFuzzyMatch(w.name_en_literal, english, 2) ||
        isFuzzyMatch(w.name_en_gtranslate, english, 2)
      );
      if (hit) return hit;
      
      // Final fallback: fuzzy on full text (STRICT: maxDistance=1)
      hit = wazaData.find(w =>
        isFuzzyMatch(w.name_jp, cleaned, 2) ||
        isFuzzyMatch(w.name_en, cleaned, 2) ||
        isFuzzyMatch(w.name_en_literal, cleaned, 2)
      );
      return hit || null;
    }

    function parseTextImport(rawText) {
      // 1. Collect all unique labels in document order
      _tiFoundLabels = collectLabels(rawText);

      // 2. Seed _tiAutoMapping for new labels (preserve existing assignments)
      _tiFoundLabels.forEach((lbl, i) => {
        if (_tiAutoMapping[lbl] === undefined) {
          // Phase 1: Try to map known status labels automatically
          const statusMarking = mapStatusToMarking(lbl.slice(1, -1)); // Remove brackets
          _tiAutoMapping[lbl] = statusMarking !== null ? statusMarking : (i < 6 ? i : -1);
        }
      });

      // 3. Seed _tiLabelNames for new labels (default = inner text without brackets)
      _tiFoundLabels.forEach(lbl => {
        if (_tiLabelNames[lbl] === undefined) {
          _tiLabelNames[lbl] = lbl.slice(1, -1); // strip outer bracket pair
        }
      });

      // 4. Parse lines
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      
      // Phase 2: Detect column layout for tab-separated format
      const columnLayout = detectColumnLayout(lines);
      
      let currentLabel = null;
      let currentCategory = null; // Phase 2: Track category context
      _tiMatched = [];
      _tiUnmatched = [];

      lines.forEach(line => {
        // Phase 1: Skip header lines
        if (isHeaderLine(line)) {
          return;
        }
        
        // Phase 2: Check if line is a category header
        const detectedCategory = detectCategory(line);
        if (detectedCategory) {
          currentCategory = detectedCategory;
          return; // Skip category header line itself
        }
        
        // Phase 1: Handle tab-separated format
        const tabParsed = parseTabSeparated(line, columnLayout); // Phase 2: Pass detected layout
        let lineToProcess = line;
        let detectedStatus = null;
        
        if (tabParsed) {
          lineToProcess = tabParsed.waza;
          detectedStatus = tabParsed.status;
        }
        
        // Phase 1: Check for decorative markers (favorites)
        const { isFavorite } = stripDecorations(lineToProcess);
        
        const stripped = stripAllLabels(lineToProcess);
        const lineLabel = detectLabelOnLine(lineToProcess);

        if (!stripped) {
          // Pure label header line — update running context
          if (lineLabel) currentLabel = lineLabel;
          return;
        }

        // Effective label: inline takes priority over running context
        let effectiveLabel = lineLabel || currentLabel;
        
        // Phase 2: Use category as label if no other label present
        if (!effectiveLabel && currentCategory) {
          effectiveLabel = `[${currentCategory}]`; // Wrap in brackets to match label format
        }

        const waza = findWazaForLine(lineToProcess);
        if (waza) {
          const matchedItem = { 
            waza, 
            rawLine: line, 
            category: effectiveLabel, 
            manualMarkings: Array(6).fill(false) 
          };
          
          // Phase 1: Auto-assign markings from status or decorations
          if (detectedStatus) {
            const markingIdx = mapStatusToMarking(detectedStatus);
            if (markingIdx !== null) {
              matchedItem.manualMarkings[markingIdx] = true;
            }
          } else if (isFavorite) {
            // Auto-assign Favourite marking for decorated waza
            matchedItem.manualMarkings[3] = true; // Marking 4 (index 3)
          }
          
          _tiMatched.push(matchedItem);
        } else {
          _tiUnmatched.push(line);
        }
      });
      _tiParsed = true;
    }

