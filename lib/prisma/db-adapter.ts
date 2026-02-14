import { prisma } from "./client";

/**
 * Exdates come from the DB as a JSON string (SQLite).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExdatesRaw = Date[] | string | any;

// ---------------------------------------------------------------------------
// Exdates helpers – SQLite stores exdates as a JSON string
// ---------------------------------------------------------------------------

/**
 * Deserialize exdates from the database value.
 * SQLite returns a JSON string of ISO timestamps.
 */
export function deserializeExdates(raw: ExdatesRaw): Date[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return (parsed as string[]).map((d: string) => new Date(d));
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Serialize an array of Dates for storage as a JSON string.
 */
export function serializeExdates(dates: Date[]): string {
  return JSON.stringify(dates.map((d) => d.toISOString()));
}

/**
 * Return the value to use when clearing exdates.
 */
export function emptyExdates(): string {
  return "[]";
}

/**
 * Append dates to a todo's exdates field.
 * Reads the current value, appends, and writes back.
 */
export async function pushExdates(
  todoId: string,
  dates: Date[],
): Promise<void> {
  const todo = await prisma.todo.findUniqueOrThrow({
    where: { id: todoId },
    select: { exdates: true },
  });
  const current = deserializeExdates(todo.exdates);
  const updated = [...current, ...dates];
  await prisma.todo.update({
    where: { id: todoId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { exdates: serializeExdates(updated) as any },
  });
}

// ---------------------------------------------------------------------------
// Reorder helper – individual updates in a transaction
// ---------------------------------------------------------------------------

/**
 * Bulk-update todo ordering using individual updates in a transaction.
 */
export async function reorderTodos(
  changeMap: { id: string; order: number }[],
): Promise<number> {
  const results = await prisma.$transaction(
    changeMap.map((t) =>
      prisma.todo.update({
        where: { id: t.id },
        data: { order: t.order },
      }),
    ),
  );
  return results.length;
}

// ---------------------------------------------------------------------------
// Auto-increment order helper for SQLite
// ---------------------------------------------------------------------------

/**
 * Get the next order value for a new todo.
 * Computes max(order) + 1.
 */
export async function getNextTodoOrder(
  userId: string,
): Promise<number> {
  const result = await prisma.todo.aggregate({
    where: { userID: userId },
    _max: { order: true },
  });
  return (result._max.order ?? 0) + 1;
}
