import { Effect, Console, Context, Layer, ManagedRuntime, Stream, PubSub, Schedule, Duration } from "effect"
import { pipe } from "effect/Function"

// ============================================================
// 10 - Integration Demo
// 综合示例: 服务层 + 错误处理 + 流 + 资源管理 + 并发
// 模拟一个简化版 opencode 架构
// ============================================================

// ======== 1. 定义服务 ========

interface Logger {
  readonly info: (msg: string) => Effect.Effect<void>
  readonly error: (msg: string) => Effect.Effect<void>
}
const Logger = Context.GenericTag<Logger>("Logger")

interface EventBus {
  readonly publish: (event: string) => Effect.Effect<void>
  readonly subscribe: Stream.Stream<string>
}
const EventBus = Context.GenericTag<EventBus>("EventBus")

interface DataStore {
  readonly get: (key: string) => Effect.Effect<string | null>
  readonly set: (key: string, value: string) => Effect.Effect<void>
}
const DataStore = Context.GenericTag<DataStore>("DataStore")

// ======== 2. 实现服务 ========

const LoggerLive = Layer.succeed(Logger, {
  info: (msg) => Console.log(`[INFO] ${msg}`),
  error: (msg) => Console.error(`[ERROR] ${msg}`),
})

const MemoryStore = Layer.effect(
  DataStore,
  Effect.gen(function* () {
    const log = yield* Logger
    const store = new Map<string, string>()
    return {
      get: (key) => log.info(`GET ${key}`).pipe(Effect.map(() => store.get(key) ?? null)),
      set: (key, value) =>
        Effect.sync(() => store.set(key, value)).pipe(
          Effect.tap(() => log.info(`SET ${key} = ${value}`)),
        ),
    }
  }),
)

const EventBusLive = Layer.effect(
  EventBus,
  Effect.gen(function* () {
    const log = yield* Logger
    const pubsub = yield* PubSub.bounded<string>(64)
    return {
      publish: (event: string) =>
        log.info(`Event: ${event}`).pipe(Effect.flatMap(() => pubsub.publish(event))),
      subscribe: Stream.fromPubSub(pubsub),
    }
  }),
)

// ======== 3. 构建依赖树 ========

const AppLayer = Layer.provideMerge(
  Layer.provideMerge(EventBusLive, MemoryStore),
  LoggerLive,
)

// ======== 4. 事件处理 ========

const startEventProcessor = Effect.gen(function* () {
  const eventBus = yield* EventBus
  const store = yield* DataStore
  const log = yield* Logger

  yield* Effect.fork(
    Effect.scoped(
      Effect.gen(function* () {
        yield* pipe(
          eventBus.subscribe,
          Stream.tap((event) => log.info(`Processing: ${event}`)),
          Stream.filter((event) => event.startsWith("user:")),
          Stream.mapEffect((event) => {
            const parts = event.split(":")
            return parts[1] ? store.set(`track:${parts[1]}`, "processed") : Effect.void
          }),
          Stream.runForEach(() => Effect.void),
        )
      }),
    ),
  )
})

// ======== 5. 业务操作 ========

class BusinessError {
  readonly _tag = "BusinessError" as const
  constructor(readonly message: string) {}
}

const retryPolicy = pipe(
  Schedule.exponential("100 millis", 2.0),
  Schedule.intersect(Schedule.recurs(3)),
)

const processUser = (userId: string) =>
  pipe(
    Effect.succeed(userId),
    Effect.flatMap((id) =>
      id.length < 2
        ? Effect.fail(new BusinessError(`Invalid user ID: ${id}`))
        : Effect.succeed(`user:${id}`),
    ),
    Effect.retry(retryPolicy),
    Effect.catchTag("BusinessError", (err: BusinessError) =>
      Effect.logWarning(`Business error: ${err.message}`).pipe(Effect.map(() => null)),
    ),
  )

// ======== 6. 主程序 ========

const MainProgram = Effect.gen(function* () {
  const log = yield* Logger
  const eventBus = yield* EventBus
  const store = yield* DataStore

  yield* log.info("=== Application Starting ===")
  yield* startEventProcessor

  yield* store.set("config:theme", "dark")
  yield* store.set("config:lang", "zh-CN")

  yield* eventBus.publish("user:login")
  yield* eventBus.publish("user:logout")
  yield* eventBus.publish("system:heartbeat")

  const theme = yield* store.get("config:theme")
  yield* log.info(`Current theme: ${theme}`)

  const result1 = yield* processUser("alice")
  yield* log.info(`Process alice: ${result1}`)

  const result2 = yield* processUser("x")
  yield* log.info(`Process x: ${result2}`)

  yield* log.info("=== Application Shutting Down ===")
})

// ======== 7. 启动 ========

const runtime = ManagedRuntime.make(AppLayer)
try {
  await runtime.runPromise(MainProgram)
} finally {
  await runtime.dispose()
}
console.log("\n✅ 示例 10 完成：Integration Demo 正常工作")
