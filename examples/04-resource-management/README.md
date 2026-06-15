# 04 - Resource Management (资源管理)

## 功能描述

演示 Effect 的资源管理机制：`acquireRelease`（获取-使用-释放）、`scoped`（作用域管理）、`ensuring`（保证清理）。opencode 中用于管理数据库连接、文件句柄、临时目录、PTY 会话等资源。

## 运行

```bash
bun run examples/04-resource-management/index.ts
```

## 关键代码分析

### 1. acquireRelease + scoped

```typescript
Effect.acquireRelease(openFile(path), (handle) => handle.close())
  .pipe(Effect.flatMap((handle) => handle.write("Hello")), Effect.scoped)
```

`acquireRelease` 保证资源无论使用成功或失败都会被释放。`scoped` 限定资源生命周期。

### 2. ensuring (保证执行)

```typescript
Effect.succeed("work").pipe(
  Effect.ensuring(Console.log("cleanup")),
)
```

类似 `try/finally`，无论成功或失败都执行清理逻辑。

### 3. 嵌套资源

```typescript
Effect.acquireRelease(file, (f) => f.close()).pipe(
  Effect.flatMap((file) =>
    Effect.acquireRelease(db, (d) => d.disconnect()).pipe(
      Effect.flatMap((db) => /* 使用 file 和 db */),
      Effect.scoped,
    ),
  ),
  Effect.scoped,
)
```

嵌套资源的内层释放先于外层。

### 4. 并发资源

多个资源可以各自在独立的作用域中管理，互不干扰。

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `Effect.acquireRelease` | `packages/effect/src/effect.ts` | 资源获取与释放 |
| `Effect.scoped` | `packages/effect/src/effect.ts` | 作用域限定 |
| `Effect.ensuring` | `packages/effect/src/effect.ts` | 最终保证执行 |
| `Scope` | `packages/effect/src/scope.ts` | 作用域管理 |

## 调试指导

1. 断点建议：
   - `Effect.acquireRelease(acquire, release)` 的回调 —— 观察资源生命周期
   - `release` 回调 —— 确认释放时机
   - `Effect.scoped` 作用域边界

2. 观察 `acquireRelease` 内部如何确保即使 Effect 失败也会调用 `release`

3. Step Into `Effect.acquireRelease` 可以看到 Finalizer 的注册和执行机制
