import { createContext, useContext } from 'react'

export const ExecutionUiContext = createContext<boolean>(true)

export const useExecutionUiEnabled = () => useContext(ExecutionUiContext)


