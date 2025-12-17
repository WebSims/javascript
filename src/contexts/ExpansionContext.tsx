import { createContext, useContext, ReactNode } from "react"

type ExpansionContextType = {
    isInsideExpansion: boolean
}

export const ExpansionContext = createContext<ExpansionContextType>({ isInsideExpansion: false })

export const ExpansionProvider = ({ children }: { children: ReactNode }) => {
    return (
        <ExpansionContext.Provider value={{ isInsideExpansion: true }}>
            {children}
        </ExpansionContext.Provider>
    )
}

export const useExpansionContext = () => {
    return useContext(ExpansionContext)
}

