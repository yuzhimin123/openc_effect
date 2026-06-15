import { Effect, Console, Context, Layer, ManagedRuntime } from "effect"
import { pipe } from "effect/Function"

// ============================================================
// 01 - Services & Layers
// 模仿 opencode 的服务定义与依赖注入模式
// opencode 参考: packages/opencode/src/effect/app-runtime.ts
// ============================================================

// --- 1. 定义服务接口与 Tag ---
// opencode 使用 Context.GenericTag 定义服务标识

interface LoggerService {
  readonly info: (message: string) => Effect.Effect<void>
  readonly error: (message: string) => Effect.Effect<void>
}
const LoggerService = Context.GenericTag<LoggerService>("LoggerService")

interface DatabaseService {
  readonly query: (sql: string) => Effect.Effect<ReadonlyArray<Record<string, unknown>>>
}
const DatabaseService = Context.GenericTag<DatabaseService>("DatabaseService")

interface EmailService {
  readonly send: (to: string, subject: string, body: string) => Effect.Effect<void>
}
const EmailService = Context.GenericTag<EmailService>("EmailService")

// --- 2. 实现 Layer ---

const LoggerLayer = Layer.succeed(LoggerService, {
  info: (message) => Console.log(`[INFO] ${message}`),
  error: (message) => Console.error(`[ERROR] ${message}`),
})

// DatabaseService 依赖 LoggerService
const DatabaseLayer = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    const logger = yield* LoggerService
    return {
      query: (sql: string) =>
        pipe(
          Effect.succeed(`Executing query: ${sql}`),
          Effect.tap((msg) => logger.info(msg)),
          Effect.map(() => [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]),
        ),
    }
  }),
)

// EmailService 同时依赖 LoggerService 和 DatabaseService
const EmailLayer = Layer.effect(
  EmailService,
  Effect.gen(function* () {
    const logger = yield* LoggerService
    const db = yield* DatabaseService
    return {
      send: (to, subject, body) =>
        pipe(
          Effect.succeed({ to, subject, body }),
          Effect.tap(() => logger.info(`Sending email to ${to}: ${subject}`)),
          Effect.flatMap(() =>
            db.query(`SELECT * FROM users WHERE email = '${to}'`),
          ),
          Effect.flatMap((users) =>
            users.length > 0
              ? Console.log(`  Email sent to ${to}`)
              : logger.error(`  User ${to} not found`),
          ),
        ),
    }
  }),
)

// --- 3. 组合依赖树 (bottom-up: Logger -> Database -> Email) ---
// Layer.provideMerge: outer layer 提供 inner layer 的依赖, 同时合并输出

const AppLayer = Layer.provideMerge(
  EmailLayer,
  Layer.provideMerge(DatabaseLayer, LoggerLayer),
)

// --- 4. 运行程序 ---

// 方式 A: Effect.provide + runSync
console.log("=== 方式 A: Effect.provide + runSync ===")
const program = Effect.gen(function* () {
  const email = yield* EmailService
  yield* email.send("alice@example.com", "Welcome!", "Hello Alice!")
  yield* email.send("unknown@example.com", "Hello?", "Are you there?")
})
Effect.runSync(pipe(program, Effect.provide(AppLayer)))

// 方式 B: ManagedRuntime (更接近 opencode 实际用法)
console.log("\n=== 方式 B: ManagedRuntime ===")
const main = Effect.gen(function* () {
  const email = yield* EmailService
  yield* email.send("bob@example.com", "Hey Bob!", "How are you?")
})
const runtime = ManagedRuntime.make(AppLayer)
await runtime.runPromise(main)
await runtime.dispose()

console.log("\n✅ 示例 01 完成：Services & Layers 正常工作")
