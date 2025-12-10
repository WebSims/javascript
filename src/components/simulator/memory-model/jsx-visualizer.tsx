import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { useJsxVisualization } from "@/hooks/useJsxVisualization"
import { useMemoryDimensions } from "@/hooks/useMemoryDimensions"
import { ArcherContainer } from "react-archer"
import MemVal from "./components/MemVal"
import Heap from "./components/Heap"
import Scope from "./components/Scope"
import useElementSize from "@/hooks/useElementSize"
import { useResponsive } from "@/hooks/useResponsive"

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

    const containerPadding = isDesktop ? 8 : 2
    const componentGap = 8

    const containerWidth = containerSize.width || 0
    const containerHeight = containerSize.height || 0

    const scale = !isDesktop ? 0.65 : 1
    const virtualWidth = containerWidth / scale
    const virtualHeight = containerHeight / scale

    // Use the memory dimensions hook to calculate virtual dimensions
    const dimensions = useMemoryDimensions(
        currentStep,
        steps,
        virtualHeight,
        virtualWidth,
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
    const scaledHeight = dimensions.maxContainerHeight * scale
    
    return (
        <div
            ref={containerRef}
            className="relative bg-gray-100 font-mono text-sm h-full w-full overflow-auto"
            style={{ padding: `${containerPadding}px` }}
        >
            <div style={{ height: `${scaledHeight}px`, width: '100%' }}>
                <ArcherContainer
                    className="h-full w-full"
                    strokeColor="#9333ea"
                    strokeWidth={2}
                    endMarker={true}
                    endShape={endShape}
                    svgContainerStyle={{
                        width: containerWidth,
                        height: scaledHeight,
                        zIndex: 1
                    }}
                >
                    <div
                        style={{
                            width: `${virtualWidth}px`,
                            height: `${dimensions.maxContainerHeight}px`,
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left'
                        }}
                    >
                        <div className="relative w-full h-full">
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
                        </div>
                    </div>
                </ArcherContainer>
            </div>
        </div>
    )
}

export default JsxVisualizer


