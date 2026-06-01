import type { Metadata } from 'next'
import { Suspense } from 'react'
import AuthPage from './AuthPage'

export const metadata: Metadata = {
  title: 'Sign In — Ledgr',
  description: 'Log in or create a Ledgr account.',
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthPage />
    </Suspense>
  )
}
