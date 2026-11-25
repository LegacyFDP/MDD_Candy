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

  // The signed-in user, looked up by the server from the request's session
  // token (see backend/fete/sessions.ts). Null only for loginUser and when a
  // handler is called directly, e.g. from tests. `role` is one of
  // 'superuser' | 'admin' | 'store keeper' | 'user'.
  type User = {
    id: number
    name: string
    email: string
    role: string
  } | null
}

export {}
