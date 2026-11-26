/* Jazz Chord Lab — music theory engine (no dependencies).
   Chord parsing, jazz piano voicings with voice leading, and reharmonisation ideas.
   Works in the browser (window.Theory) and in Node for the tests. */
(function (root) {
  'use strict';

  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // Intervals in semitones from the root. Voicing templates list the colour tones
  // a jazz pianist plays without the root ("rootless" voicings, A and B forms).
  const QUALITIES = [
    { re: /^(maj7|M7|Δ7|Δ|ma7)$/, name: 'maj7', label: 'majeur 7', tones: [0, 4, 7, 11], A: [4, 7, 11, 14], B: [11, 14, 16, 19] },
    { re: /^(maj9|M9|Δ9)$/, name: 'maj9', label: 'majeur 9', tones: [0, 4, 7, 11, 14], A: [4, 7, 11, 14], B: [11, 14, 16, 19] },
    { re: /^(6|69|6\/9)$/, name: '6', label: 'sixte', tones: [0, 4, 7, 9], A: [4, 7, 9, 14], B: [9, 14, 16, 19] },
    { re: /^(m7b5|ø|ø7|-7b5|min7b5)$/, name: 'm7b5', label: 'demi-diminué', tones: [0, 3, 6, 10], A: [3, 6, 10, 12], B: [10, 12, 15, 18] },
    { re: /^(dim7|°7|o7|dim|°)$/, name: 'dim7', label: 'diminué', tones: [0, 3, 6, 9], A: [3, 6, 9, 12], B: [9, 12, 15, 18] },
    { re: /^(m6|-6|min6)$/, name: 'm6', label: 'mineur 6', tones: [0, 3, 7, 9], A: [3, 7, 9, 14], B: [9, 14, 15, 19] },
    { re: /^(m9|-9|min9)$/, name: 'm9', label: 'mineur 9', tones: [0, 3, 7, 10, 14], A: [3, 7, 10, 14], B: [10, 14, 15, 19] },
    { re: /^(m7|-7|min7|mi7)$/, name: 'm7', label: 'mineur 7', tones: [0, 3, 7, 10], A: [3, 7, 10, 14], B: [10, 14, 15, 19] },
    { re: /^(mMaj7|m\(maj7\)|-Δ7|mM7)$/, name: 'mMaj7', label: 'mineur majeur 7', tones: [0, 3, 7, 11], A: [3, 7, 11, 14], B: [11, 14, 15, 19] },
    { re: /^(m|-|min)$/, name: 'm', label: 'mineur', tones: [0, 3, 7], A: [3, 7, 10, 14], B: [10, 14, 15, 19] },
    { re: /^(7sus4|7sus|sus|sus4|9sus4)$/, name: '7sus4', label: '7 sus4', tones: [0, 5, 7, 10], A: [5, 7, 10, 14], B: [10, 14, 17, 19] },
    { re: /^(7alt|alt|7#9|7b9#9)$/, name: '7alt', label: '7 altéré', tones: [0, 4, 10, 15, 20], A: [4, 10, 15, 20], B: [10, 16, 20, 27] },
    { re: /^(7b9)$/, name: '7b9', label: '7 bémol 9', tones: [0, 4, 7, 10, 13], A: [4, 9, 10, 13], B: [10, 13, 16, 21] },
    { re: /^(13)$/, name: '13', label: '13', tones: [0, 4, 7, 10, 14, 21], A: [4, 9, 10, 14], B: [10, 14, 16, 21] },
    { re: /^(9)$/, name: '9', label: '9', tones: [0, 4, 7, 10, 14], A: [4, 9, 10, 14], B: [10, 14, 16, 21] },
    { re: /^(7)$/, name: '7', label: 'septième de dominante', tones: [0, 4, 7, 10], A: [4, 9, 10, 14], B: [10, 14, 16, 21] },
    { re: /^()$/, name: 'maj', label: 'majeur', tones: [0, 4, 7], A: [4, 7, 9, 14], B: [9, 14, 16, 19] },
  ];

  function parseChord(sym) {
    const s = String(sym).trim();
    const m = s.match(/^([A-Ga-g])([#b]?)(.*?)(?:\/([A-Ga-g][#b]?))?$/);
    if (!m) throw new Error('Accord illisible : ' + sym);
    const root = (NOTE_INDEX[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    const q = QUALITIES.find(x => x.re.test(m[3]));
    if (!q) throw new Error('Type d\'accord inconnu : « ' + m[3] + ' » dans ' + sym);
    const useFlats = m[2] === 'b' || ['F'].includes(m[1].toUpperCase()) && !m[2];
    return { symbol: s, root, rootName: (useFlats ? FLAT : SHARP)[root], quality: q.name, label: q.label, tones: q.tones, A: q.A, B: q.B, flats: useFlats || m[2] === 'b' };
  }

  function noteName(pc, flats) { return (flats ? FLAT : SHARP)[((pc % 12) + 12) % 12]; }
  function midiName(midi, flats) { return noteName(midi, flats) + (Math.floor(midi / 12) - 1); }

  const LOW = 50, HIGH = 76; // right-hand range D3..E5

  /* All candidate rootless voicings (A and B forms, every octave that fits). */
  function candidates(chord) {
    const out = [];
    for (const form of ['A', 'B']) {
      for (let base = 36; base <= 72; base += 12) {
        const notes = chord[form].map(i => base + chord.root + i);
        if (notes[0] >= LOW && notes[notes.length - 1] <= HIGH) out.push({ form, notes });
      }
    }
    return out;
  }

  function distance(a, b) {
    let d = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) d += Math.abs(a[i] - b[i]); return d;
  }

  /* Voice the whole progression: each chord takes the candidate closest to the previous one. */
  function voiceProgression(symbols) {
    let prev = null;
    return symbols.map(sym => {
      const chord = parseChord(sym);
      const cands = candidates(chord);
      if (!cands.length) throw new Error('Pas de voicing pour ' + sym);
      const pick = prev ? cands.reduce((best, c) => distance(c.notes, prev) < distance(best.notes, prev) ? c : best)
                        : cands.reduce((best, c) => Math.abs(c.notes[0] - 60) < Math.abs(best.notes[0] - 60) ? c : best);
      prev = pick.notes;
      const bass = 36 + chord.root + (chord.root > 7 ? -12 : 0); // left hand root, E1..G2 area
      return { chord, form: pick.form, right: pick.notes, bass };
    });
  }

  /* Reharmonisation ideas for one chord, given the next chord. */
  function substitutions(sym, nextSym) {
    const c = parseChord(sym), ideas = [];
    const isDom = ['7', '9', '13', '7b9', '7alt'].includes(c.quality);
    if (isDom) {
      const tt = (c.root + 6) % 12;
      ideas.push({ name: 'Substitution tritonique', chords: [noteName(tt, true) + '7'],
        why: `${noteName(tt, true)}7 partage le triton (3ce et 7e) de ${sym} : la basse descend par demi-ton vers la résolution.` });
      ideas.push({ name: 'Dominante altérée', chords: [c.rootName + '7alt'],
        why: 'Ajoute b9, #9, b13 : plus de tension avant la résolution.' });
      const ii = (c.root + 7) % 12;
      ideas.push({ name: 'II-V', chords: [noteName(ii, c.flats) + 'm7', sym],
        why: `Précéder ${sym} de son II mineur (${noteName(ii, c.flats)}m7) crée un mouvement II-V.` });
    }
    if (nextSym) {
      const n = parseChord(nextSym);
      if (!isDom && ['maj7', 'maj9', '6', 'm7', 'm9', 'm6', 'mMaj7', 'm', 'maj'].includes(n.quality)) {
        const v = (n.root + 7) % 12;
        ideas.push({ name: 'Dominante secondaire', chords: [sym, noteName(v, n.flats) + '7'],
          why: `Insérer ${noteName(v, n.flats)}7, la dominante de ${nextSym}, pour mieux l'annoncer.` });
      }
      if ((n.root - c.root + 12) % 12 === 2) {
        ideas.push({ name: 'Diminué de passage', chords: [sym, noteName(c.root + 1, c.flats) + 'dim7'],
          why: `Un ${noteName(c.root + 1, c.flats)}dim7 relie ${sym} à ${nextSym} par une basse chromatique.` });
      }
    }
    if (['maj7', 'maj', '6'].includes(c.quality)) {
      ideas.push({ name: 'Couleur', chords: [c.rootName + 'maj9', c.rootName + '6'], why: 'Même fonction, autre couleur : 9e ou 6te.' });
    }
    return ideas;
  }

  const PRESETS = {
    'II-V-I majeur (do)': ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'],
    'II-V-I mineur (la)': ['Bm7b5', 'E7b9', 'Am7', 'Am7'],
    'Cycle de quintes (style Autumn Leaves)': ['Cm7', 'F7', 'Bbmaj7', 'Ebmaj7', 'Am7b5', 'D7b9', 'Gm7', 'Gm7'],
    'Blues jazz en fa': ['F7', 'Bb7', 'F7', 'Cm7', 'F7', 'Bb7', 'Bdim7', 'F7', 'D7alt', 'Gm7', 'C7', 'F7', 'D7', 'Gm7', 'C7'],
    'Rhythm changes (A)': ['Bbmaj7', 'G7', 'Cm7', 'F7', 'Dm7', 'G7', 'Cm7', 'F7'],
  };

  const api = { parseChord, noteName, midiName, candidates, voiceProgression, substitutions, PRESETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Theory = api;
})(this);
