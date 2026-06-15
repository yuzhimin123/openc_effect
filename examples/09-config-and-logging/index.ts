import { Effect, Console, Config, ConfigProvider, Logger, LogLevel } from "effect"
import { pipe } from "effect/Function"

// ============================================================
// 09 - Configuration & Logging
// 模仿 opencode 的配置与日志模式
// opencode 参考:
//   - packages/opencode/src/effect/bootstrap-runtime.ts (配置)
//   - packages/core/src/effect/logger.ts (日志)
// ============================================================

// --- 1. 定义配置 Schema ---

interface AppConfig {
  readonly host: string
  readonly port: number
  readonly dbUrl: string
  readonly debug: boolean
  readonly adminEmails: ReadonlyArray<string>
}

const appConfig: Config.Config<AppConfig> = Config.all({
  host: Config.string("host").pipe(Config.withDefault("localhost")),
  port: Config.integer("port").pipe(Config.withDefault(3000)),
  dbUrl: Config.string("db_url"),
  debug: Config.boolean("debug").pipe(Config.withDefault(false)),
  adminEmails: Config.array(Config.string(), "admin_emails").pipe(
    Config.withDefault(["admin@example.com"]),
  ),
})

// --- 2. 加载配置 (直接使用 provider.load) ---

const configData = {
  host: "0.0.0.0",
  port: 8080,
  db_url: "sqlite://./app.db",
  debug: true,
  admin_emails: ["admin@example.com", "root@example.com"],
}

const CustomProvider = ConfigProvider.fromJson(configData)

const configDemo = Effect.gen(function* () {
  const config = yield* CustomProvider.load(appConfig)
  console.log("Loaded config:", JSON.stringify(config, null, 2))
  return config
})

// --- 3. 自定义 Logger ---

const customLogger = Logger.make((log) => {
  const level = log.logLevel.label.padEnd(5)
  console.log(`[${level}] ${log.message}`)
})

const loggerDemo = pipe(
  Effect.gen(function* () {
    yield* Effect.log("This is an info message")
    yield* Effect.logWarning("This is a warning")
    yield* Effect.logError("This is an error")
    yield* Effect.logDebug("This debug message may be filtered")
  }),
  Effect.provide(Logger.replace(Logger.defaultLogger, customLogger)),
  Effect.provide(Logger.minimumLogLevel(LogLevel.Debug)),
)

// --- 4. Config + Logger 组合 ---

const combinedDemo = pipe(
  Effect.gen(function* () {
    const config = yield* CustomProvider.load(appConfig)
    yield* Effect.log(`Server starting on ${config.host}:${config.port}`)
    yield* Effect.log(`Database: ${config.dbUrl}`)
    yield* Effect.log(`Debug mode: ${config.debug}`)
    return config
  }),
  Effect.provide(Logger.replace(Logger.defaultLogger, customLogger)),
  Effect.provide(Logger.minimumLogLevel(LogLevel.Info)),
)

// --- 主程序 ---

const program = Effect.gen(function* () {
  console.log("=== 1. 配置加载 ===")
  yield* configDemo

  console.log("\n=== 2. 自定义 Logger ===")
  yield* loggerDemo

  console.log("\n=== 3. Config + Logger 组合 ===")
  yield* combinedDemo
})

await Effect.runPromise(program)
console.log("\n✅ 示例 09 完成：Configuration & Logging 正常工作")
