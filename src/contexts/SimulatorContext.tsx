import { createContext, useState, useEffect, useRef } from "react"
import { astOf } from "@/utils/ast"
import { cheatSheetHighlighter } from "@/utils/cheatSheetHighlighter"
import { ESNode } from "hermes-parser"
import * as ts from "typescript"
import { ExecStep } from "@/types/simulation"
import { simulateExecution } from "@/utils/simulator"

// Represents a single scope's memory (e.g., global, function scope)
// Values can be primitives or references to other objects/arrays/functions


type SimulatorContextType = {
    mode: 'CODE' | 'EXECUTION'
    setMode: (mode: 'CODE' | 'EXECUTION') => void
    codeStr: string
    updateCodeStr: (codeStr: string) => void
    astOfCode: ESNode | ts.SourceFile | null
    execSteps: ExecStep[]
    currentExecStep: ExecStep | null
    isPlaying: boolean
    togglePlaying: (state?: boolean) => void
    stepForward: () => void
    stepBackward: () => void
    changeStep: (index: number) => void
    resetSimulation: () => void
    totalSteps: number
    codeAreaRef: React.RefObject<HTMLDivElement>
    cheatSheetRef: React.RefObject<HTMLDivElement>
    setSpeed: (speed: number) => void
    highlightedId: string | null
}

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined)

export const SimulatorProvider = ({ children }: { children: React.ReactNode }) => {
    const [mode, setMode] = useState<'CODE' | 'EXECUTION'>('CODE')
    const [codeStr, setCodeStr] = useState<string>("")
    const [astOfCode, setAstOfCode] = useState<ESNode | ts.SourceFile | null>(astOf(codeStr))
    const [execSteps, setExecSteps] = useState<ExecStep[]>([])
    const [currentExecStep, setCurrentExecStep] = useState<ExecStep | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [speed, setSpeed] = useState(2)
    const [highlightedId, setHighlightedId] = useState<string | null>(null)

    const codeAreaRef = useRef<HTMLDivElement>(null)
    const cheatSheetRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const cleanup = cheatSheetHighlighter(codeAreaRef, cheatSheetRef, setHighlightedId)
        return cleanup
    }, [astOfCode])

    const totalSteps = execSteps.length

    const updateCodeStr = (newCodeStr: string) => {
        setCodeStr(newCodeStr)
        try {
            const ast = astOf(newCodeStr)
            if (ast) {
                const steps = simulateExecution(ast as ESNode)
                console.log(steps)
                setAstOfCode(ast)
                setExecSteps(steps)
                setCurrentExecStep(steps[0])
            } else {
                setAstOfCode(null)
                setExecSteps([])
                setCurrentExecStep(null)
            }
        } catch (error) {
            console.error("Error parsing code:", error)
            setAstOfCode(null)
            setExecSteps([])
            setCurrentExecStep(null)
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
        const currentIndex = currentExecStep?.index ?? -1
        if (currentIndex < totalSteps - 1) {
            const nextIndex = currentIndex + 1
            setCurrentExecStep(execSteps[nextIndex])
        } else {
            setIsPlaying(false)
        }
    }

    const stepBackward = () => {
        const currentIndex = currentExecStep?.index ?? 0
        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1
            setCurrentExecStep(execSteps[prevIndex])
        }
    }

    const changeStep = (index: number) => {
        if (index >= 0 && index < totalSteps) {
            setCurrentExecStep(execSteps[index])
        }
    }

    const resetSimulation = () => {
        setCurrentExecStep(execSteps[0] ?? null)
        togglePlaying(false)
    }

    useEffect(() => {
        let interval: NodeJS.Timeout | undefined

        if (isPlaying && totalSteps > 0) {
            interval = setInterval(() => {
                stepForward()
            }, 1000 / speed)
        } else {
            setIsPlaying(false)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isPlaying, speed, currentExecStep, totalSteps])

    return (
        <SimulatorContext.Provider
            value={{
                mode,
                setMode,
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
                resetSimulation,
                totalSteps,
                codeAreaRef,
                cheatSheetRef,
                setSpeed,
                highlightedId
            }}
        >
            {children}
        </SimulatorContext.Provider >
    )
}

export default SimulatorContext