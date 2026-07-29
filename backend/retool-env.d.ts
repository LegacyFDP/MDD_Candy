// Ambient declarations that replace the globals Retool injected at runtime.
// These let the existing backend/fete/*.ts functions type-check and run
// unchanged outside Retool. The actual `retoolDb` value is provided at
// startup by the server (see server/src/index.ts), backed by the pg driver.

declare global {
  interface RetoolQueryResult<T> {
    data: T[]
  }

  const retoolDb: {
    query<T = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ): Promise<RetoolQueryResult<T>>
  }

  // The server forwards the signed-in app user via request headers so backend
  // handlers can enforce role-based access checks.
  type User = {
    id: number
    name: string
    email: string
    role: string
  } | null
}

export {}
