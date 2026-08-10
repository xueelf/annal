import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';

import {
  type Level,
  createJournal,
  Journal,
  journal,
  LevelDebug,
  LevelError,
  LevelInfo,
  LevelWarn,
} from '../src/index.ts';

// Strip ANSI escape sequences so assertions remain platform-agnostic.
const ANSI_ESCAPE = new RegExp(String.fromCharCode(0x1b) + '\\[[0-9;]*m', 'g');
function stripAnsi(value: unknown): string {
  return String(value).replace(ANSI_ESCAPE, '');
}

interface CapturedRecord {
  method: 'debug' | 'info' | 'warn' | 'error';
  args: unknown[];
}

let records: CapturedRecord[] = [];
let restoreSpies: () => void = () => {};

beforeEach(() => {
  records = [];
  const mockFor = (method: CapturedRecord['method']) =>
    mock((...args: unknown[]) => {
      records.push({ method, args });
    });

  const debug = spyOn(console, 'debug').mockImplementation(mockFor('debug'));
  const info = spyOn(console, 'info').mockImplementation(mockFor('info'));
  const warn = spyOn(console, 'warn').mockImplementation(mockFor('warn'));
  const error = spyOn(console, 'error').mockImplementation(mockFor('error'));

  restoreSpies = () => {
    debug.mockRestore();
    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  };
});

afterEach(() => {
  restoreSpies();
});

const ISO_PATTERN = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;

function prefixOf(record: CapturedRecord): string {
  return stripAnsi(record.args[1]);
}

describe('Level constants', () => {
  test('match the slog numeric scheme', () => {
    expect(LevelDebug).toBe(-4);
    expect(LevelInfo).toBe(0);
    expect(LevelWarn).toBe(4);
    expect(LevelError).toBe(8);
  });
});

describe('Journal output', () => {
  test('default instance emits at info', () => {
    journal.info('hello');
    journal.debug('hidden');

    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record!.method).toBe('info');
    expect(record!.args[0]).toBe('%s hello');
    expect(prefixOf(record!)).toMatch(ISO_PATTERN);
    expect(prefixOf(record!)).toEndWith('INFO -');
  });

  test('preserves console format substitutions', () => {
    journal.info('hello %s', 'world');

    const [record] = records;
    expect(record!.args[0]).toBe('%s hello %s');
    expect(record!.args.slice(2)).toEqual(['world']);
  });

  test('scope is rendered between level and dash', () => {
    const log = createJournal({ scope: 'app' });
    log.warn('slow');

    const [record] = records;
    expect(record!.method).toBe('warn');
    expect(prefixOf(record!)).toEndWith('WARN app -');
  });

  test('prefix uses single spaces around the level label', () => {
    createJournal({ scope: 'svc' }).info('ping');
    const [record] = records;
    // Exactly: "[<iso>] INFO svc -"
    expect(prefixOf(record!)).toMatch(/^\[[^\]]+\] INFO svc -$/);
  });

  test('routes each level to the matching console method', () => {
    const log = createJournal({ level: LevelDebug });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(records.map(r => r.method)).toEqual([
      'debug',
      'info',
      'warn',
      'error',
    ]);
  });
});

describe('Level filtering', () => {
  test('records below threshold are discarded', () => {
    const log = createJournal({ level: LevelWarn });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(records.map(r => r.method)).toEqual(['warn', 'error']);
  });

  test('Number.POSITIVE_INFINITY silences every record', () => {
    const log = createJournal({ level: Number.POSITIVE_INFINITY });
    log.error('e');
    log.log(1e9, 'huge');

    expect(records).toHaveLength(0);
  });
});

describe('Custom levels', () => {
  test('renders an offset label between named values', () => {
    const log = createJournal();
    const custom: Level = LevelInfo + 2;
    log.log(custom, 'note');

    const [record] = records;
    expect(prefixOf(record!)).toEndWith('INFO+2 -');
  });

  test('renders a negative offset label', () => {
    const log = createJournal({ level: LevelDebug - 4 });
    log.log(LevelDebug - 4, 'trace');

    const [record] = records;
    expect(prefixOf(record!)).toEndWith('DEBUG-4 -');
  });
});

describe('Immutable derivation', () => {
  test('withScope nests names with a colon', () => {
    const app = createJournal({ scope: 'app' });
    const db = app.withScope('db');
    const sql = db.withScope('sql');

    expect(app.scope).toBe('app');
    expect(db.scope).toBe('app:db');
    expect(sql.scope).toBe('app:db:sql');
  });

  test('withScope with empty name returns the same instance', () => {
    const log = createJournal({ scope: 'app' });
    expect(log.withScope('')).toBe(log);
  });

  test('withScope on an empty scope does not start with a colon', () => {
    const root = createJournal();
    const child = root.withScope('auth');
    expect(child.scope).toBe('auth');
  });

  test('withScope preserves the parent level', () => {
    const log = createJournal({ scope: 'app', level: LevelWarn });
    const child = log.withScope('db');

    expect(child.level).toBe(LevelWarn);
    expect(child.scope).toBe('app:db');
  });

  test('withScope accepts an explicit level override', () => {
    const app = createJournal({ scope: 'app', level: LevelInfo });
    const verbose = app.withScope('db', { level: LevelDebug });

    expect(verbose.scope).toBe('app:db');
    expect(verbose.level).toBe(LevelDebug);
    // Parent untouched.
    expect(app.level).toBe(LevelInfo);

    verbose.debug('payload');
    expect(records).toHaveLength(1);
    expect(prefixOf(records[0]!)).toEndWith('DEBUG app:db -');
  });
});

describe('Construction', () => {
  test('createJournal and new Journal are equivalent', () => {
    const created = createJournal({ scope: 'x', level: LevelWarn });
    const constructed = new Journal({ scope: 'x', level: LevelWarn });

    expect(created.scope).toBe(constructed.scope);
    expect(created.level).toBe(constructed.level);
  });

  test('default options yield LevelInfo and an empty scope', () => {
    const log = createJournal();
    expect(log.level).toBe(LevelInfo);
    expect(log.scope).toBe('');
  });
});
