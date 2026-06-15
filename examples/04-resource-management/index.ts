import { Effect, Console } from "effect"
import { pipe } from "effect/Function"

// ============================================================
// 04 - Resource Management
// 模仿 opencode 的资源管理模式
// opencode 参考:
//   - packages/core/src/database/sqlite.bun.ts (DB 连接)
//   - packages/opencode/src/util/effect-flock.ts (文件锁)
// ============================================================

// --- 1. 模拟资源 ---

interface FileHandle {
  readonly path: string
  readonly fd: number
  readonly write: (data: string) => Effect.Effect<void>
  readonly close: () => Effect.Effect<void>
}

const openFile = (path: string): Effect.Effect<FileHandle> =>
  Effect.sync(() => {
    console.log(`  [acquire] Opening file: ${path}`)
    const fd = Math.floor(Math.random() * 1000)
    return {
      path,
      fd,
      write: (data) => Console.log(`  [write] ${path}: ${data}`),
      close: () => Console.log(`  [release] Closed ${path} (fd=${fd})`),
    }
  })

interface DbConnection {
  readonly url: string
  readonly query: (sql: string) => Effect.Effect<ReadonlyArray<Record<string, unknown>>>
  readonly disconnect: () => Effect.Effect<void>
}

const connectDb = (url: string): Effect.Effect<DbConnection> =>
  Effect.sync(() => {
    console.log(`  [acquire] Connecting to DB: ${url}`)
    return {
      url,
      query: (sql) => {
        console.log(`  [query] ${sql}`)
        return Effect.succeed([{ result: "ok" }])
      },
      disconnect: () => Console.log(`  [release] Disconnected: ${url}`),
    }
  })

// --- 2. acquireRelease —— 获取资源 + 使用 + 释放 ---

const withFile = (path: string, use: (h: FileHandle) => Effect.Effect<void>) =>
  pipe(
    Effect.acquireRelease(openFile(path), (handle) => handle.close()),
    Effect.flatMap(use),
    Effect.scoped,
  )

const withDb = (url: string, use: (db: DbConnection) => Effect.Effect<void>) =>
  pipe(
    Effect.acquireRelease(connectDb(url), (db) => db.disconnect()),
    Effect.flatMap(use),
    Effect.scoped,
  )

// --- 3. ensuring —— 总是执行清理 ---
// 类似 try/finally, 无论成功或失败都执行

const withEnsuring = pipe(
  Console.log("  [work] Processing data"),
  Effect.ensuring(Console.log("  [ensuring] Close temp files")),
)

const withEnsuringOnError = pipe(
  Console.log("  [work] About to fail"),
  Effect.flatMap(() => Effect.fail("oops")),
  Effect.ensuring(Console.log("  [ensuring] Rollback transaction")),
  Effect.catchAll((err) => Console.log(`  Caught: ${err}`)),
)

// --- 4. 嵌套资源管理 ---
// opencode 中常见的场景: 打开文件 -> 查询数据库 -> 写入文件

const nestedResources = pipe(
  Effect.acquireRelease(openFile("/tmp/report.txt"), (h) => h.close()),
  Effect.flatMap((file) =>
    pipe(
      Effect.acquireRelease(connectDb("sqlite://./report.db"), (db) => db.disconnect()),
      Effect.flatMap((db) =>
        db.query("SELECT COUNT(*) as count FROM users").pipe(
          Effect.flatMap((rows) => file.write(`User count: ${JSON.stringify(rows)}`)),
        ),
      ),
      Effect.scoped,
    ),
  ),
  Effect.scoped,
)

// --- 5. 并发管理多个资源 ---
// 获取两个资源, 并行使用

const parallelResources = pipe(
  Effect.acquireRelease(openFile("/tmp/log1.txt"), (h) => h.close()),
  Effect.flatMap((file1) =>
    pipe(
      Effect.acquireRelease(openFile("/tmp/log2.txt"), (h) => h.close()),
      Effect.flatMap((file2) =>
        Effect.all([
          file1.write("log entry 1"),
          file2.write("log entry 2"),
        ]),
      ),
      Effect.scoped,
    ),
  ),
  Effect.scoped,
)

// --- 主程序 ---

const program = Effect.gen(function* () {
  console.log("=== 1. acquireRelease + scoped (文件) ===")
  yield* withFile("/tmp/test.txt", (h) => h.write("Hello world!"))

  console.log("\n=== 2. acquireRelease + scoped (数据库) ===")
  yield* withDb("sqlite://./app.db", (db) => db.query("SELECT 1").pipe(Effect.map(() => {})))

  console.log("\n=== 3. ensuring (保证清理) ===")
  yield* withEnsuring
  yield* withEnsuringOnError

  console.log("\n=== 4. 嵌套资源 ===")
  yield* nestedResources

  console.log("\n=== 5. 并发资源 ===")
  yield* parallelResources
})

Effect.runSync(program)
console.log("\n✅ 示例 04 完成：Resource Management 正常工作")
