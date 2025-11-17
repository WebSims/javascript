/**
 * Hook for calculating memory model component dimensions before rendering
 * 
 * This hook analyzes the current step data and returns helper functions
 * that calculate the height of individual items and containers virtually,
 * allowing for pre-render layout calculations.
 * 
 * Container height calculations work similarly to calculateComponentDimensions:
 * - Returns the greater of content height or available viewport height
 * - Ensures containers fill the viewport when content is small
 * - Allows containers to expand beyond viewport when content is large
 * 
 * @param currentStep - Current execution step
 * @param steps - All execution steps
 * @param viewportHeight - Available viewport height
 * @param viewportWidth - Available viewport width
 * @param containerPadding - Container padding (8px desktop, 2px mobile)
 * @param componentGap - Gap between components
 * @returns Object with helper functions for calculating dimensions
 */

import { useMemo } from "react"
import type { ExecStep } from "@/types/simulator"
import { transformMemorySnapshot } from "@/utils/visualizationData"

export type ComponentDimensions = {
    x: number
    y: number
    w: number
    h: number
    items: number[]
}

// Base dimensions for calculating component heights
const DIMENSIONS = {
    memval: {
        basePadding: 8, // md:p-2 = 8px (mobile is 2px but we use desktop for calculations)
        border: 2, // border-2
        idHeight: 20, // text-xs with margin
        valueHeight: 24, // font-bold text-base with margin
        badgeHeight: 24, // type badge
        minHeight: 68 // minimum height for a memval item
    },
    heap: {
        basePadding: 8, // md:p-2
        border: 2, // border-2
        headerHeight: 32, // header with object name and type badge
        propertyHeight: 32, // each property item (text-sm with padding)
        propertySpacing: 8, // space-y-2
        emptyHeight: 20, // "No properties" text
        minHeight: 80 // minimum height for a heap item
    },
    scope: {
        basePadding: 8, // md:p-2
        border: 2, // border-2
        headerHeight: 36, // scope name and active badge
        variableHeight: 32, // each variable item
        variableSpacing: 8, // space-y-2
        emptyHeight: 20, // "No variables" text
        minHeight: 90 // minimum height for a scope item
    },
    container: {
        padding: 8, // p-1 md:p-2
        border: 1, // border
        itemSpacing: 8, // space-y-2 between items
        minHeight: 100 // minimum height when empty
    },
    widthRatios: {
        memval: 0.25,
        heap: 0.35,
        scope: 0.40
    },
    minComponentWidth: 0
}

export const useMemoryDimensions = (
    currentStep: ExecStep | null, 
    steps: ExecStep[],
    viewportHeight: number = 0,
    viewportWidth: number = 0,
    containerPadding: number = 8,
    componentGap: number = 8
) => {
    const visualizationData = useMemo(() => {
        return transformMemorySnapshot(currentStep, steps)
    }, [currentStep, steps])

    const calculateMemvalItemHeight = useMemo(() => {
        return (itemIndex: number): number => {
            if (!visualizationData || itemIndex >= visualizationData.memval.length) {
                return DIMENSIONS.memval.minHeight
            }
            
            // Calculate based on content (all memval items have same structure)
            const contentHeight = 
                DIMENSIONS.memval.idHeight + 
                DIMENSIONS.memval.valueHeight + 
                DIMENSIONS.memval.badgeHeight

            const totalHeight = 
                (DIMENSIONS.memval.basePadding * 2) + 
                (DIMENSIONS.memval.border * 2) + 
                contentHeight

            return Math.max(totalHeight, DIMENSIONS.memval.minHeight)
        }
    }, [visualizationData])

    const calculateMemvalContainerHeight = useMemo(() => {
        return (): number => {
            // Calculate content height
            let contentHeight = DIMENSIONS.container.padding * 2 + DIMENSIONS.container.border * 2
            
            if (!visualizationData || visualizationData.memval.length === 0) {
                contentHeight += DIMENSIONS.container.minHeight
            } else {
                visualizationData.memval.forEach((_, index) => {
                    contentHeight += calculateMemvalItemHeight(index)
                    if (index < visualizationData.memval.length - 1) {
                        contentHeight += DIMENSIONS.container.itemSpacing
                    }
                })
            }

            // Calculate available height from viewport
            const availableHeight = viewportHeight > 0 
                ? viewportHeight - containerPadding * 2
                : contentHeight

            // Return the greater of content height or available viewport height
            return Math.max(contentHeight, availableHeight)
        }
    }, [visualizationData, calculateMemvalItemHeight, viewportHeight, containerPadding])

    const calculateHeapItemHeight = useMemo(() => {
        return (itemIndex: number): number => {
            if (!visualizationData || itemIndex >= visualizationData.heap.length) {
                return DIMENSIONS.heap.minHeight
            }

            const item = visualizationData.heap[itemIndex]
            const propertiesCount = item.properties?.length || 0

            let contentHeight = DIMENSIONS.heap.headerHeight

            if (propertiesCount === 0) {
                contentHeight += DIMENSIONS.heap.emptyHeight
            } else {
                // Each property + spacing between them
                contentHeight += propertiesCount * DIMENSIONS.heap.propertyHeight
                contentHeight += (propertiesCount - 1) * DIMENSIONS.heap.propertySpacing
            }

            const totalHeight = 
                (DIMENSIONS.heap.basePadding * 2) + 
                (DIMENSIONS.heap.border * 2) + 
                contentHeight

            return Math.max(totalHeight, DIMENSIONS.heap.minHeight)
        }
    }, [visualizationData])

    const calculateHeapContainerHeight = useMemo(() => {
        return (): number => {
            // Calculate content height
            let contentHeight = DIMENSIONS.container.padding * 2 + DIMENSIONS.container.border * 2
            
            if (!visualizationData || visualizationData.heap.length === 0) {
                contentHeight += DIMENSIONS.container.minHeight
            } else {
                visualizationData.heap.forEach((_, index) => {
                    contentHeight += calculateHeapItemHeight(index)
                    if (index < visualizationData.heap.length - 1) {
                        contentHeight += DIMENSIONS.container.itemSpacing
                    }
                })
            }

            // Calculate available height from viewport
            const availableHeight = viewportHeight > 0 
                ? viewportHeight - containerPadding * 2
                : contentHeight

            // Return the greater of content height or available viewport height
            return Math.max(contentHeight, availableHeight)
        }
    }, [visualizationData, calculateHeapItemHeight, viewportHeight, containerPadding])

    const calculateScopeItemHeight = useMemo(() => {
        return (itemIndex: number): number => {
            if (!visualizationData || itemIndex >= visualizationData.scopes.length) {
                return DIMENSIONS.scope.minHeight
            }

            const item = visualizationData.scopes[itemIndex]
            const variablesCount = item.variables.length

            let contentHeight = DIMENSIONS.scope.headerHeight

            if (variablesCount === 0) {
                contentHeight += DIMENSIONS.scope.emptyHeight
            } else {
                // Each variable + spacing between them
                contentHeight += variablesCount * DIMENSIONS.scope.variableHeight
                contentHeight += (variablesCount - 1) * DIMENSIONS.scope.variableSpacing
            }

            // Add extra height if scope is current (ring-2 ring-offset-2)
            const ringHeight = item.isCurrent ? 8 : 0

            const totalHeight = 
                (DIMENSIONS.scope.basePadding * 2) + 
                (DIMENSIONS.scope.border * 2) + 
                contentHeight + 
                ringHeight

            return Math.max(totalHeight, DIMENSIONS.scope.minHeight)
        }
    }, [visualizationData])

    const calculateScopeContainerHeight = useMemo(() => {
        return (): number => {
            // Calculate content height
            let contentHeight = DIMENSIONS.container.padding * 2 + DIMENSIONS.container.border * 2
            
            if (!visualizationData || visualizationData.scopes.length === 0) {
                contentHeight += DIMENSIONS.container.minHeight
            } else {
                visualizationData.scopes.forEach((_, index) => {
                    contentHeight += calculateScopeItemHeight(index)
                    if (index < visualizationData.scopes.length - 1) {
                        contentHeight += DIMENSIONS.container.itemSpacing
                    }
                })
            }

            // Calculate available height from viewport
            const availableHeight = viewportHeight > 0 
                ? viewportHeight - containerPadding * 2
                : contentHeight

            // Return the greater of content height or available viewport height
            return Math.max(contentHeight, availableHeight)
        }
    }, [visualizationData, calculateScopeItemHeight, viewportHeight, containerPadding])

    // Calculate full dimensions with container position, size, and items array
    const memval = useMemo((): ComponentDimensions => {
        const availableWidth = viewportWidth - (containerPadding * 2) - (componentGap * 2)
        const calculatedWidth = availableWidth * DIMENSIONS.widthRatios.memval
        const w = Math.max(calculatedWidth, DIMENSIONS.minComponentWidth)
        const h = calculateMemvalContainerHeight()
        const items = visualizationData?.memval.map((_, i) => calculateMemvalItemHeight(i)) || []
        
        return {
            x: containerPadding,
            y: containerPadding,
            w,
            h,
            items
        }
    }, [viewportWidth, containerPadding, componentGap, calculateMemvalContainerHeight, calculateMemvalItemHeight, visualizationData])

    const heap = useMemo((): ComponentDimensions => {
        const availableWidth = viewportWidth - (containerPadding * 2) - (componentGap * 2)
        const memvalWidth = availableWidth * DIMENSIONS.widthRatios.memval
        const calculatedWidth = availableWidth * DIMENSIONS.widthRatios.heap
        const w = Math.max(calculatedWidth, DIMENSIONS.minComponentWidth)
        const h = calculateHeapContainerHeight()
        const items = visualizationData?.heap.map((_, i) => calculateHeapItemHeight(i)) || []
        
        return {
            x: containerPadding + memvalWidth + componentGap,
            y: containerPadding,
            w,
            h,
            items
        }
    }, [viewportWidth, containerPadding, componentGap, calculateHeapContainerHeight, calculateHeapItemHeight, visualizationData])

    const scope = useMemo((): ComponentDimensions => {
        const availableWidth = viewportWidth - (containerPadding * 2) - (componentGap * 2)
        const memvalWidth = availableWidth * DIMENSIONS.widthRatios.memval
        const heapWidth = availableWidth * DIMENSIONS.widthRatios.heap
        const calculatedWidth = availableWidth * DIMENSIONS.widthRatios.scope
        const w = Math.max(calculatedWidth, DIMENSIONS.minComponentWidth)
        const h = calculateScopeContainerHeight()
        const items = visualizationData?.scopes.map((_, i) => calculateScopeItemHeight(i)) || []
        
        return {
            x: containerPadding + memvalWidth + componentGap + heapWidth + componentGap,
            y: containerPadding,
            w,
            h,
            items
        }
    }, [viewportWidth, containerPadding, componentGap, calculateScopeContainerHeight, calculateScopeItemHeight, visualizationData])

    // Calculate maximum container height
    const maxContainerHeight = useMemo(() => {
        return Math.max(memval.h, heap.h, scope.h)
    }, [memval.h, heap.h, scope.h])

    return {
        memval,
        heap,
        scope,
        maxContainerHeight,
        visualizationData
    }
}

