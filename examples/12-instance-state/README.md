# 12 - InstanceState.make() 模式（ScopedCache 实战）

## 功能描述

演示使用 `ScopedCache` 实现 **InstanceState** 模式：每个 key（实例 ID）对应一份独立的缓存状态，按需初始化、自动缓存、可手动失效。类似 opencode 中 `InstanceState.make()` 的设计思路。

## 运行

```bash
bun run examples/12-instance-state/index.ts
```

## InstanceState.make() 详解

### 代码结构

```typescript
// 1. 定义接口：get / invalidate / invalidateAll
interface InstanceState<A, E, R> {
  readonly get: (key: string) => Effect.Effect<A, E, R | Scope.Scope>
  readonly invalidate: (key: string) => Effect.Effect<void>
  readonly invalidateAll: Effect.Effect<void>
}

// 2. 实现 make：内部持有 ScopedCache
const make = <A, E, R>(
  init: (key: string) => Effect.Effect<A, E, R | Scope.Scope>,
): Effect.Effect<InstanceState<A, E, R>, never, R | Scope.Scope> =>
  Effect.gen(function* () {
    const cache = yield* ScopedCache.make({
      capacity: Number.POSITIVE_INFINITY, // 不限制缓存条目
      timeToLive: "1 minute",            // 1 分钟自动过期
      lookup: (key) => init(key),        // 缓存未命中时调用
    })
    return {
      get: (key) => cache.get(key),
      invalidate: (key) => cache.invalidate(key),
      get invalidateAll() { return cache.invalidateAll },
    }
  })

// 3. 使用
const MyState = make((key) =>
  Effect.gen(function* () {
    // 每个 key 只初始化一次（直到失效）
    return { key, createdAt: new Date() }
  }),
)
```

### 关键 API

| 方法 | 说明 |
|------|------|
| `ScopedCache.make(options)` | 创建带 scope 管理的缓存 |
| `cache.get(key)` | 获取值（缓存命中直接返回，未命中调用 `lookup`） |
| `cache.invalidate(key)` | 失效指定 key，下次 get 重新 init |
| `cache.invalidateAll` | 失效所有 key |

### ScopedCache 与普通 Cache 的区别

| | `Cache` | `ScopedCache` |
|---|---|---|
| lookup 返回值 | `Effect<A, E, R>` | `Effect<A, E, R \| Scope.Scope>` |
| get 返回值 | `Effect<A, E, R>` | `Effect<A, E, R \| Scope.Scope>` |
| 资源管理 | 无 | 自动管理资源的 acquire/release |
| 适用于 | 纯计算缓存 | 需要生命周期管理的资源（连接、文件句柄等） |

## 运行输出示例

```
--- 1. First access (triggers init) ---
  [init] Creating state for "project-alpha" (init #1)
  alpha: project-alpha, counter=1, ...

--- 2. Second access (cache hit) ---
  alpha: project-alpha, counter=1, ...  (Same instance? true)

--- 3. Different key (triggers new init) ---
  [init] Creating state for "project-beta" (init #2)
  beta: project-beta, counter=2

--- 4. After invalidate (re-inits) ---
  [init] Creating state for "project-alpha" (init #3)
  alpha: project-alpha, counter=3, ...
```

## 与 opencode InstanceState 的对应

| opencode 源码 | 本示例 |
|---|---|
| `packages/opencode/src/effect/instance-state.ts` | 简化版实现 |
| `ScopedCache.make({ capacity: Infinity, lookup })` | `ScopedCache.make({ capacity: Infinity, timeToLive, lookup })` |
| `registerDisposer` 自动失效 | 手动 `invalidate` |
| `get(key)` / `invalidate(key)` | 一致的 API |
