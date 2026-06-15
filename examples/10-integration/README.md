# 10 - Integration Demo (综合示例)

## 功能描述

综合运用 Effect 的核心模式，模拟一个简化版 opencode 架构：服务层（Logger/EventBus/DataStore）+ 类型安全错误 + 流式事件处理 + 资源管理 + 并发任务 + 重试策略。展示这些模式如何协同工作。

## 运行

```bash
bun run examples/10-integration/index.ts
```

## 关键代码分析

### 1. 服务架构

```
LoggerLive (无依赖)
    ↓
MemoryStore (依赖 Logger)
EventBusLive (依赖 Logger, PubSub 内部)
    ↓
AppLayer (Layer.provideMerge 组合)
```

每个服务独立定义，通过 `Layer.provideMerge` 组合成依赖树。

### 2. 事件系统

```typescript
const pubsub = yield* PubSub.bounded<string>(64)
const stream = Stream.fromPubSub(pubsub)
```

PubSub 连接事件发布和流式消费。

### 3. 后台事件处理

```typescript
yield* Effect.fork(
  Effect.scoped(
    Effect.gen(function* () {
      yield* pipe(
        eventBus.subscribe,
        Stream.tap((event) => log.info(`Processing: ${event}`)),
        Stream.filter((event) => event.startsWith("user:")),
        Stream.runForEach(() => Effect.void),
      )
    }),
  ),
)
```

后台 Fiber 处理事件流，不阻塞主程序。

### 4. 重试 + 错误处理

```typescript
const retryPolicy = pipe(
  Schedule.exponential("100 millis", 2.0),
  Schedule.intersect(Schedule.recurs(3)),
)

Effect.retry(retryPolicy).pipe(Effect.catchTag("BusinessError", handler))
```

业务操作结合重试和类型安全错误处理。

### 5. ManagedRuntime

```typescript
const runtime = ManagedRuntime.make(AppLayer)
await runtime.runPromise(MainProgram)
await runtime.dispose()
```

opencode 标准运行方式。

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `Context.GenericTag` | `packages/effect/src/context.ts` | 服务标识 |
| `Layer.provideMerge` | `packages/effect/src/layer.ts` | 依赖组合 |
| `ManagedRuntime` | `packages/effect/src/managed-runtime.ts` | 运行时生命周期 |
| `PubSub.bounded` | `packages/effect/src/pubsub.ts` | 有界发布订阅 |
| `Stream.fromPubSub` | `packages/effect/src/stream.ts` | 流式订阅 |
| `Effect.fork` | `packages/effect/src/effect.ts` | 后台 Fiber |
| `Schedule.exponential` | `packages/effect/src/schedule.ts` | 退避策略 |
| `Effect.retry` | `packages/effect/src/effect.ts` | 重试 |
| `Effect.catchTag` | `packages/effect/src/effect.ts` | 类型安全错误捕获 |

## 调试指导

1. 从 `MainProgram` 开始跟踪（第 120 行附近）

2. 断点建议：
   - `Layer.provideMerge` 的每一层 —— 观察依赖注入
   - `Stream.tap` 回调 —— 观察事件流处理
   - `Effect.fork` 前后 —— 观察后台 Fiber
   - `Effect.retry` —— 观察重试

3. 推荐调试流程：
   - 先理解 01-09 的单个模式
   - 在 10-integration 中观察它们如何组合
   - 使用 VS Code 的 "Debug Current Example (Bun)" 配置启动调试

4. Step Into `ManagedRuntime.make` 可以观察整个应用运行时的构建过程
