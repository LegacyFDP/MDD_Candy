import { useState } from 'react'
import { useLoginUser } from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'

export type AppUser = { id: number; name: string; email: string; role: string }

interface LoginProps {
  onLogin: (user: AppUser) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const { trigger, loading } = useLoginUser()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    try {
      const result = await trigger({ email: email.trim(), pin: pin.trim() })
      if (result) {
        onLogin(result as AppUser)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault()
      e.currentTarget.requestSubmit()
    }
  }

  return (
    <div className="mdd-login-shell min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm overflow-hidden">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="mdd-mark p-3 rounded-full">
              <img
                src="https://www.medicaldetectiondogs.org.uk/fresco/clients/medicaldetectiondogs/assets/mdd-black.svg"
                alt="Medical Detection Dogs"
                className="mdd-logo"
              />
            </div>
          </div>
          <CardTitle className="text-2xl">Fete Store Manager</CardTitle>
          <CardDescription>Sign in with your email and PIN</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@charity.org"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pin">PIN</Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}>
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {errorMsg && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
          <div className="mdd-login-banner mt-6 -mx-6 -mb-6 px-6 py-5">
            <p className="mdd-login-banner-title">Medical Detection Dogs</p>
            <p className="mdd-login-banner-copy">Saving lives through the power of dogs.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
