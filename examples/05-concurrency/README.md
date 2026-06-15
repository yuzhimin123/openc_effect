# 05 - Concurrency (并发编程)

## 功能描述

演示 Effect 的并发原语：Fork/Join、批量并行、Queue（生产者-消费者）、Effect.all 并发执行、Race（竞态）。opencode 中用于并发 LLM 调用、事件处理、任务调度等。

## 运行

```bash
bun run examples/05-concurrency/index.ts
```

## 关键代码分析

### 1. Fork / Join

```typescript
const fiber1 = yield* Effect.fork(fib(30))
const fiber2 = yield* Effect.fork(fib(30))
const result1 = yield* Fiber.join(fiber1)
```

`Effect.fork` 在后台启动一个 Fiber（轻量级线程），`Fiber.join` 等待结果。

### 2. 批量并行

```typescript
const fibers = yield* Effect.all(urls.map((u) => Effect.fork(u)))
for (const f of fibers) results.push(yield* Fiber.join(f))
```

批量启动所有任务，然后逐个等待完成。

### 3. Queue 通信

```typescript
const queue = yield* Queue.unbounded<number>()
yield* queue.offer(1)  // 生产者
const value = yield* queue.take  // 消费者
```

Queue 实现 Fiber 间的异步通信（opencode 的事件系统基于 Queue/PubSub）。

### 4. Effect.all 并行

```typescript
Effect.all([task1, task2, task3], { concurrency: "unbounded" })
```

`concurrency: "unbounded"` 表示不限制并发数。

### 5. Race

```typescript
const winner = yield* Effect.race(fastTask, slowTask)
```

两任务竞态，取最先完成的结果。

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `Effect.fork` | `packages/effect/src/effect.ts` | 创建 Fiber |
| `Fiber.join` | `packages/effect/src/fiber.ts` | 等待 Fiber 结果 |
| `Fiber.await` | `packages/effect/src/fiber.ts` | 获取 Fiber 的 Exit |
| `Queue.unbounded` | `packages/effect/src/queue.ts` | 无界队列 |
| `Effect.all` | `packages/effect/src/effect.ts` | 并发执行 |
| `Effect.race` | `packages/effect/src/effect.ts` | 竞态执行 |

## 调试指导

1. 断点建议：
   - `Effect.fork` 前后 —— 观察 Fiber 创建
   - `Fiber.join` —— 观察 Fiber 完成
   - `queue.offer` / `queue.take` —— 观察队列通信

2. 并发相关 Effect 通常涉及 `Effect.sleep`（异步），需要用 `runPromise`

3. Step Into `Effect.fork` 可以观察 Effect 的 Fiber 调度机制
