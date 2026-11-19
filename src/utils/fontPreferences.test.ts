import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_FONT_OPTIONS,
  DEFAULT_FONT_ID,
  getFontOption,
  loadSavedFontId,
} from './fontPreferences';

test('default app font is the second option (noto-sans)', () => {
  assert.equal(APP_FONT_OPTIONS[1]?.id, 'noto-sans');
  assert.equal(DEFAULT_FONT_ID, 'noto-sans');
  assert.equal(loadSavedFontId(), 'noto-sans');
  assert.equal(getFontOption(DEFAULT_FONT_ID).label, 'নোটো সানস');
});
