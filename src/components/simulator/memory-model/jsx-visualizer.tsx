import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { useJsxVisualization } from "@/hooks/useJsxVisualization"
import { useMemoryDimensions } from "@/hooks/useMemoryDimensions"
import { ArcherContainer } from "react-archer"
import MemVal from "./components/MemVal"
import Heap from "./components/Heap"
import Scope from "./components/Scope"
import useElementSize from "@/hooks/useElementSize"
import { useResponsive } from "@/hooks/useResponsive"

const LAYOUT_CONFIG = {
    containerPadding: {
        mobile: 2,
        desktop: 8
    },
    componentGap: {
        mobile: 4,
        desktop: 8
    }
}

export const JsxVisualizer = () => {
    const { currentStep, steps } = useSimulatorStore()
    const visualizationData = useJsxVisualization(currentStep, steps)
    const [containerRef, containerSize] = useElementSize<HTMLDivElement>()
    const { isDesktop } = useResponsive()

    const endShape = {
        arrow: {
            arrowLength: isDesktop ? 7 : 6,
            arrowThickness: isDesktop ? 5 : 5,
        },
    }

    const containerPadding = isDesktop ? LAYOUT_CONFIG.containerPadding.desktop : LAYOUT_CONFIG.containerPadding.mobile
    const componentGap = isDesktop ? LAYOUT_CONFIG.componentGap.desktop : LAYOUT_CONFIG.componentGap.mobile

    const containerWidth = containerSize.width || 0
    const containerHeight = containerSize.height || 0

    // Use the memory dimensions hook to calculate virtual dimensions
    const dimensions = useMemoryDimensions(
        currentStep, 
        steps, 
        containerHeight,
        containerWidth,
        containerPadding,
        componentGap
    )

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

    // Debug: Log calculated dimensions from the hook
    console.log('Calculated dimensions:', dimensions)

    return (
        <div
            ref={containerRef}
            className="relative bg-gray-100 font-mono text-sm h-full w-full overflow-auto"
            style={{ padding: `${containerPadding}px` }}
        >
            <ArcherContainer
                className="h-full w-full"
                strokeColor="#9333ea"
                strokeWidth={2}
                endMarker={true}
                endShape={endShape}
                svgContainerStyle={{
                    width: containerWidth,
                    height: dimensions.maxContainerHeight,
                    zIndex: 1
                }}
            >
                <div
                    className="absolute"
                    style={{
                        left: `${dimensions.memval.x}px`,
                        top: `${dimensions.memval.y}px`,
                        width: `${dimensions.memval.w}px`,
                        height: `${dimensions.memval.h}px`
                    }}
                >
                    <MemVal memval={memval} />
                </div>
                <div
                    className="absolute"
                    style={{
                        left: `${dimensions.heap.x}px`,
                        top: `${dimensions.heap.y}px`,
                        width: `${dimensions.heap.w}px`,
                        height: `${dimensions.heap.h}px`
                    }}
                >
                    <Heap heap={heap} />
                </div>
                <div
                    className="absolute"
                    style={{
                        left: `${dimensions.scope.x}px`,
                        top: `${dimensions.scope.y}px`,
                        width: `${dimensions.scope.w}px`,
                        height: `${dimensions.scope.h}px`
                    }}
                >
                    <Scope scopes={scopes} />
                </div>
            </ArcherContainer>
        </div>
    )
}

export default JsxVisualizer


