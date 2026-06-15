# 06 - Streaming & PubSub (流式处理与发布订阅)

## 功能描述

演示 Effect Stream 和 PubSub 的核心用法：Stream 的 map/filter 变换、flatMap 展平、Stream merge 合并、PubSub 发布订阅模式。opencode 中用于事件溯源、SSE 推送、实时数据流处理。

## 运行

```bash
bun run examples/06-streaming-pubsub/index.ts
```

## 关键代码分析

### 1. Stream 基础变换

```typescript
Stream.fromIterable([1, 2, 3, 4, 5, 6, 7, 8]).pipe(
  Stream.map((n) => n * 2),
  Stream.filter((n) => n % 3 === 0),
  Stream.tap((n) => Console.log(`processing: ${n}`)),
  Stream.runCollect,
)
```

`Stream.fromIterable` 创建流，`map`/`filter` 变换，`tap` 副作用，`runCollect` 收集结果。

### 2. Stream flatMap

```typescript
Stream.fromIterable([[1, 2], [3, 4, 5]]).pipe(
  Stream.flatMap((arr) => Stream.fromIterable(arr)),
)
```

将嵌套流展平为单层流。

### 3. Stream merge

```typescript
Stream.merge(fastStream, slowStream)
```

合并两个流，交错输出。

### 4. PubSub 发布订阅

```typescript
const pubsub = yield* PubSub.bounded<string>(16)
const stream = Stream.fromPubSub(pubsub)

// 订阅
yield* Effect.fork(
  Effect.scoped(
    Effect.gen(function* () {
      yield* pipe(stream, Stream.tap(/*...*/), Stream.runForEach(() => Effect.void))
    }),
  ),
)

// 发布
yield* pubsub.publish("event data")
```

`PubSub` 支持多对多通信，每个 `Stream.fromPubSub` 创建一个独立的订阅流。

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `Stream.fromIterable` | `packages/effect/src/stream.ts` | 从可迭代对象创建流 |
| `Stream.map` | `packages/effect/src/stream.ts` | 流元素映射 |
| `Stream.filter` | `packages/effect/src/stream.ts` | 流元素过滤 |
| `Stream.flatMap` | `packages/effect/src/stream.ts` | 流展平 |
| `Stream.merge` | `packages/effect/src/stream.ts` | 合并两个流 |
| `Stream.runCollect` | `packages/effect/src/stream.ts` | 收集所有元素 |
| `PubSub.bounded` | `packages/effect/src/pubsub.ts` | 有界发布订阅 |
| `Stream.fromPubSub` | `packages/effect/src/stream.ts` | 从 PubSub 创建流 |

## 调试指导

1. 断点建议：
   - `Stream.map` 回调 —— 观察元素变换
   - `Stream.filter` 回调 —— 观察过滤逻辑
   - `pubsub.publish` —— 观察事件发布
   - `Stream.tap` —— 观察流中的每个元素

2. PubSub 订阅者需要在 `Effect.scoped` 中运行

3. Step Into `Stream.fromPubSub` 可以观察流式订阅的实现
