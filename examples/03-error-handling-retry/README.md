# 03 - Error Handling & Retry (错误处理与重试策略)

## 功能描述

演示 Effect 的完整错误处理体系：typed errors、分层捕获、重试策略、Exit/Cause 内部状态检查。opencode 中使用这些模式实现文件锁重试（effect-flock.ts）和 LLM 调用退避（session/retry.ts）。

## 运行

```bash
bun run examples/03-error-handling-retry/index.ts
```

## 关键代码分析

### 1. 捕获同步异常

```typescript
const flakyApi = Effect.try({
  try: () => { /* 可能 throw */ },
  catch: (error) => error as NetworkError | RateLimitError,
})
```

`Effect.try` 把 throw 转为 typed error，避免变成 defect。

### 2. 重试策略

```typescript
const retryPolicy = pipe(
  Schedule.exponential("100 millis", 2.0),
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(5)),
)
```

组合策略：指数退避 → 增加抖动 → 限制最大重试次数。

### 3. 分层错误处理

```typescript
Effect.catchTag("ValidationError", (err) => { /* 处理验证错误 */ })
Effect.catchTag("NotFoundError", (err) => { /* 处理未找到 */ })
```

`catchTag` 提供精确的错误匹配，按类型分层次处理。

### 4. Exit 检查

```typescript
const exit = yield* Effect.exit(effect)
if (Exit.isSuccess(exit)) { /* 成功 */ }
```

`Effect.exit` 将结果包装为 Exit，可检查 Effect 的最终状态（成功/失败/中断）。

### 5. 超时

```typescript
Effect.timeout("50 millis")
Effect.catchAll((error) => /* 处理超时 */)
```

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `Effect.try` | `packages/effect/src/effect.ts` | 捕获同步异常 |
| `Effect.retry` | `packages/effect/src/effect.ts` | 重试机制 |
| `Effect.catchTag` | `packages/effect/src/effect.ts` | 按 tag 匹配错误 |
| `Effect.catchAll` | `packages/effect/src/effect.ts` | 捕获所有错误 |
| `Effect.exit` | `packages/effect/src/effect.ts` | 获取 Exit 结果 |
| `Exit.isSuccess/isFailure` | `packages/effect/src/exit.ts` | Exit 类型判断 |
| `Effect.timeout` | `packages/effect/src/effect.ts` | 超时控制 |
| `Schedule.exponential` | `packages/effect/src/schedule.ts` | 指数退避 |
| `Schedule.jittered` | `packages/effect/src/schedule.ts` | 随机抖动 |
| `Schedule.recurs` | `packages/effect/src/schedule.ts` | 最大重试次数 |

## 调试指导

1. 断点建议：
   - `Effect.retry(retryPolicy)` —— 观察重试循环
   - `Schedule.exponential` 内部 —— 观察延时计算
   - `Effect.catchTag` —— 观察错误路由

2. 注意：包含 `Effect.sleep` 的 async Effect 不能用 `runSync`，必须用 `runPromise`

3. Step Into `Effect.retry` 可以观察 Effect 运行时如何自动处理重试
