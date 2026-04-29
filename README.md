# annal

Annal is a lightweight logger library for JavaScript, with no dependencies and only 3 KB in size.

Read this in other languages: English | [简体中文](./README.zh.md)

## Installation

> [!IMPORTANT]
> Annal is a pure ESM package, if you run into trouble using it in your project, see [this guide](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c).

### NPM

```shell
npm install annal
```

### CDN

```html
<script type="module">
  import { journal } from 'https://esm.sh/annal';
</script>
```

or

```html
<script type="importmap">
  {
    "imports": {
      "annal": "https://esm.sh/annal"
    }
  }
</script>
<script type="module">
  import { journal } from 'annal';
</script>
```

You may also use other CDNs of your choice, such as [jsDelivr](https://www.jsdelivr.com/) and [UNPKG](https://unpkg.com/).

## Quick start

```javascript
import { journal } from 'annal';

journal.info('hello world');
```

```shell
[1970-01-01T00:00:00.000Z] INFO - hello world
```

Annal selects the matching underlying `console` method (`debug` / `info` / `warn` / `error`) based on the record's level. Arguments are forwarded as-is, and if they include arrays or objects, they are automatically formatted by the JavaScript runtime in use.

Since arguments are forwarded directly to `console`, [string substitution](https://developer.mozilla.org/en-US/docs/Web/API/console#using_string_substitutions) is also available:

```javascript
import { journal } from 'annal';

journal.info('hello %s', 'world');
```

## API

A `Journal` instance exposes four built-in level methods and a generic `log` method:

```javascript
import { journal, LevelInfo } from 'annal';

// → console.debug
journal.debug('detailed trace');
// → console.info
journal.info('hello');
// → console.warn
journal.warn('slow query');
// → console.error
journal.error('connection lost');
// custom log record
journal.log(LevelInfo + 2, 'notice');
```

| Method                | Description                                         |
| --------------------- | --------------------------------------------------- |
| `debug(...args)`      | Emit at `LevelDebug`, dispatched to `console.debug` |
| `info(...args)`       | Emit at `LevelInfo`, dispatched to `console.info`   |
| `warn(...args)`       | Emit at `LevelWarn`, dispatched to `console.warn`   |
| `error(...args)`      | Emit at `LevelError`, dispatched to `console.error` |
| `log(level, ...args)` | Used for emitting records at custom levels          |

In addition, instances expose one derivation method:

- `withScope(name, options?)`: Derive a sub-scope instance. Scope names are joined with `:`, and the minimum level may be optionally overridden.

Records below an instance's minimum level are silently discarded.

## Creating instances

You may use the `createJournal` factory or the `Journal` class to construct a new instance:

```javascript
import { createJournal, LevelInfo } from 'annal';

const logger = createJournal({ scope: 'app', level: LevelInfo });
logger.info('hello world');
```

```javascript
import { createJournal, Journal, LevelInfo } from 'annal';

const logger = new Journal({ scope: 'app', level: LevelInfo });
logger.info('hello world');
```

```shell
[1970-01-01T00:00:00.000Z] INFO app - hello world
```

The two forms are completely equivalent. `Journal` instances are immutable, and using `withScope` to derive a sub-scope instance leaves the original untouched:

```javascript
import { createJournal } from 'annal';

const app = createJournal({ scope: 'app' });
// scope => 'app:db'
const db = app.withScope('db');
// scope => 'app:db:sql'
const sql = db.withScope('sql');

db.error('connection lost');
sql.warn('slow query');
```

## Levels

Annal's level model follows Go's [`log/slog`](https://pkg.go.dev/log/slog#Level), using integers rather than a `log4js`-style string enum.

```typescript
type Level = number;

const LevelDebug: Level = -4;
const LevelInfo: Level = 0;
const LevelWarn: Level = 4;
const LevelError: Level = 8;
```

A `Level` is simply an integer: the larger the value, the more severe the event. Beyond the four built-in constants, any integer is a valid level, so the level scheme is entirely up to the consumer:

```javascript
import { createJournal, LevelDebug, LevelError } from 'annal';

const LevelTrace = LevelDebug - 4;
const LevelFatal = LevelError + 4;

const logger = createJournal({ level: LevelTrace });

logger.log(LevelTrace, 'hello world');
logger.log(LevelFatal, 'goodbye universe');
```

When using a **custom level**, the label is rendered with an offset, matching `slog`:

```shell
[1970-01-01T00:00:00.000Z] DEBUG-4 - hello world
[9999-12-31T23:59:59.999Z] ERROR+4 - goodbye universe
```

### Custom silent level

Traditional JavaScript logging libraries typically include a built-in `silent` level, but Annal does not. Silencing is essentially raising the minimum level high enough to discard all records; introducing a new level would break the existing design. If you need one, define it yourself:

```javascript
import { createJournal, LevelDebug } from 'annal';

const LevelSilent = Number.POSITIVE_INFINITY;

const app = createJournal();
const db = app.withScope('db', {
  level: import.meta.env.DEV ? LevelDebug : LevelSilent,
});

// only emitted in development
db.error('connection lost');
```

## Config

```typescript
type Level = number;

interface JournalOptions {
  // minimum level, default LevelInfo (0)
  level?: Level;
  // scope prefix, default '' (no prefix)
  scope?: string;
}
```
