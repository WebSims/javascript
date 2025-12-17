import { createContext, useContext } from 'react'
import type { ExecStep } from '@/types/simulator'

export type ScopedStepState = {
    step: ExecStep | null
    startIndex: number
}

export const ScopedStepContext = createContext<ScopedStepState>({ step: null, startIndex: 0 })

export const useScopedStep = () => useContext(ScopedStepContext)


