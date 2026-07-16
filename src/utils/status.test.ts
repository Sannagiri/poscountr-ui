import { describe, expect, it } from 'vitest';

import { statusLabel, toneForStatus } from './status';

describe('toneForStatus', () => {
  it('maps known backend statuses to the correct badge tone', () => {
    expect(toneForStatus('completed')).toBe('success');
    expect(toneForStatus('cancelled')).toBe('danger');
    expect(toneForStatus('pending')).toBe('warning');
  });

  it('falls back to neutral for an unrecognized status', () => {
    expect(toneForStatus('some_unknown_status')).toBe('neutral');
  });
});

describe('statusLabel', () => {
  it('converts a snake_case backend status into a human label', () => {
    expect(statusLabel('kot_fired')).toBe('Kot fired');
    expect(statusLabel('pending')).toBe('Pending');
  });
});
