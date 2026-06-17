import { Effect, Console, Layer, Fiber } from "effect"
import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunHttpServer } from "@effect/platform-bun"

// ============================================================
// 11 - HTTP Server (long-running server)
// 基于 07 简化：只启动服务器并持续监听，不发送测试请求
// 演示如何创建一个永远监听的 HTTP 服务
// ============================================================

// ---- 1. 定义应用层（Router） ----

const app = HttpRouter.empty.pipe(
  HttpRouter.get("/",
    HttpServerResponse.text("Hello, Effect!")),
  HttpRouter.get("/hello/:name",
    Effect.gen(function* () {
      const route = yield* HttpRouter.RouteContext
      return yield* HttpServerResponse.text(`Hello, ${route.params.name}!`)
    })),
  HttpRouter.get("/ping",
    HttpServerResponse.json({ pong: true, timestamp: Date.now() })),
)

// ---- 2. 将 Router 组装成 Server Layer ----

const ServerLayer = Layer.provideMerge(
  HttpServer.serve(app),
  BunHttpServer.layer({ port: 3000 }),
)

// ---- 3. 启动服务器并永远监听 ----

const main = Effect.scoped(
  Effect.gen(function* () {
    console.log("")
    console.log("  🚀 Server listening on http://localhost:3000")
    console.log("")
    console.log("  Try these endpoints:")
    console.log("    GET /              -> Hello, Effect!")
    console.log("    GET /hello/world   -> Hello, world!")
    console.log("    GET /ping          -> { pong: true, timestamp }")
    console.log("")
    console.log("  Press Ctrl+C to stop")
    console.log("")

    // Fork 使服务器在后台运行，主 fiber 保持存活
    // 由于没有其他工作，程序会 keep-alive 直到被中断
    yield* Effect.fork(Layer.build(ServerLayer))

    // 永远等待，保持进程运行
    yield* Effect.never
  }),
)

await Effect.runPromise(main)
