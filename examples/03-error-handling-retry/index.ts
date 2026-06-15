import { Effect, Console, Schedule, Exit } from "effect"
import { pipe } from "effect/Function"

// ============================================================
// 03 - Error Handling & Retry
// 模仿 opencode 的错误处理与重试策略
// opencode 参考:
//   - packages/core/src/util/effect-flock.ts (文件锁+重试)
//   - packages/opencode/src/session/retry.ts (指数退避)
// ============================================================

// --- 1. 定义业务错误 ---

class DbError {
  readonly _tag = "DbError" as const
  constructor(readonly message: string) {}
}

class NetworkError {
  readonly _tag = "NetworkError" as const
  constructor(readonly statusCode: number, readonly message: string) {}
}

class RateLimitError {
  readonly _tag = "RateLimitError" as const
  constructor(readonly retryAfterMs: number) {}
}

// --- 2. 模拟不稳定 API (使用 Effect.try 捕获 throw) ---

let attemptCount = 0

const flakyApi: Effect.Effect<
  { id: number; name: string },
  NetworkError | RateLimitError
> = Effect.try({
  try: () => {
    attemptCount++
    console.log(`  [API call #${attemptCount}]`)
    if (attemptCount <= 2) throw new NetworkError(503, "Service Unavailable")
    if (attemptCount <= 4) throw new RateLimitError(1000)
    return { id: 1, name: "response-data" }
  },
  catch: (error) => error as NetworkError | RateLimitError,
})

// --- 3. 重试策略: 指数退避 + jitter + 最大重试 ---
// opencode 使用类似的策略: exponential + jitter + recurs

const retryPolicy = pipe(
  Schedule.exponential("100 millis", 2.0),
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(5)),
)

const apiWithRetry = pipe(
  flakyApi,
  Effect.retry(retryPolicy),
  Effect.catchAll((error) => {
    switch (error._tag) {
      case "NetworkError":
        return Console.log(`  Network failed (${error.statusCode})`)
      case "RateLimitError":
        return Console.log(`  Rate limited`)
      default:
        return Console.log(`  Unknown error`)
    }
  }),
)

// --- 4. 分层错误处理 (catchTag) ---

class ValidationError {
  readonly _tag = "ValidationError" as const
  constructor(readonly field: string, readonly message: string) {}
}

class NotFoundError {
  readonly _tag = "NotFoundError" as const
  constructor(readonly id: string) {}
}

const getUser = (id: number) =>
  id <= 0
    ? Effect.fail(new ValidationError("id", "must be positive"))
    : id > 100
    ? Effect.fail(new NotFoundError(String(id)))
    : Effect.succeed({ id, name: "User " + id })

const getUserSafe = (id: number) =>
  pipe(
    getUser(id),
    Effect.catchTag("ValidationError", (err: ValidationError) =>
      Console.log(`  [Handled] Validation: ${err.field} ${err.message}`).pipe(
        Effect.map(() => ({ id: 0, name: "fallback" })),
      ),
    ),
    Effect.catchTag("NotFoundError", (err: NotFoundError) =>
      Console.log(`  [Handled] Not found: id=${err.id}`).pipe(
        Effect.map(() => ({ id: 0, name: "guest" })),
      ),
    ),
  )

// --- 5. Exit 检查 ---

const inspectExit = <A, E>(effect: Effect.Effect<A, E>) =>
  pipe(
    effect,
    Effect.exit,
    Effect.map((exit) => {
      if (Exit.isSuccess(exit)) {
        console.log("  ✅ Success:", (exit as Exit.Success<A, E>).value)
      } else {
        console.log("  ❌ Failure:", (exit as Exit.Failure<A, E>).cause._tag)
      }
      return exit
    }),
  )

// --- 6. 超时 ---

const slowTask = Effect.sleep("200 millis").pipe(Effect.map(() => "slow result"))

const withTimeout = pipe(
  slowTask,
  Effect.timeout("50 millis"),
  Effect.catchAll((error) => Console.log(`  Timeout triggered: ${error}`)),
)

// --- 主程序 ---

const program = Effect.gen(function* () {
  console.log("=== 1. 指数退避重试 ===")
  yield* apiWithRetry

  console.log("\n=== 2. 分层错误处理 (catchTag) ===")
  yield* getUserSafe(-1)
  yield* getUserSafe(999)
  yield* Console.log("  Result:", yield* getUserSafe(42))

  console.log("\n=== 3. Exit 检查 ===")
  yield* inspectExit(Effect.succeed("ok"))
  yield* inspectExit(Effect.fail(new DbError("connection lost")))

  console.log("\n=== 4. 超时控制 ===")
  yield* withTimeout
})

// 注意: retry 涉及间隔等待, 需要使用 runPromise (不能 runSync)
await Effect.runPromise(program)
console.log("\n✅ 示例 03 完成：Error Handling & Retry 正常工作")
