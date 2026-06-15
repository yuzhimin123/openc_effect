import { Effect, Console, Stream, PubSub, Schedule, Duration } from "effect"
import { pipe } from "effect/Function"

// ============================================================
// 06 - Streaming & PubSub
// 模仿 opencode 的事件流模式
// opencode 参考:
//   - packages/core/src/event.ts (PubSub + Stream)
//   - packages/opencode/src/control-plane/workspace.ts (Stream 处理)
// ============================================================

// --- 1. Stream 基础: map + filter + tap ---

const streamDemo1 = pipe(
  Stream.fromIterable([1, 2, 3, 4, 5, 6, 7, 8]),
  Stream.map((n) => n * 2),
  Stream.filter((n) => n % 3 === 0),
  Stream.tap((n) => Console.log(`  [stream] processing: ${n}`)),
  Stream.runCollect,
  Effect.map((chunk) => Array.from(chunk)),
  Effect.tap((result) => console.log("  Stream results:", result)),
)

// --- 2. Stream flatMap ---

const nestedData = Stream.fromIterable([
  [1, 2],
  [3, 4, 5],
  [6],
])

const streamDemo2 = pipe(
  nestedData,
  Stream.flatMap((arr) => Stream.fromIterable(arr)),
  Stream.map((n) => n * 10),
  Stream.runCollect,
  Effect.map((chunk) => Array.from(chunk)),
  Effect.tap((result) => console.log("  FlatMap results:", result)),
)

// --- 3. Stream merge (合并) ---

const fastStream = Stream.iterate(0, (n) => n + 1).pipe(
  Stream.map((n) => `fast-${n}`),
  Stream.schedule(Schedule.spaced(Duration.millis(10))),
  Stream.take(3),
)

const slowStream = Stream.iterate(0, (s) => s + 1).pipe(
  Stream.map((s) => `slow-${s}`),
  Stream.schedule(Schedule.spaced(Duration.millis(25))),
  Stream.take(2),
)

const mergeDemo = pipe(
  Stream.merge(fastStream, slowStream),
  Stream.runCollect,
  Effect.map((chunk) => Array.from(chunk)),
  Effect.tap((results) => console.log("  Merged stream results:", results)),
)

// --- 4. PubSub —— 发布订阅 ---

const pubsubDemo = Effect.gen(function* () {
  console.log("\n=== PubSub (发布订阅) ===")
  const pubsub = yield* PubSub.bounded<string>(16)

  const f1 = yield* Effect.fork(
    Effect.scoped(
      Effect.gen(function* () {
        yield* pipe(
          Stream.fromPubSub(pubsub),
          Stream.tap((ev: string) => Console.log(`  [sub-1] received: ${ev}`)),
          Stream.runForEach(() => Effect.void),
        )
      }),
    ),
  )

  const f2 = yield* Effect.fork(
    Effect.scoped(
      Effect.gen(function* () {
        yield* pipe(
          Stream.fromPubSub(pubsub),
          Stream.filter((ev: string) => ev.startsWith("important:")),
          Stream.tap((ev: string) => Console.log(`  [sub-2] important: ${ev.slice(10)}`)),
          Stream.runForEach(() => Effect.void),
        )
      }),
    ),
  )

  yield* Effect.sleep(Duration.millis(10))
  yield* pubsub.publish("info: hello")
  yield* pubsub.publish("important: alert!")
  yield* pubsub.publish("debug: detail")
  yield* Effect.sleep(Duration.millis(30))
})

// --- 主程序 ---

Effect.runSync(streamDemo1)
Effect.runSync(streamDemo2)

await Effect.runPromise(
  Effect.gen(function* () {
    console.log("\n=== 3. Stream merge ===")
    yield* mergeDemo
    yield* pubsubDemo
  }),
)

console.log("\n✅ 示例 06 完成：Streaming & PubSub 正常工作")
