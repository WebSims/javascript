import { createContext, useContext } from "react"

export type ScopeOverlay = {
  // For a given AST node range key (e.g. BlockStatement range),
  // there may be multiple active scopes (recursive calls share the same range).
  // We store all active depth indices so the UI can render nested boxes.
  scopeDepthsByKey: Record<string, number[]>
}

const ScopeOverlayContext = createContext<ScopeOverlay>({
  scopeDepthsByKey: {},
})

export const useScopeOverlay = () => useContext(ScopeOverlayContext)

export default ScopeOverlayContext


