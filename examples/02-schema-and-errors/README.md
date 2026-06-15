# 02 - Schema & Tagged Errors (数据建模与类型安全错误)

## 功能描述

演示 Effect Schema 的数据建模能力，以及 TaggedError 提供的类型安全错误处理。opencode 中广泛使用 Schema 进行数据验证（API 请求/响应、配置 schema、事件结构等）和 Branded Types（Event.ID、Session.ID）。

## 运行

```bash
bun run examples/02-schema-and-errors/index.ts
```

## 关键代码分析

### 1. Branded Types

```typescript
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = Schema.Schema.Type<typeof UserId>
```

Branded Types 在类型层面区分不同类型，避免混用（如不能把 `Session.ID` 传给 `Event.ID`）。

### 2. 数据模型

```typescript
const UserSchema = Schema.Struct({
  id: UserId,
  name: Schema.String,
  email: Email,
  age: Schema.Number,
  isActive: Schema.Boolean,
})
```

`Schema.Struct` 定义一个结构化数据模型，自动推导 TypeScript 类型。

### 3. Tagged Errors

```typescript
class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  field: Schema.String,
  message: Schema.String,
}) {}
```

`Schema.TaggedError` 创建可通过 `_tag` 区分的类型安全错误。opencode 中几乎每个模块都使用此模式。

### 4. 解码与编码

```typescript
Schema.decodeUnknown(UserSchema)(rawData)  // unknown -> 类型安全
Schema.encode(UserSchema)(user)            // 类型安全 -> 原始格式
```

### 5. 分层错误处理

```typescript
findUser("bad-id").pipe(
  Effect.catchTag("ValidationError", (err) => { /* ... */ }),
  Effect.catchTag("NotFoundError", (err) => { /* ... */ }),
)
```

`catchTag` 基于 `_tag` 精确匹配错误类型。

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `Schema.Struct` | `packages/effect/src/schema.ts` | 结构化数据定义 |
| `Schema.brand` | `packages/effect/src/brand.ts` | 品牌类型 |
| `Schema.TaggedError` | `packages/effect/src/schema.ts` | Tagged Error 类工厂 |
| `Schema.decodeUnknown` | `packages/effect/src/schema.ts` | 解析未知数据 |
| `Schema.encode` | `packages/effect/src/schema.ts` | 编码为原始格式 |
| `Effect.catchTag` | `packages/effect/src/effect.ts` | 按 tag 捕获错误 |

## 调试指导

1. 断点建议：
   - `Schema.decodeUnknown(UserSchema)` —— 观察 Schema 解析过程
   - `Effect.catchTag("ValidationError", ...)` —— 观察错误路由

2. Step Into `Schema.decodeUnknown` 可以看到 Schema 的运行时验证逻辑

3. 观察 `Effect.fail(new ValidationError(...))` 如何创建类型安全的错误值
