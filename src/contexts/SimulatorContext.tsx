import { createContext, useState, useEffect } from "react"
import { astOf } from "@/utils/ast"
import { ESNode } from "hermes-parser"
type SimulatorContextType = {
    codeStr: string
    updateCodeStr: (codeStr: string) => void
    astOfCode: ESNode | null
    execSteps: ExecStep[]
    currentExecStep: ExecStep | null
    isPlaying: boolean
    togglePlaying: (state?: boolean) => void
    stepForward: () => void
    stepBackward: () => void
    changeStep: (index: number) => void
    totalSteps: number
}

type ExecStep = {
    index: number
    code: string
    output: string
    memory: Record<string, unknown>
    error: string
}

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined)

export const SimulatorProvider = ({ children }: { children: React.ReactNode }) => {
    const [codeStr, setCodeStr] = useState<string>("")
    const [astOfCode, setAstOfCode] = useState<ESNode | null>(astOf(codeStr))
    const [execSteps, setExecSteps] = useState<ExecStep[]>(Array.from({ length: 100 }, (_, i) => ({
        index: i,
        code: "",
        output: "",
        memory: {},
        error: ""
    })))
    const [currentExecStep, setCurrentExecStep] = useState<ExecStep | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [speed, setSpeed] = useState(1)

    const totalSteps = execSteps.length

    const updateCodeStr = (codeStr: string) => {
        setCodeStr(codeStr)
        const ast = astOf(codeStr)
        if (ast) {
            setAstOfCode(ast)
        }
    }

    const togglePlaying = (state?: boolean) => {
        if (state !== undefined) {
            setIsPlaying(state)
        } else {
            setIsPlaying(!isPlaying)
        }
    }

    const stepForward = () => {
        const currentIndex = currentExecStep?.index ?? 0
        if (currentIndex < totalSteps - 1) {
            const nextStep = currentIndex + 1
            setCurrentExecStep(execSteps[nextStep])
        }
    }

    const stepBackward = () => {
        const currentIndex = currentExecStep?.index ?? 0
        if (currentIndex > 0) {
            const prevStep = currentIndex - 1
            setCurrentExecStep(execSteps[prevStep])
        }
    }

    const changeStep = (index: number) => {
        setCurrentExecStep(execSteps[index])
    }

    useEffect(() => {
        let interval: NodeJS.Timeout

        if (isPlaying) {
            interval = setInterval(() => {
                const currentIndex = currentExecStep?.index ?? 0
                if (currentIndex < totalSteps - 1) {
                    const nextStep = currentIndex + 1
                    setCurrentExecStep(execSteps[nextStep])
                } else {
                    togglePlaying(false)
                }
            }, 1000 / speed)
        }

        return () => clearInterval(interval)
    }, [isPlaying, totalSteps, speed, currentExecStep])

    return (
        <SimulatorContext.Provider
            value={{
                codeStr,
                updateCodeStr,
                astOfCode,
                execSteps,
                currentExecStep,
                isPlaying,
                togglePlaying,
                stepForward,
                stepBackward,
                changeStep,
                totalSteps
            }}
        >
            {children}
        </SimulatorContext.Provider >
    )
}

export default SimulatorContext