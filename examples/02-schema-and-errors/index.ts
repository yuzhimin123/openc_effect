import { Effect, Console, Schema } from "effect"
import { pipe } from "effect/Function"

// ============================================================
// 02 - Schema & Tagged Errors
// 模仿 opencode 的数据建模与类型安全错误模式
// opencode 参考: packages/core/src/event.ts, packages/core/src/database/
// ============================================================

// --- 1. Branded Types ---
// opencode 大量使用品牌类型: Event.ID, Session.ID, Cursor 等

const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = Schema.Schema.Type<typeof UserId>

const Email = Schema.String.pipe(
  Schema.pattern(/^[^@]+@[^@]+\.[^@]+$/),
  Schema.brand("Email"),
)
type Email = Schema.Schema.Type<typeof Email>

// --- 2. 数据模型 Schema ---

const UserSchema = Schema.Struct({
  id: UserId,
  name: Schema.String,
  email: Email,
  age: Schema.Number,
  isActive: Schema.Boolean,
})
type User = Schema.Schema.Type<typeof UserSchema>

// --- 3. Tagged Errors (类型安全错误) ---
// opencode 核心模式

class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  field: Schema.String,
  message: Schema.String,
}) {}

class NotFoundError extends Schema.TaggedError<NotFoundError>()("NotFoundError", {
  entityType: Schema.String,
  entityId: Schema.String,
}) {}

// --- 4. Schema 解析 (parse/decode/encode) ---

const rawData = {
  id: "user_001",
  name: "Alice",
  email: "alice@example.com",
  age: 30,
  isActive: true,
}

const parseUser = Schema.decodeUnknown(UserSchema)
const result = Effect.runSync(parseUser(rawData))
console.log("Parsed user:", result)

const encodeUser = Schema.encode(UserSchema)
const encoded = Effect.runSync(encodeUser(result))
console.log("Encoded user:", encoded)

// --- 5. Schema + TaggedError 的业务逻辑 ---

const findUser = (id: string): Effect.Effect<User, NotFoundError | ValidationError> =>
  pipe(
    // 先验证 ID 格式
    Effect.succeed(id),
    Effect.flatMap((raw) => {
      if (!raw.startsWith("user_")) {
        return Effect.fail(new ValidationError({ field: "id", message: `Invalid format: ${raw}` }))
      }
      return Effect.succeed(raw as UserId)
    }),
    Effect.flatMap((validId) => {
      if (validId === "user_001") {
        return Schema.decodeUnknown(UserSchema)({
          id: "user_001",
          name: "Alice",
          email: "alice@example.com",
          age: 30,
          isActive: true,
        })
      }
      return Effect.fail(new NotFoundError({ entityType: "User", entityId: validId }))
    }),
  )

const program = Effect.gen(function* () {
  // 成功场景
  const user1 = yield* findUser("user_001")
  console.log(`Found user ${user1.name}, age: ${user1.age}`)

  // 格式错误 -> catchTag("ValidationError")
  yield* findUser("bad-id").pipe(
    Effect.catchTag("ValidationError", (err) => {
      console.log(`Caught ValidationError: ${err.field} - ${err.message}`)
      return Effect.succeed(null)
    }),
    Effect.catchTag("NotFoundError", (err) => {
      console.log(`Caught NotFoundError: ${err.entityType}#${err.entityId}`)
      return Effect.succeed(null)
    }),
  )

  // 未找到 -> catchTag("NotFoundError")
  yield* findUser("user_999").pipe(
    Effect.catchTag("ValidationError", (err) => {
      console.log(`Caught ValidationError: ${err.field} - ${err.message}`)
      return Effect.succeed(null)
    }),
    Effect.catchTag("NotFoundError", (err) => {
      console.log(`Caught NotFoundError: ${err.entityType}#${err.entityId}`)
      return Effect.succeed(null)
    }),
  )
})

Effect.runSync(program)
console.log("\n✅ 示例 02 完成：Schema & Tagged Errors 正常工作")
