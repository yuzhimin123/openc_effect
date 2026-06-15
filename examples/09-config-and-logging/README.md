# 09 - Configuration & Logging (配置与日志)

## 功能描述

演示 Effect 的配置管理和日志系统：Config 类型安全配置加载、ConfigProvider 数据源、自定义 Logger。opencode 中使用相同模式加载应用配置和自定义日志输出。

## 运行

```bash
bun run examples/09-config-and-logging/index.ts
```

## 关键代码分析

### 1. 配置定义

```typescript
const appConfig: Config.Config<AppConfig> = Config.all({
  host: Config.string("host").pipe(Config.withDefault("localhost")),
  port: Config.integer("port").pipe(Config.withDefault(3000)),
  dbUrl: Config.string("db_url"),
  debug: Config.boolean("debug").pipe(Config.withDefault(false)),
})
```

`Config.all` 组合多个配置项为单一结构，每个字段可设默认值。

### 2. 配置加载

```typescript
const CustomProvider = ConfigProvider.fromJson(configData)
const config = yield* CustomProvider.load(appConfig)
```

`ConfigProvider.fromJson` 从 JSON 对象创建配置数据源，`load` 方法加载配置。

### 3. 自定义 Logger

```typescript
const customLogger = Logger.make((log) => {
  const level = log.logLevel.label.padEnd(5)
  console.log(`[${level}] ${log.message}`)
})
```

`Logger.make` 创建自定义日志处理器。

### 4. 替换 Logger

```typescript
Effect.provide(Logger.replace(Logger.defaultLogger, customLogger))
Effect.provide(Logger.minimumLogLevel(LogLevel.Debug))
```

`Logger.replace` 替换默认 Logger，`Logger.minimumLogLevel` 设置最低日志级别。

## Effect 源码剖析

| 使用的 API | 源码位置 | 说明 |
|---|---|---|
| `Config.all` | `packages/effect/src/config.ts` | 组合配置项 |
| `Config.string/integer` | `packages/effect/src/config.ts` | 基础类型配置项 |
| `Config.withDefault` | `packages/effect/src/config.ts` | 默认值 |
| `ConfigProvider.fromJson` | `packages/effect/src/config-provider.ts` | JSON 配置源 |
| `Logger.make` | `packages/effect/src/logger.ts` | 创建 Logger |
| `Logger.replace` | `packages/effect/src/logger.ts` | 替换默认 Logger |
| `Logger.minimumLogLevel` | `packages/effect/src/logger.ts` | 最低日志级别 |

## 调试指导

1. 断点建议：
   - `CustomProvider.load(appConfig)` —— 观察配置加载流程
   - `Logger.make` 的回调 —— 观察日志输出
   - `Logger.replace` —— 观察 Logger 替换机制

2. `Effect.log` 系列函数 (`log`, `logWarning`, `logError`, `logDebug`) 自动添加时间戳和 Fiber ID 等信息

3. Step Into `ConfigProvider.load` 可以观察 Effect 的配置解析机制
