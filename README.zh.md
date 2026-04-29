# annal

Annal 是一个轻量级的 JavaScript 日志记录库，没有任何依赖，仅 3 KB 大小。

使用其他语言阅读：[English](./README.md) | 简体中文

## 安装

> [!IMPORTANT]
> Annal 是一个纯 ESM 包，如果在项目中使用时遇到困难，可以 [查看这里](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)。

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

或者

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

你也可以根据自己的喜好使用其他 CDN，例如 [jsDelivr](https://www.jsdelivr.com/) 和 [UNPKG](https://unpkg.com/) 等。

## 快速上手

```javascript
import { journal } from 'annal';

journal.info('hello world');
```

```shell
[1970-01-01T00:00:00.000Z] INFO - hello world
```

Annal 会根据记录的等级（level），自动选择对应的底层 `console` 方法（`debug` / `info` / `warn` / `error`）进行调用。传入的参数会被原样转发，如果包含数组或对象，它们将由当前使用的 JavaScript 运行时（runtime）自动格式化。

由于参数直接转发至 `console`，因此也支持使用 [字符串替换](https://developer.mozilla.org/zh-CN/docs/Web/API/console#%E4%BD%BF%E7%94%A8%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%9B%BF%E6%8D%A2)：

```javascript
import { journal } from 'annal';

journal.info('hello %s', 'world');
```

## API

`Journal` 实例提供四个内置等级方法、一个通用 `log` 方法：

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
// 自定义日志记录
journal.log(LevelInfo + 2, 'notice');
```

| 方法                  | 说明                                         |
| --------------------- | -------------------------------------------- |
| `debug(...args)`      | 以 `LevelDebug` 输出，派发到 `console.debug` |
| `info(...args)`       | 以 `LevelInfo` 输出，派发到 `console.info`   |
| `warn(...args)`       | 以 `LevelWarn` 输出，派发到 `console.warn`   |
| `error(...args)`      | 以 `LevelError` 输出，派发到 `console.error` |
| `log(level, ...args)` | 用于输出自定义等级记录                       |

此外，实例还提供了一个派生方法：

- `withScope(name, options?)`：派生子作用域实例，多个作用域名之间以 `:` 拼接，可选地覆盖最低输出等级。

低于实例最低输出等级的记录会被静默丢弃。

## 创建实例

你可以使用 `createJournal` 工厂函数或 `Journal` 类来构造新实例：

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

这两种方式完全等价。`Journal` 实例是不可变的，使用 `withScope` 派生子作用域实例时，原实例不受影响：

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

## 等级（Levels）

Annal 日志级别参照了 Go 的 [`log/slog`](https://pkg.go.dev/log/slog#Level) 设计，采用整数表示等级，而不是 `log4js` 风格的字符串枚举。

```typescript
type Level = number;

const LevelDebug: Level = -4;
const LevelInfo: Level = 0;
const LevelWarn: Level = 4;
const LevelError: Level = 8;
```

`Level` 本质上就是一个整数，数值越大表示严重程度越高。除了上述四个内置常量，任意整数都可以作为等级使用，因此等级体系完全由开发者自行定义：

```javascript
import { createJournal, LevelDebug, LevelError } from 'annal';

const LevelTrace = LevelDebug - 4;
const LevelFatal = LevelError + 4;

const logger = createJournal({ level: LevelTrace });

logger.log(LevelTrace, 'hello world');
logger.log(LevelFatal, 'goodbye universe');
```

当使用**自定义等级**时，标签会以偏移量的形式渲染，与 slog 的表现完全一致：

```shell
[1970-01-01T00:00:00.000Z] DEBUG-4 - hello world
[9999-12-31T23:59:59.999Z] ERROR+4 - goodbye universe
```

### 自定义静音等级

传统 JavaScript 日志库通常内置 `silent` 等级，Annal 没有内置。静音本质上就是将最低输出等级调到足够高，使其丢弃所有记录，引入新的等级会破坏原有架构设计。如果你需要，推荐按下面的方式自行定义：

```javascript
import { createJournal, LevelDebug } from 'annal';

const LevelSilent = Number.POSITIVE_INFINITY;

const app = createJournal();
const db = app.withScope('db', {
  level: import.meta.env.DEV ? LevelDebug : LevelSilent,
});

// 仅在开发环境下输出
db.error('connection lost');
```

## 配置项

```typescript
type Level = number;

interface JournalOptions {
  // 最低输出等级，默认 LevelInfo (0)
  level?: Level;
  // 作用域前缀，默认 ''（无前缀）
  scope?: string;
}
```
