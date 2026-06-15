import { Effect, Console, Schedule } from "effect"
import { pipe } from "effect/Function"
import { HttpClient, HttpClientRequest, FetchHttpClient } from "@effect/platform"

// ============================================================
// 08 - HTTP Client
// 模仿 opencode 的 HTTP 客户端模式
// 使用 FetchHttpClient (推荐)
// ============================================================

const getJson = (url: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const response = yield* pipe(
      HttpClientRequest.get(url),
      client.execute,
    )
    return yield* response.json
  })

const getDemo = pipe(
  getJson("https://jsonplaceholder.typicode.com/todos/1"),
  Effect.tap((data: unknown) =>
    console.log(`  GET /todos/1 -> ${JSON.stringify(data as object).slice(0, 80)}`),
  ),
  Effect.catchAll((err) => Console.log(`  GET failed: ${err}`)),
)

const postDemo = pipe(
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const response = yield* pipe(
      HttpClientRequest.post("https://jsonplaceholder.typicode.com/todos"),
      HttpClientRequest.bodyJson({ title: "New todo", completed: false, userId: 1 }),
      client.execute,
    )
    return yield* response.json
  }),
  Effect.tap((data: unknown) =>
    console.log(`  POST created -> ${JSON.stringify(data as object).slice(0, 80)}`),
  ),
  Effect.catchAll((err) => Console.log(`  POST failed: ${err}`)),
)

const retryPolicy = pipe(
  Schedule.exponential("200 millis", 2.0),
  Schedule.intersect(Schedule.recurs(3)),
)

const getWithRetry = (url: string) =>
  pipe(
    getJson(url),
    Effect.retry(retryPolicy),
  )

const retryDemo = pipe(
  getWithRetry("https://jsonplaceholder.typicode.com/todos/2"),
  Effect.tap((data: unknown) =>
    console.log(`  With retry -> ${JSON.stringify(data as object).slice(0, 80)}`),
  ),
  Effect.catchAll((err) => Console.log(`  Retry demo failed: ${err}`)),
)

const parallelDemo = pipe(
  Effect.all([
    getJson("https://jsonplaceholder.typicode.com/todos/1"),
    getJson("https://jsonplaceholder.typicode.com/todos/2"),
    getJson("https://jsonplaceholder.typicode.com/todos/3"),
  ], { concurrency: "unbounded" }),
  Effect.tap(() => console.log("  Got 3 responses in parallel")),
  Effect.catchAll((err) => Console.log(`  Parallel demo failed: ${err}`)),
)

// --- 主程序 (FetchHttpClient 需要 scoped) ---

const program = Effect.scoped(
  pipe(
    Effect.gen(function* () {
      console.log("=== HTTP Client 演示 ===")
      console.log("(需要网络连接)")

      console.log("\n1. GET 请求")
      yield* getDemo

      console.log("\n2. POST 请求")
      yield* postDemo

      console.log("\n3. 带重试的 GET")
      yield* retryDemo

      console.log("\n4. 并行请求")
      yield* parallelDemo

      console.log("\n✅ 示例 08 完成：HTTP Client 正常工作")
    }),
    Effect.provide(FetchHttpClient.layer),
  ),
)

await Effect.runPromise(program)
