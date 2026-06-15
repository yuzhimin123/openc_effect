import { Effect, Console, Fiber, Queue, Duration, Exit } from "effect"
import { pipe } from "effect/Function"

// ============================================================
// 05 - Concurrency (Fibers & Queues)
// 模仿 opencode 的并发模式
// opencode 参考:
//   - packages/core/src/session/runner/llm.ts (并发任务)
//   - packages/core/src/event.ts (Queue/PubSub)
// ============================================================

// --- 1. Fork / Join —— 并行计算 ---

const fib = (n: number): Effect.Effect<number> =>
  n <= 1
    ? Effect.succeed(n)
    : Effect.zipWith(
        Effect.suspend(() => fib(n - 1)),
        Effect.suspend(() => fib(n - 2)),
        (a, b) => a + b,
      )

const forkJoinDemo = Effect.gen(function* () {
  console.log("=== Fork / Join ===")
  const fiber1 = yield* Effect.fork(fib(30))
  const fiber2 = yield* Effect.fork(fib(30))

  const result1 = yield* Fiber.join(fiber1)
  const result2 = yield* Fiber.join(fiber2)
  console.log(`  fib(30) = ${result1}, fib(30) = ${result2}`)
})

// --- 2. 批量并行 (Fork All) ---

const fetchUrl = (url: string, delayMs: number) =>
  Effect.sleep(Duration.millis(delayMs)).pipe(
    Effect.map(() => `[${url}] done (${delayMs}ms)`),
    Effect.tap((res) => Console.log(`    ${res}`)),
  )

const batchDemo = Effect.gen(function* () {
  console.log("\n=== 批量并行 (Fork All + Join All) ===")
  const urls = [
    fetchUrl("api.github.com", 150),
    fetchUrl("api.openai.com", 200),
    fetchUrl("api.effect.website", 80),
  ]
  const fibers = yield* Effect.all(urls.map((u) => Effect.fork(u)))
  const results: Array<string> = []
  for (const f of fibers) {
    results.push(yield* Fiber.join(f))
  }
  console.log("  All results:", results)
})

// --- 3. Queue —— 基础操作 ---

const queueDemo = pipe(
  Queue.unbounded<number>(),
  Effect.flatMap((queue) =>
    Effect.gen(function* () {
      console.log("\n=== Queue (基础操作) ===")
      yield* queue.offer(10)
      yield* queue.offer(20)
      yield* queue.offer(30)

      const a = yield* queue.take
      const b = yield* queue.take
      const c = yield* queue.take
      console.log(`  Took from queue: ${a}, ${b}, ${c}`)

      // Queue 大小
      yield* queue.offer(40)
      yield* queue.offer(50)
      const size = yield* queue.size
      console.log(`  Queue size: ${size}`)
    }),
  ),
)

// --- 4. Effect.all 并行 ---

const parallelDemo = Effect.gen(function* () {
  console.log("\n=== Effect.all (并行) ===")
  const tasks = [
    Effect.sleep(Duration.millis(100)).pipe(Effect.map(() => "Task A")),
    Effect.sleep(Duration.millis(150)).pipe(Effect.map(() => "Task B")),
    Effect.sleep(Duration.millis(50)).pipe(Effect.map(() => "Task C")),
  ]
  const results = yield* Effect.all(tasks, { concurrency: "unbounded" })
  console.log("  Parallel results:", results)
})

// --- 5. Race (竞态) ---

const raceDemo = Effect.gen(function* () {
  console.log("\n=== Race (竞态) ===")
  const winner = yield* Effect.race(
    Effect.sleep(Duration.millis(100)).pipe(Effect.map(() => "slow")),
    Effect.sleep(Duration.millis(50)).pipe(Effect.map(() => "fast")),
  )
  console.log(`  Winner: ${winner}`)
})

// --- 6. Fiber await —— 监控 Fiber 生命周期 ---

const fiberAwaitDemo = Effect.gen(function* () {
  console.log("\n=== Fiber.await ===")
  const fiber = yield* Effect.fork(
    Effect.sleep(Duration.millis(30)).pipe(Effect.map(() => "fiber result")),
  )
  const exit = yield* Fiber.await(fiber)
  if (Exit.isSuccess(exit)) {
    console.log("  Fiber completed:", (exit as Exit.Success<string>).value)
  }
})

// --- 主程序 ---
// 纯计算部分用 runSync, 异步部分用 runPromise

Effect.runSync(forkJoinDemo)

await Effect.runPromise(
  Effect.gen(function* () {
    yield* batchDemo
    yield* queueDemo
    yield* parallelDemo
    yield* raceDemo
    yield* fiberAwaitDemo
  }),
)

console.log("\n✅ 示例 05 完成：Concurrency 正常工作")
