import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('smoke', () => {
  it('runs the test runner', () => {
    expect(1).toBe(1);
  });

  it('provides the fake browser', () => {
    expect(fakeBrowser.storage.local).toBeDefined();
  });
});
