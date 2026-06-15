# 08 - HTTP Client (HTTP 客户端)

## 功能描述

演示 Effect HttpClient 的用法：GET/POST 请求、JSON 解析、重试策略、并行请求。opencode 中用 HttpClient 调用 AI provider API、OAuth、web search 等。

## 运行

```bash
bun run examples/08-http-client/index.ts
```

需要网络连接。

## 关键代码分析

### 1. 创建客户端

```typescript
const client = HttpClient.fetch  // 不再使用
// 推荐方式:
const client = yield* HttpClient.HttpClient  // 从上下文获取
```

`FetchHttpClient.layer` 提供基于 fetch 的 HttpClient 实现。

### 2. GET + JSON 解析

```typescript
const response = yield* pipe(
  HttpClientRequest.get(url),
  client.execute,
)
const data = yield* response.json
```

`HttpClientRequest.get` 创建请求，`client.execute` 发送，`response.json` 解析 JSON 响应体。

### 3. POST + JSON 请求体

```typescript
HttpClientRequest.post(url).pipe(
  HttpClientRequest.bodyJson({ title: "New todo", ... }),
)
```

`bodyJson` 自动序列化为 JSON 并设置 Content-Type。

### 4. 重试

```typescript
const retryPolicy = pipe(
  Schedule.exponential("200 millis", 2.0),
  Schedule.intersect(Schedule.recurs(3)),
)
pipe(request, Effect.retry(retryPolicy))
```

HTTP 请求结合重试策略，处理网络波动。

### 5. 并行请求

```typescript
Effect.all([req1, req2, req3], { concurrency: "unbounded" })
```

并行发送多个 HTTP 请求。

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `FetchHttpClient.layer` | `node_modules/@effect/platform/src/fetch-http-client.ts` | 提供 HttpClient |
| `HttpClient.HttpClient` | `node_modules/@effect/platform/src/http-client.ts` | HttpClient Tag |
| `HttpClientRequest.get` | `node_modules/@effect/platform/src/http-client-request.ts` | GET 请求构造 |
| `HttpClientRequest.post` | `node_modules/@effect/platform/src/http-client-request.ts` | POST 请求构造 |
| `HttpClientRequest.bodyJson` | `node_modules/@effect/platform/src/http-client-request.ts` | JSON 请求体 |

## 调试指导

1. 断点建议：
   - `client.execute` —— 观察请求发送
   - `response.json` —— 观察响应解析
   - `Effect.retry` —— 观察重试流程

2. HttpClient 需要 `Effect.scoped` 包裹，因为 fetch 连接有生命周期

3. Step Into `client.execute` 可以观察 Effect 的 HTTP 客户端实现
