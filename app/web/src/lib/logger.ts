export type LogScope =
  | 'firebase'
  | 'alerts'
  | 'market-data'
  | 'alert-editor'
  | 'remote-config';

let verboseLoggingEnabled = false;

export function setVerboseLoggingEnabled(enabled: boolean): void {
  verboseLoggingEnabled = enabled;
}

export function isVerboseLoggingEnabled(): boolean {
  return verboseLoggingEnabled;
}

function format(scope: LogScope, message: string): string {
  return `[${scope}] ${message}`;
}

export function debugLog(scope: LogScope, message: string, metadata?: unknown): void {
  if (!verboseLoggingEnabled) {
    return;
  }

  if (metadata === undefined) {
    console.debug(format(scope, message));
    return;
  }

  console.debug(format(scope, message), metadata);
}

export function warnLog(scope: LogScope, message: string, metadata?: unknown): void {
  if (metadata === undefined) {
    console.warn(format(scope, message));
    return;
  }

  console.warn(format(scope, message), metadata);
}

export function errorLog(scope: LogScope, message: string, metadata?: unknown): void {
  if (metadata === undefined) {
    console.error(format(scope, message));
    return;
  }

  console.error(format(scope, message), metadata);
}
