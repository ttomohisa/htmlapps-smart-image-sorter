import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const assets = new URL('../assets/', import.meta.url);
test('canonical default screenshot preserves the Japanese screenshot bytes', () => {
  const canonical = fs.readFileSync(new URL('screenshot.png', assets));
  const japanese = fs.readFileSync(new URL('screenshot-ja.png', assets));
  assert.deepEqual(canonical, japanese);
  assert.deepEqual(canonical.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.ok(canonical.readUInt32BE(16) > 0);
  assert.ok(canonical.readUInt32BE(20) > 0);
});
