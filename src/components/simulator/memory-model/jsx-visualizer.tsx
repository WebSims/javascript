import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { useJsxVisualization } from "@/hooks/useJsxVisualization"
import { ArcherContainer } from "react-archer"
import MemVal from "./components/MemVal"
import Heap from "./components/Heap"
import Scope from "./components/Scope"
import { useState } from "react"
import useElementSize from "@/hooks/useElementSize"
import { useResponsive } from "@/hooks/useResponsive"

type Position = { x: number; y: number }
type Positions = {
    memval: Position
    heap: Position
    scope: Position
}

type ComponentDimensions = {
    x: number
    y: number
    width: number
    height: number
}

const LAYOUT_CONFIG = {
    containerPadding: {
        mobile: 2,
        desktop: 8
    },
    componentGap: {
        mobile: 2,
        desktop: 8
    },
    minComponentWidth: 0,
    minComponentHeight: 100,
    widthRatios: {
        memval: 0.25,
        heap: 0.35,
        scope: 0.40
    }
}

const calculateInitialPositions = (
    containerWidth: number,
    containerPadding: number,
    componentGap: number,
    config: typeof LAYOUT_CONFIG
): Positions => {
    const { widthRatios } = config

    const availableWidth = containerWidth - (containerPadding * 2) - (componentGap * 2)
    const memvalWidth = availableWidth * widthRatios.memval
    const heapWidth = availableWidth * widthRatios.heap

    return {
        memval: {
            x: containerPadding,
            y: containerPadding
        },
        heap: {
            x: containerPadding + memvalWidth + componentGap,
            y: containerPadding
        },
        scope: {
            x: containerPadding + memvalWidth + componentGap + heapWidth + componentGap,
            y: containerPadding
        }
    }
}

const calculateComponentDimensions = (
    position: Position,
    containerWidth: number,
    containerHeight: number,
    widthRatio: number,
    containerPadding: number,
    componentGap: number,
    config: typeof LAYOUT_CONFIG
): ComponentDimensions => {
    const { minComponentWidth, minComponentHeight } = config

    const availableWidth = containerWidth - (containerPadding * 2) - (componentGap * 2)
    const calculatedWidth = availableWidth * widthRatio
    const width = Math.max(calculatedWidth, minComponentWidth)

    const availableHeight = containerHeight - position.y - containerPadding
    const height = Math.max(availableHeight, minComponentHeight)

    return {
        x: position.x,
        y: position.y,
        width,
        height
    }
}

declare global {
    interface Window {
        setMemoryModelPositions: React.Dispatch<React.SetStateAction<Positions>>
    }
}

export const JsxVisualizer = () => {
    const { currentStep, steps } = useSimulatorStore()
    const visualizationData = useJsxVisualization(currentStep, steps)
    const [containerRef, containerSize] = useElementSize<HTMLDivElement>()
    const { isDesktop } = useResponsive()

    const containerPadding = isDesktop ? LAYOUT_CONFIG.containerPadding.desktop : LAYOUT_CONFIG.containerPadding.mobile
    const componentGap = isDesktop ? LAYOUT_CONFIG.componentGap.desktop : LAYOUT_CONFIG.componentGap.mobile

    const [positions, setPositions] = useState<Positions>(() =>
        calculateInitialPositions(1200, containerPadding, componentGap, LAYOUT_CONFIG)
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

    // Expose setPositions to window for JavaScript manipulation
    if (typeof window !== 'undefined') {
        window.setMemoryModelPositions = setPositions
    }

    const containerWidth = containerSize.width || 0
    const containerHeight = containerSize.height || 0

    const memvalDimensions = calculateComponentDimensions(
        positions.memval,
        containerWidth,
        containerHeight,
        LAYOUT_CONFIG.widthRatios.memval,
        containerPadding,
        componentGap,
        LAYOUT_CONFIG
    )

    const heapPosition = {
        x: memvalDimensions.x + memvalDimensions.width + componentGap,
        y: positions.heap.y
    }

    const heapDimensions = calculateComponentDimensions(
        heapPosition,
        containerWidth,
        containerHeight,
        LAYOUT_CONFIG.widthRatios.heap,
        containerPadding,
        componentGap,
        LAYOUT_CONFIG
    )

    const scopePosition = {
        x: heapDimensions.x + heapDimensions.width + componentGap,
        y: positions.scope.y
    }

    const scopeDimensions = calculateComponentDimensions(
        scopePosition,
        containerWidth,
        containerHeight,
        LAYOUT_CONFIG.widthRatios.scope,
        containerPadding,
        componentGap,
        LAYOUT_CONFIG
    )
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
                svgContainerStyle={{
                    width: containerWidth,
                    height: containerHeight,
                    zIndex: 1
                }}
            >
                <div
                    className="absolute"
                    style={{
                        left: `${memvalDimensions.x}px`,
                        top: `${memvalDimensions.y}px`,
                        width: `${memvalDimensions.width}px`,
                        height: `${memvalDimensions.height}px`
                    }}
                >
                    <MemVal memval={memval} />
                </div>
                <div
                    className="absolute"
                    style={{
                        left: `${heapDimensions.x}px`,
                        top: `${heapDimensions.y}px`,
                        width: `${heapDimensions.width}px`,
                        height: `${heapDimensions.height}px`
                    }}
                >
                    <Heap heap={heap} />
                </div>
                <div
                    className="absolute"
                    style={{
                        left: `${scopeDimensions.x}px`,
                        top: `${scopeDimensions.y}px`,
                        width: `${scopeDimensions.width}px`,
                        height: `${scopeDimensions.height}px`
                    }}
                >
                    <Scope scopes={scopes} />
                </div>
            </ArcherContainer>
        </div>
    )
}

export default JsxVisualizer


