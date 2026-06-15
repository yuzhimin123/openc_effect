import { Effect, Console, Fiber, Layer } from "effect"
import { pipe } from "effect/Function"
import { HttpRouter, HttpServer, HttpServerResponse, HttpServerRequest, HttpMiddleware } from "@effect/platform"
import { BunHttpServer } from "@effect/platform-bun"

// ============================================================
// 07 - HTTP API Server
// 模仿 opencode 的 HTTP 服务层
// opencode 参考: packages/opencode/src/server/
// ============================================================

interface Todo {
  readonly id: number
  readonly title: string
  readonly completed: boolean
}
const todos: Array<Todo> = [
  { id: 1, title: "Learn Effect", completed: true },
  { id: 2, title: "Build something awesome", completed: false },
  { id: 3, title: "Write documentation", completed: false },
]

const app = HttpRouter.empty.pipe(
  HttpRouter.get("/todos",
    Effect.gen(function* () {
      return yield* HttpServerResponse.json(todos)
    }),
  ),
  HttpRouter.get("/todos/:id",
    Effect.gen(function* () {
      const route = yield* HttpRouter.RouteContext
      const id = Number(route.params.id)
      const todo = todos.find((t) => t.id === id)
      if (!todo) {
        return yield* HttpServerResponse.json(
          { error: "Not found" },
          { status: 404 as const },
        )
      }
      return yield* HttpServerResponse.json(todo)
    }),
  ),
  HttpRouter.get("/health",
    HttpServerResponse.json({ status: "ok", todosCount: todos.length }),
  ),
)

const appWithLogging = HttpRouter.use(
  app,
  HttpMiddleware.make((app) =>
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest
      console.log(`  [HTTP] ${req.method} ${req.url}`)
      return yield* app
    }),
  ),
)

// --- 启动服务器 + 测试 ---

const AppLayer = Layer.provideMerge(
  HttpServer.serve(appWithLogging),
  BunHttpServer.layer({ port: 3000 }),
)

const main = Effect.scoped(
  Effect.gen(function* () {
    console.log("Starting HTTP server on http://localhost:3000 ...")
    yield* Effect.fork(Layer.build(AppLayer))
    yield* Effect.sleep("500 millis")

    console.log("\n=== 发送测试请求 ===")

    const fetchJson = (url: string) =>
      Effect.tryPromise({
        try: () => fetch(url).then((r) => r.json()),
        catch: (e) => String(e),
      })

    const data1 = yield* fetchJson("http://localhost:3000/todos")
    console.log(`  GET /todos: ${JSON.stringify(data1 as Todo[]).slice(0, 100)}...`)

    const data2 = yield* fetchJson("http://localhost:3000/health")
    console.log(`  GET /health: ${JSON.stringify(data2)}`)

    const data3 = yield* fetchJson("http://localhost:3000/todos/1")
    console.log(`  GET /todos/1: ${JSON.stringify(data3)}`)

    const data4 = yield* fetchJson("http://localhost:3000/todos/999")
    console.log(`  GET /todos/999: ${JSON.stringify(data4)}`)

    console.log("\n✅ 示例 07 完成：HTTP API Server 正常工作")
  }),
)

await Effect.runPromise(main)
