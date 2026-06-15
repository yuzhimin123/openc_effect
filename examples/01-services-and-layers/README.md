# 01 - Services & Layers (服务与依赖注入)

## 功能描述

演示 Effect 最核心的依赖注入模式：**Services + Layers**。opencode 的整个架构就是基于此模式构建的 —— 每个功能模块（Database、Auth、Config、Git 等）都定义为一个 Service，通过 Layer 组合在一起。

## 运行

```bash
bun run examples/01-services-and-layers/index.ts
```

## 关键代码分析

### 1. 定义 Service Tag

```typescript
const LoggerService = Context.GenericTag<LoggerService>("LoggerService")
```

`Context.GenericTag` 创建服务的唯一标识。opencode 中每个模块都会定义类似的 Tag。

### 2. 实现 Layer

```typescript
const DatabaseLayer = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    const logger = yield* LoggerService  // 依赖注入
    return {
      query: (sql) => /* ... */
    }
  }),
)
```

`Layer.effect` 创建一个服务层，`yield* LoggerService` 注入依赖。

### 3. 依赖组合

```typescript
const AppLayer = Layer.provideMerge(
  EmailLayer,
  Layer.provideMerge(DatabaseLayer, LoggerLayer),
)
```

`Layer.provideMerge` 从下到上构建依赖树 —— 先提供 Logger，再提供 Database，最后提供 Email。

### 4. 运行

```typescript
// 方式 A: 直接 provide
Effect.runSync(pipe(program, Effect.provide(AppLayer)))

// 方式 B: ManagedRuntime (opencode 标准用法)
const runtime = ManagedRuntime.make(AppLayer)
await runtime.runPromise(main)
await runtime.dispose()
```

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `Context.GenericTag` | `packages/effect/src/context.ts` | 创建服务标识，每个服务有唯一 key |
| `Layer.effect` | `packages/effect/src/layer.ts` | 创建依赖其他服务的层 |
| `Layer.succeed` | `packages/effect/src/layer.ts` | 创建无依赖的层 |
| `Layer.provideMerge` | `packages/effect/src/layer.ts` | 组合层，同时合并输出 |
| `Layer.mergeAll` | `packages/effect/src/layer.ts` | 合并多个层（无依赖关系时用） |
| `ManagedRuntime` | `packages/effect/src/managed-runtime.ts` | 管理运行时生命周期 |

## 调试指导

1. 在 `01-services-and-layers/index.ts` 中设断点：
   - `Effect.gen` 内部的 `yield* LoggerService` —— 观察依赖注入
   - `Layer.effect` 的回调 —— 观察层构建

2. Step Into 到 `Context.GenericTag` 可以观察 Effect 如何管理服务上下文

3. 启动调试：
   - VS Code: 按 F5，选择 "Debug Current Example (Bun)"
   - 或：`bun --inspect-brk run examples/01-services-and-layers/index.ts`
