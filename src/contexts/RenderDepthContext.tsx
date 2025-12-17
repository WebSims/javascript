import { createContext, useContext } from 'react'

export const RenderDepthContext = createContext<number>(0)

export const useRenderDepth = () => useContext(RenderDepthContext)

