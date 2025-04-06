import { createContext, useState } from "react"
import { astOf } from "@/utils/ast"
import { ESNode } from "hermes-parser"
type SimulatorContextType = {
    execSteps: ExecStep[]
    currentExecStep: ExecStep | null
    codeStr: string
    astOfCode: ESNode | null
    updateCodeStr: (codeStr: string) => void
}

type ExecStep = {
    code: string
    output: string
    memory: Record<string, unknown>
    error: string
}

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined)

export const SimulatorProvider = ({ children }: { children: React.ReactNode }) => {
    const [codeStr, setCodeStr] = useState<string>("")
    const [astOfCode, setAstOfCode] = useState<ESNode | null>(astOf(codeStr))
    const [execSteps, setExecSteps] = useState<ExecStep[]>([])
    const [currentExecStep, setCurrentExecStep] = useState<ExecStep | null>(null)

    const updateCodeStr = (codeStr: string) => {
        setCodeStr(codeStr)
        const ast = astOf(codeStr)
        if (ast) {
            setAstOfCode(ast)
        }
    }

    return (
        <SimulatorContext.Provider
            value={{
                execSteps,
                currentExecStep,
                codeStr,
                astOfCode,
                updateCodeStr
            }}
        >
            {children}
        </SimulatorContext.Provider >
    )
}

export default SimulatorContext