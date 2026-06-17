import { Effect, ScopedCache, Scope, Console } from "effect"

// ============================================================
// 12 - InstanceState.make() 模式
// 演示使用 ScopedCache 实现「每个实例一份缓存状态」
// 类似 opencode 中 InstanceState 的设计：
//   以目录/ID 为 key，按需初始化，自动失效
// ============================================================

// ---- 1. 定义 InstanceState 接口 ----

interface InstanceState<A, E = never, R = never> {
  readonly get: (key: string) => Effect.Effect<A, E, R | Scope.Scope>
  readonly invalidate: (key: string) => Effect.Effect<void>
  readonly invalidateAll: Effect.Effect<void>
}

// ---- 2. 实现 InstanceState.make ----

const make = <A, E = never, R = never>(
  init: (key: string) => Effect.Effect<A, E, R | Scope.Scope>,
): Effect.Effect<InstanceState<A, E, R>, never, R | Scope.Scope> =>
  Effect.gen(function* () {
    const cache = yield* ScopedCache.make<string, A, E, R>({
      capacity: Number.POSITIVE_INFINITY,
      timeToLive: "1 minute",
      lookup: (key) => init(key),
    })
    return {
      get: (key) => cache.get(key),
      invalidate: (key) => cache.invalidate(key),
      get invalidateAll() { return cache.invalidateAll },
    }
  })

// ---- 3. 使用示例：每个项目实例一个配置 + 计数器 ----

interface ProjectConfig {
  readonly project: string
  readonly createdAt: Date
  readonly counter: number
}

let globalCounter = 0

const ProjectState = make<ProjectConfig>(
  (projectName) =>
    Effect.gen(function* () {
      const count = ++globalCounter
      console.log(`  [init] Creating state for "${projectName}" (init #${count})`)
      return {
        project: projectName,
        createdAt: new Date(),
        counter: count,
      }
    }),
)

const demo = Effect.scoped(
  Effect.gen(function* () {
    const state = yield* ProjectState

    // 第一次 get —— 触发初始化
    console.log("\n--- 1. First access (triggers init) ---")
    const a1 = yield* state.get("project-alpha")
    console.log(`  alpha: ${a1.project}, counter=${a1.counter}, created=${a1.createdAt.toISOString()}`)

    // 第二次 get 同一 key —— 命中缓存，不会再次 init
    console.log("\n--- 2. Second access (cache hit) ---")
    const a2 = yield* state.get("project-alpha")
    console.log(`  alpha: ${a2.project}, counter=${a2.counter}, created=${a2.createdAt.toISOString()}`)
    console.log(`  Same instance? ${a1 === a2}`)

    // 另一个 key —— 触发新的 init
    console.log("\n--- 3. Different key (triggers new init) ---")
    const b1 = yield* state.get("project-beta")
    console.log(`  beta: ${b1.project}, counter=${b1.counter}`)

    // 失效后重新 get —— 再次 init
    console.log("\n--- 4. After invalidate (re-inits) ---")
    yield* state.invalidate("project-alpha")
    console.log("  invalidated project-alpha")
    const a3 = yield* state.get("project-alpha")
    console.log(`  alpha: ${a3.project}, counter=${a3.counter}, created=${a3.createdAt.toISOString()}`)

    // 全部失效
    console.log("\n--- 5. Invalidate all ---")
    yield* state.invalidateAll
    console.log("  invalidated all")
    const a4 = yield* state.get("project-alpha")
    console.log(`  alpha: ${a4.project}, counter=${a4.counter}`)
    const b2 = yield* state.get("project-beta")
    console.log(`  beta: ${b2.project}, counter=${b2.counter}`)

    console.log("\n✅ 示例 12 完成：InstanceState.make() 模式正常工作")
  }),
)

await Effect.runPromise(demo)
