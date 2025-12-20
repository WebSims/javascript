import { createContext, useContext } from "react"
import type { CallFrame } from "@/hooks/useFunctionCallStack"

export type ActiveCallFrameState = {
  activeFrame: CallFrame | null
}

const ActiveCallFrameContext = createContext<ActiveCallFrameState>({ activeFrame: null })

export const useActiveCallFrame = () => useContext(ActiveCallFrameContext)

export default ActiveCallFrameContext


