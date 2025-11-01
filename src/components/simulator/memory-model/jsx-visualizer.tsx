import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { useJsxVisualization } from "@/hooks/useJsxVisualization"
import { ArcherContainer } from "react-archer"
import MemVal from "./components/MemVal"
import Heap from "./components/Heap"
import Scope from "./components/Scope"

export const JsxVisualizer = () => {
    const { currentStep, steps } = useSimulatorStore()
    const visualizationData = useJsxVisualization(currentStep, steps)

    if (!visualizationData) {
        return (
            <div className="flex items-center justify-center h-full">
                <p>Loading visualization...</p>
            </div>
        )
    }

    const { memval, heap, scopes } = visualizationData

    // Debug: Log IDs and references
    console.log('Memval items:', memval.map(m => ({ id: m.id, targetRef: m.targetRef })))
    console.log('Heap objects:', heap.map(h => ({
        id: h.id,
        referencedBy: h.referencedBy,
        properties: h.properties?.map(p => ({ name: p.name, targetRef: p.targetRef }))
    })))
    console.log('Scope variables:', scopes.map(s => ({
        id: s.id,
        variables: s.variables.map(v => ({ name: v.name, targetRef: v.targetRef }))
    })))

    return (
        <ArcherContainer
            className="h-full"
            strokeColor="#9333ea"
            strokeWidth={2}
            endMarker={true}
            svgContainerStyle={{
                zIndex: 0
            }}
        >
            <div className="flex space-x-4 p-4 bg-gray-100 font-mono text-sm h-full">
                <MemVal memval={memval} />
                <Heap heap={heap} />
                <Scope scopes={scopes} />
            </div>
        </ArcherContainer>
    )
}

export default JsxVisualizer


