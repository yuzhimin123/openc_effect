# 11 - HTTP Server（持续监听）

## 功能描述

基于 07 简化的 HTTP 服务器示例：**只启动服务器并持续监听**，不发送测试请求后退出。演示如何创建一个长期运行（long-running）的 HTTP 服务。

## 运行

```bash
bun run examples/11-http-server/index.ts
```

服务器在 `http://localhost:3000` 启动，按 `Ctrl+C` 停止。

## 如何创建服务器并持续监听

### 三步法

```typescript
// 1. 定义路由
const app = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Hello")),
  HttpRouter.get("/hello/:name", Effect.gen(function* () {
    const route = yield* HttpRouter.RouteContext
    return yield* HttpServerResponse.text(`Hello, ${route.params.name}!`)
  })),
)

// 2. 组装 Layer
const ServerLayer = Layer.provideMerge(
  HttpServer.serve(app),          // 将路由转为服务 Layer
  BunHttpServer.layer({ port: 3000 }), // 提供 Bun 平台实现
)

// 3. 启动并持续监听
const main = Effect.scoped(
  Effect.gen(function* () {
    yield* Effect.fork(Layer.build(ServerLayer)) // 后台启动
    yield* Effect.never                          // 永远等待
  }),
)
await Effect.runPromise(main)
```

### 关键点

| 步骤 | 代码 | 说明 |
|------|------|------|
| 定义路由 | `HttpRouter.empty.pipe(HttpRouter.get(...))` | 注册路由处理器 |
| 组装 Layer | `Layer.provideMerge(HttpServer.serve(app), BunHttpServer.layer(...))` | 组合应用层和平台层 |
| 后台启动 | `Effect.fork(Layer.build(ServerLayer))` | Fork 使服务器在后台运行 |
| 保持存活 | `Effect.never` | 让主 fiber 永远等待，进程不会退出 |

### 与 07 的区别

| | 07 - HTTP API Server | 11 - HTTP Server |
|---|---|---|
| 启动后 | 发送测试请求 → 自动退出 | **持续监听**，等待请求 |
| 生命周期 | 自动关闭 | 按 `Ctrl+C` 手动停止 |
| 用途 | 演示/测试 | 生产服务开发 |

## 调试指导

1. 在 `HttpRouter.get` 处理函数中断点 —— 观察请求处理
2. 在 `Layer.build(ServerLayer)` 中断点 —— 观察服务器初始化
3. 访问 `http://localhost:3000/ping` 验证服务是否运行
4. 按 `Ctrl+C` 观察 Effect 的 scoped 生命周期自动清理资源

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `HttpRouter.empty` | `@effect/platform/src/http-router.ts` | 空路由 |
| `HttpRouter.get` | `@effect/platform/src/http-router.ts` | 注册 GET 路由 |
| `HttpRouter.RouteContext` | `@effect/platform/src/http-router.ts` | 路由上下文（获取路径参数） |
| `HttpServerResponse.text` | `@effect/platform/src/http-server-response.ts` | 纯文本响应 |
| `HttpServerResponse.json` | `@effect/platform/src/http-server-response.ts` | JSON 响应 |
| `HttpServer.serve` | `@effect/platform/src/http-server.ts` | 路由 → 服务 Layer |
| `BunHttpServer.layer` | `@effect/platform-bun/src/bun-http-server.ts` | Bun 平台实现层 |
| `Effect.never` | `effect/src/effect.ts` | 永远不完成的 Effect，保持进程存活 |
