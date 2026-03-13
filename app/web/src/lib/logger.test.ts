import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  debugLog,
  isVerboseLoggingEnabled,
  setVerboseLoggingEnabled,
  warnLog,
} from './logger';

describe('logger', () => {
  afterEach(() => {
    setVerboseLoggingEnabled(false);
    vi.restoreAllMocks();
  });

  it('does not emit debug logs when verbose flag is disabled', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    setVerboseLoggingEnabled(false);
    debugLog('alert-editor', 'hidden debug');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(isVerboseLoggingEnabled()).toBe(false);
  });

  it('emits debug logs when verbose flag is enabled', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    setVerboseLoggingEnabled(true);
    debugLog('alert-editor', 'visible debug', { alertId: 'a-1' });

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0][0]).toContain('[alert-editor] visible debug');
    expect(isVerboseLoggingEnabled()).toBe(true);
  });

  it('warnLog emits regardless of verbose flag', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    setVerboseLoggingEnabled(false);
    warnLog('firebase', 'always visible warning');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[firebase] always visible warning');
  });
});
