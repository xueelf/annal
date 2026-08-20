import { color } from 'bun' with { type: 'macro' };

/**
 * The importance or severity of a log event. The higher the value, the more
 * severe the event.
 *
 * Annal models levels after Go's `log/slog` package: a `Level` is just an
 * integer. The four named constants ({@link LevelDebug}, {@link LevelInfo},
 * {@link LevelWarn}, {@link LevelError}) are exported as a convenience, but
 * any integer is a valid level.
 *
 * @see https://pkg.go.dev/log/slog#Level
 */
export type Level = number;

/** The lowest predefined severity, intended for verbose diagnostic output. */
export const LevelDebug: Level = -4;

/**
 * The default severity, intended for routine informational messages.
 *
 * Equal to `0` so it serves as the zero value of the {@link Level} type.
 */
export const LevelInfo: Level = 0;

/** Higher than {@link LevelInfo}, intended for unexpected but recoverable conditions. */
export const LevelWarn: Level = 4;

/** The highest predefined severity, intended for failures that need attention. */
export const LevelError: Level = 8;

/**
 * Options accepted by {@link Journal} and {@link createJournal}.
 */
export interface JournalOptions {
  /**
   * Minimum level to emit. Records with a lower level are discarded.
   *
   * @defaultValue {@link LevelInfo}
   */
  level?: Level;
  /**
   * Scope name prepended to every record. An empty string means no prefix.
   *
   * @defaultValue `''`
   */
  scope?: string;
}

/**
 * Format a level into the slog `Level.String()` form.
 *
 * - Exact constant match returns the bare name: `LevelInfo` -> `"INFO"`.
 * - Any offset is suffixed with the signed delta:
 *   `LevelInfo + 2` -> `"INFO+2"`, `LevelDebug - 1` -> `"DEBUG-1"`.
 */
function levelLabel(level: Level): string {
  let base: string;
  let offset: number;

  if (level < LevelInfo) {
    base = 'DEBUG';
    offset = level - LevelDebug;
  } else if (level < LevelWarn) {
    base = 'INFO';
    offset = level - LevelInfo;
  } else if (level < LevelError) {
    base = 'WARN';
    offset = level - LevelWarn;
  } else {
    base = 'ERROR';
    offset = level - LevelError;
  }
  if (offset === 0) {
    return base;
  }
  return `${base}${offset > 0 ? '+' : ''}${offset}`;
}

const ANSI_RESET = '\u001b[0m';
const ANSI_DEBUG = color('cyan', 'ansi') ?? '';
const ANSI_INFO = color('green', 'ansi') ?? '';
const ANSI_WARN = color('orange', 'ansi') ?? '';
const ANSI_ERROR = color('red', 'ansi') ?? '';

function ansiOf(level: Level): string {
  if (level >= LevelError) {
    return ANSI_ERROR;
  }
  if (level >= LevelWarn) {
    return ANSI_WARN;
  }
  if (level >= LevelInfo) {
    return ANSI_INFO;
  }
  return ANSI_DEBUG;
}

function cssOf(level: Level): string {
  if (level >= LevelError) {
    return 'color:#ef4444;font-weight:bold';
  }
  if (level >= LevelWarn) {
    return 'color:#f59e0b;font-weight:bold';
  }
  if (level >= LevelInfo) {
    return 'color:#10b981;font-weight:bold';
  }
  return 'color:#06b6d4;font-weight:bold';
}

function printerFor(level: Level): (...args: unknown[]) => void {
  if (level >= LevelError) {
    return console.error;
  }
  if (level >= LevelWarn) {
    return console.warn;
  }
  if (level >= LevelInfo) {
    return console.info;
  }
  return console.debug;
}

type Writer = (level: Level, scope: string, args: unknown[]) => void;

function buildPrefix(level: Level, scope: string): string {
  const timestamp = new Date().toISOString();
  const label = levelLabel(level);
  const tail = scope ? `${scope} -` : '-';

  return `[${timestamp}] ${label} ${tail}`;
}

function writeWithPrefix(
  level: Level,
  prefix: string,
  args: unknown[],
  style?: string,
): void {
  const printer = printerFor(level);
  const [first, ...rest] = args;

  if (style !== undefined) {
    if (typeof first === 'string') {
      printer(`%c%s%c ${first}`, style, prefix, '', ...rest);
      return;
    }
    printer('%c%s%c', style, prefix, '', ...args);
    return;
  }
  if (typeof first === 'string') {
    if (rest.length === 0) {
      printer(`${prefix} ${first}`);
      return;
    }
    printer(`%s ${first}`, prefix, ...rest);
    return;
  }
  printer('%s', prefix, ...args);
}

const ansiWriter: Writer = (level, scope, args) => {
  const ansi = ansiOf(level);
  const prefix = buildPrefix(level, scope);
  writeWithPrefix(level, ansi ? `${ansi}${prefix}${ANSI_RESET}` : prefix, args);
};

const cssWriter: Writer = (level, scope, args) => {
  writeWithPrefix(level, buildPrefix(level, scope), args, cssOf(level));
};

const plainWriter: Writer = (level, scope, args) => {
  writeWithPrefix(level, buildPrefix(level, scope), args);
};

const writer: Writer = (() => {
  const global = globalThis as {
    document?: unknown;
    process?: { stdout?: unknown };
  };

  if (typeof global.document !== 'undefined') {
    return cssWriter;
  }
  if (typeof global.process !== 'undefined' && global.process.stdout) {
    return ansiWriter;
  }
  return plainWriter;
})();

/**
 * An immutable logger that emits records to the host platform's console.
 *
 * Each instance carries its own {@link level} threshold and {@link scope}
 * prefix. To derive a related instance, use {@link Journal.withScope} —
 * it returns a new `Journal` and leaves the original unchanged.
 *
 * @example
 * ```typescript
 * import { Journal, LevelDebug } from 'annal';
 *
 * const logger = new Journal({ scope: 'app', level: LevelDebug });
 * logger.debug('starting up');
 * logger.info('listening on :3000');
 * ```
 */
export class Journal {
  /** The minimum level this instance emits. */
  public readonly level: Level;

  /** The scope name prepended to every record emitted by this instance. */
  public readonly scope: string;

  /**
   * @param options - Initial level and scope. Both fields are optional.
   */
  constructor(options: JournalOptions = {}) {
    this.level = options.level ?? LevelInfo;
    this.scope = options.scope ?? '';
  }

  /**
   * Emit a record at the given level. Records below {@link Journal.level}
   * are silently discarded.
   *
   * Use this method to emit at custom levels created by offsetting one of the
   * named constants.
   *
   * @param level - The severity of the record.
   * @param args - Values to log, forwarded to the underlying `console` call.
   *
   * @example
   * ```typescript
   * import { createJournal, LevelInfo } from 'annal';
   *
   * const LevelNotice = LevelInfo + 2;
   * const logger = createJournal();
   * logger.log(LevelNotice, 'cache warmed');
   * ```
   */
  public log(level: Level, ...args: unknown[]): void {
    if (level < this.level) {
      return;
    }
    writer(level, this.scope, args);
  }

  /** Emit a record at {@link LevelDebug}. */
  public debug(...args: unknown[]): void {
    this.log(LevelDebug, ...args);
  }

  /** Emit a record at {@link LevelInfo}. */
  public info(...args: unknown[]): void {
    this.log(LevelInfo, ...args);
  }

  /** Emit a record at {@link LevelWarn}. */
  public warn(...args: unknown[]): void {
    this.log(LevelWarn, ...args);
  }

  /** Emit a record at {@link LevelError}. */
  public error(...args: unknown[]): void {
    this.log(LevelError, ...args);
  }

  /**
   * Return a new {@link Journal} that nests `name` beneath the current
   * {@link Journal.scope}. Names are joined with `:`. Passing an empty string
   * returns the current instance unchanged.
   *
   * The optional second argument overrides the derived instance's
   * {@link Journal.level}; when omitted, the parent level is inherited.
   *
   * @example
   * ```typescript
   * import { createJournal, LevelDebug } from 'annal';
   *
   * const app = createJournal({ scope: 'app' });
   * const db = app.withScope('db'); // scope => 'app:db'
   * db.error('connection lost');
   *
   * // Per-scope level override:
   * const verbose = app.withScope('debug', { level: LevelDebug });
   * verbose.debug('payload', { id: 1 });
   * ```
   */
  public withScope(
    name: string,
    options: Omit<JournalOptions, 'scope'> = {},
  ): Journal {
    if (!name) {
      return this;
    }
    const scope = this.scope ? `${this.scope}:${name}` : name;

    return new Journal({
      level: options.level ?? this.level,
      scope,
    });
  }
}

/**
 * Create a new {@link Journal} instance.
 *
 * @param options - Initial level and scope. Both fields are optional.
 *
 * @example
 * ```typescript
 * import { createJournal } from 'annal';
 *
 * const logger = createJournal({ scope: 'app' });
 * logger.info('hello world');
 * ```
 */
export function createJournal(options: JournalOptions = {}): Journal {
  return new Journal(options);
}

/**
 * A ready-to-use {@link Journal} instance with default options.
 *
 * @example
 * ```typescript
 * import { journal } from 'annal';
 *
 * journal.info('hello world');
 * ```
 */
export const journal: Journal = new Journal();
