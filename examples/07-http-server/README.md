# 07 - HTTP API Server (HTTP 服务)

## 功能描述

演示使用 Effect 构建 HTTP API 服务器：路由定义、路径参数、JSON 响应、中间件（日志）。opencode 的服务器层使用 `@effect/platform` 的 HttpRouter/HttpServer 构建。

## 运行

```bash
bun run examples/07-http-server/index.ts
```

服务器在 `http://localhost:3000` 启动，运行测试后自动关闭。

## 关键代码分析

### 1. 路由定义

```typescript
const app = HttpRouter.empty.pipe(
  HttpRouter.get("/todos", Effect.gen(function* () {
    return yield* HttpServerResponse.json(todos)
  })),
  HttpRouter.get("/todos/:id", Effect.gen(function* () {
    const route = yield* HttpRouter.RouteContext
    const id = Number(route.params.id)
    // ...
  })),
)
```

`HttpRouter.get` 注册 GET 路由，`:id` 为路径参数，通过 `RouteContext.params` 获取。

### 2. 中间件

```typescript
const appWithLogging = HttpRouter.use(
  app,
  HttpMiddleware.make((app) =>
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest
      console.log(`[HTTP] ${req.method} ${req.url}`)
      return yield* app
    }),
  ),
)
```

`HttpMiddleware.make` 创建中间件，`HttpRouter.use` 应用中间件到路由。

### 3. 启动服务器

```typescript
const AppLayer = Layer.provideMerge(
  HttpServer.serve(app),
  BunHttpServer.layer({ port: 3000 }),
)

yield* Effect.fork(Layer.build(AppLayer))
```

`HttpServer.serve` 创建服务 Layer，`BunHttpServer.layer` 提供平台实现。

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `HttpRouter.empty` | `node_modules/@effect/platform/src/http-router.ts` | 空路由 |
| `HttpRouter.get` | `node_modules/@effect/platform/src/http-router.ts` | GET 路由 |
| `HttpRouter.RouteContext` | `node_modules/@effect/platform/src/http-router.ts` | 路由上下文 |
| `HttpServerResponse.json` | `node_modules/@effect/platform/src/http-server-response.ts` | JSON 响应 |
| `HttpMiddleware.make` | `node_modules/@effect/platform/src/http-middleware.ts` | 创建中间件 |
| `HttpServer.serve` | `node_modules/@effect/platform/src/http-server.ts` | 服务器 Layer |
| `BunHttpServer.layer` | `node_modules/@effect/platform-bun/src/bun-http-server.ts` | Bun 服务器层 |

## 调试指导

1. 断点建议：
   - `HttpRouter.get` 处理函数 —— 观察路由处理
   - `HttpMiddleware.make` 回调 —— 观察中间件执行
   - `Layer.build(AppLayer)` —— 观察服务器启动

2. 服务器使用 `Layer` 模式启动，注意使用 `Effect.scoped` 管理生命周期

3. Step Into `HttpServer.serve` 可以观察 Effect 如何管理 HTTP 服务器状态
