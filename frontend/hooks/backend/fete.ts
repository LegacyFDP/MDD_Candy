import { useCallback, useState } from 'react'

// Base path for the API. In dev, Vite proxies /api to the Node server; in
// production the same Node server serves both the API and these static files.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

// --- Sign-in session --------------------------------------------------------
// loginUser returns a token; every later call sends it so the server knows who
// is asking. It is kept in memory only, so reloading the page signs you out
// (as before).
let authToken: string | null = null
let onSessionExpired: (() => void) | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

/** Called when the server says the sign-in has expired, to show the login page. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
}

/** Ends the session on the server and forgets the token. */
export async function signOut() {
  const token = authToken
  authToken = null
  if (!token) return
  try {
    await fetch(`${API_BASE}/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  } catch {
    // Signing out locally is enough; the server session expires on its own.
  }
}

/** POST <params> to /api/<fn> and return the parsed JSON result. */
async function callApi<T>(fn: string, params: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  const res = await fetch(`${API_BASE}/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params ?? {}),
  })

  const text = await res.text()
  const body = text ? JSON.parse(text) : null

  if (res.status === 401 && fn !== 'loginUser') {
    authToken = null
    onSessionExpired?.()
  }

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body && (body as { error?: string }).error) ||
      `Request failed (${res.status})`
    throw new Error(message)
  }
  return body as T
}

export interface BackendHook<TParams, TResult> {
  /** Last successful result, or null before the first call. */
  data: TResult | null
  /** True while a call is in flight. */
  loading: boolean
  /** Last error, or null. */
  error: Error | null
  /** Run the call. Resolves with the result, or throws on failure. */
  trigger: (params?: TParams) => Promise<TResult>
}

/**
 * Builds a hook for a single backend function. Mirrors the shape Retool's
 * generated hooks exposed: { data, loading, error, trigger }.
 */
function makeBackendHook<TParams = Record<string, unknown>, TResult = unknown>(fn: string) {
  return function useBackendHook(): BackendHook<TParams, TResult> {
    const [data, setData] = useState<TResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const trigger = useCallback(async (params?: TParams) => {
      setLoading(true)
      setError(null)
      try {
        const result = await callApi<TResult>(fn, params)
        setData(result)
        return result
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    }, [])

    return { data, loading, error, trigger }
  }
}

// --- One hook per backend function (backend/fete/<name>.ts) ----------------

// Auth
export const useLoginUser = makeBackendHook('loginUser')

// Assets
export const useGetAssets = makeBackendHook('getAssets')
export const useSaveAsset = makeBackendHook('saveAsset')
export const useDeleteAsset = makeBackendHook('deleteAsset')
export const useGetAssetCategories = makeBackendHook('getAssetCategories')
export const useSaveAssetCategory = makeBackendHook('saveAssetCategory')
export const useDeleteAssetCategory = makeBackendHook('deleteAssetCategory')

// Locations
export const useGetLocations = makeBackendHook('getLocations')
export const useSaveLocation = makeBackendHook('saveLocation')
export const useArchiveLocation = makeBackendHook('archiveLocation')
export const useDeleteLocation = makeBackendHook('deleteLocation')
export const useGetStorageAreas = makeBackendHook('getStorageAreas')
export const useSaveStorageArea = makeBackendHook('saveStorageArea')
export const useDeleteStorageArea = makeBackendHook('deleteStorageArea')

// Fete locations (event venues in store_locations where location_type='Fetes')
export const useGetFeteLocations = makeBackendHook('getFeteLocations')
export const useSaveFeteLocation = makeBackendHook('saveFeteLocation')
export const useDeleteFeteLocation = makeBackendHook('deleteFeteLocation')

// Fetes
export const useGetFetes = makeBackendHook('getFetes')
export const useSaveFete = makeBackendHook('saveFete')
export const useArchiveFete = makeBackendHook('archiveFete')
export const useDeleteFete = makeBackendHook('deleteFete')

// Withdrawals
export const useGetWithdrawals = makeBackendHook('getWithdrawals')
export const useGetFeteWithdrawals = makeBackendHook('getFeteWithdrawals')
export const useBookAsset = makeBackendHook('bookAsset')
export const useConvertBookingToOut = makeBackendHook('convertBookingToOut')
export const useWithdrawAsset = makeBackendHook('withdrawAsset')
export const useReturnAsset = makeBackendHook('returnAsset')

// People (one record per person, with roles)
export const useGetPeople = makeBackendHook('getPeople')
export const useSavePerson = makeBackendHook('savePerson')
export const useDeletePerson = makeBackendHook('deletePerson')
export const useMergePeople = makeBackendHook('mergePeople')

// Users
export const useGetUsers = makeBackendHook('getUsers')
// Volunteers
export const useGetVolunteers = makeBackendHook('getVolunteers')
export const useGetVolunteerShifts = makeBackendHook('getVolunteerShifts')
export const useSaveVolunteerShift = makeBackendHook('saveVolunteerShift')
export const useDeleteVolunteerShift = makeBackendHook('deleteVolunteerShift')

// Fete requirements
export const useGetFeteRequirements = makeBackendHook('getFeteRequirements')
export const useGetFeteAssetPickList = makeBackendHook('getFeteAssetPickList')
export const useSaveFeteRequirement = makeBackendHook('saveFeteRequirement')
export const useDeleteFeteRequirement = makeBackendHook('deleteFeteRequirement')
