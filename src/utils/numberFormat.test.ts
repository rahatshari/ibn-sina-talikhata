import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NUMERAL_MODE,
  formatDigits,
  formatNumberValue,
  saveNumeralMode,
  toBengaliDigits,
  toEnglishDigits,
} from './numberFormat';

test('toBengaliDigits and toEnglishDigits convert digits accurately', () => {
  assert.equal(toBengaliDigits('৳1,250.50'), '৳১,২৫০.৫০');
  assert.equal(toEnglishDigits('২৩ নভে, ২০২৬'), '23 নভে, 2026');
  assert.equal(formatDigits('55 টি', 'bn'), '৫৫ টি');
  assert.equal(formatDigits('৫৫ টি', 'en'), '55 টি');
});

test('formatNumberValue respects Bengali and English numeral modes', () => {
  assert.equal(formatNumberValue(1480, { mode: 'en' }), '1,480');
  assert.equal(formatNumberValue(1480, { mode: 'bn' }), '১,৪৮০');
  assert.equal(
    formatNumberValue(12.5, { mode: 'bn', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    '১২.৫০',
  );
});

test('saveNumeralMode updates active mode safely', () => {
  assert.equal(DEFAULT_NUMERAL_MODE, 'en');
  assert.equal(saveNumeralMode('bn'), 'bn');
  assert.equal(formatNumberValue(42), '৪২');
  assert.equal(saveNumeralMode('en'), 'en');
  assert.equal(formatNumberValue(42), '42');
});
