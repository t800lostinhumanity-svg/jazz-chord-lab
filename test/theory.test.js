const test = require('node:test');
const assert = require('node:assert');
const T = require('../theory.js');

test('parses common jazz symbols', () => {
  const cases = { Cmaj7: [0, 'maj7'], 'Dm7': [2, 'm7'], G7: [7, '7'], 'Bm7b5': [11, 'm7b5'], 'Bbmaj7': [10, 'maj7'],
    'F#ø': [6, 'm7b5'], 'Ebdim7': [3, 'dim7'], 'E7b9': [4, '7b9'], 'D7alt': [2, '7alt'], 'C-7': [0, 'm7'], 'A': [9, 'maj'] };
  for (const [s, [root, q]] of Object.entries(cases)) {
    const c = T.parseChord(s);
    assert.deepStrictEqual([c.root, c.quality], [root, q], s);
  }
  assert.throws(() => T.parseChord('H7'));
  assert.throws(() => T.parseChord('Cxyz'));
});

test('rootless voicings contain the guide tones (3rd and 7th)', () => {
  for (const sym of ['Dm7', 'G7', 'Cmaj7', 'Bm7b5', 'E7b9', 'F7', 'Bbmaj7']) {
    const c = T.parseChord(sym);
    const third = (c.root + c.tones[1]) % 12, seventh = (c.root + c.tones[3]) % 12;
    for (const cand of T.candidates(c)) {
      const pcs = cand.notes.map(n => n % 12);
      assert.ok(pcs.includes(third) && pcs.includes(seventh), `${sym} ${cand.form}`);
    }
  }
});

test('voice leading keeps the hand still on a II-V-I', () => {
  const v = T.voiceProgression(['Dm7', 'G7', 'Cmaj7']);
  for (let i = 1; i < v.length; i++) {
    const moved = v[i].right.reduce((s, n, k) => s + Math.abs(n - v[i - 1].right[k]), 0);
    assert.ok(moved <= 6, `too much movement: ${moved}`);
  }
  assert.notStrictEqual(v[0].form, v[1].form, 'II-V alternates A/B forms');
  for (const x of v) for (const n of x.right) assert.ok(n >= 50 && n <= 76);
});

test('every preset can be voiced', () => {
  for (const [name, chords] of Object.entries(T.PRESETS)) assert.strictEqual(T.voiceProgression(chords).length, chords.length, name);
});

test('tritone substitution of G7 is Db7', () => {
  const ideas = T.substitutions('G7', 'Cmaj7');
  assert.deepStrictEqual(ideas.find(i => i.name === 'Substitution tritonique').chords, ['Db7']);
});

test('secondary dominant and passing diminished', () => {
  const sec = T.substitutions('Cmaj7', 'Dm7').find(i => i.name === 'Dominante secondaire');
  assert.deepStrictEqual(sec.chords, ['Cmaj7', 'A7']);
  const dim = T.substitutions('Cmaj7', 'Dm7').find(i => i.name === 'Diminué de passage');
  assert.deepStrictEqual(dim.chords, ['Cmaj7', 'C#dim7']);
});
