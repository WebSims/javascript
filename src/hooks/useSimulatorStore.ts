import { useContext } from "react"
import SimulatorContext from "@/contexts/SimulatorContext"

export const useSimulatorStore = () => {
    const context = useContext(SimulatorContext)
    if (!context) {
        throw new Error("useSimulatorStore must be used within a SimulatorProvider")
    }
    return context
}