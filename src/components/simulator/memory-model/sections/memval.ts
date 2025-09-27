import * as d3 from "d3"
import type { ElkNode as ElkLayoutNode } from "elkjs/lib/elk-api"
import { JSValue } from "@/types/simulator"

// Constants for memval rendering
export const MEMVAL_SECTION_WIDTH = 160
export const MEMVAL_SECTION_PADDING = 10
export const MEMVAL_SECTION_SPACING = 10
export const MEMVAL_ITEM_WIDTH = 120
export const MEMVAL_ITEM_HEIGHT = 30

type ElkNode = Omit<ElkLayoutNode, 'labels' | 'children' | 'edges'> & {
    id: string
    width?: number
    height?: number
    x?: number
    y?: number
    layoutOptions?: Record<string, string>
    labels?: { text?: string; width?: number; height?: number }[]
    children?: ElkNode[]
}



export interface MemvalRendererProps {
    memvalSection: ElkNode
    memvalItems: JSValue[]
    rootContainer: d3.Selection<SVGGElement, unknown, null, undefined>
    // Optional visual scale to shrink the whole section uniformly
    scale?: number
    // Height of the viewport to anchor the section bottom and decide growth
    viewportHeight: number
}

export const createMemvalSection = (): ElkNode => {
    return {
        id: "memvalSection",
        layoutOptions: {
            "elk.algorithm": "layered",
            "elk.direction": "UP",
            "elk.partitioning.activate": "true",
            "elk.padding": `[top=${MEMVAL_SECTION_PADDING}, left=${MEMVAL_SECTION_PADDING}, bottom=${MEMVAL_SECTION_PADDING}, right=${MEMVAL_SECTION_PADDING}]`,
            "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
            "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
            "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
            "elk.layered.spacing.nodeNodeBetweenLayers": `${MEMVAL_SECTION_SPACING}`,
            "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
            "elk.edgeRouting": "SPLINES",
        },
        children: [],
    }
}

export const createMemvalNodes = (memvalItems: JSValue[]): ElkNode[] => {
    return memvalItems.map((memval, index) => ({
        id: `memval-${index}`,
        width: MEMVAL_ITEM_WIDTH,
        height: MEMVAL_ITEM_HEIGHT,
        labels: [{
            text: memval.type === "reference" ? `ref: ${memval.ref}` : String(memval.value),
        }],
    }))
}

export const createMemvalEdges = (memvalItems: JSValue[]): Array<{
    id: string
    sources: string[]
    targets: string[]
    layoutOptions: Record<string, string>
}> => {
    const edges = []
    for (let i = 0; i < memvalItems.length - 1; i++) {
        edges.push({
            id: `memval-edge-${i}`,
            sources: [`memval-${i}`],
            targets: [`memval-${i + 1}`],
            layoutOptions: {
                "elk.layered.priority.direction": "1",
            },
        })
    }
    return edges
}

/**
 * Adds a single memval item to the container
 * @param memvalContainer - The D3 container to add the item to
 * @param memvalData - The JSValue data for the memval item
 * @param onComplete - Optional callback when animation completes
 */
export const addMemvalItem = (
    memvalContainer: d3.Selection<SVGGElement, unknown, null, undefined>,
    memvalData: JSValue,
    viewportHeight: number,
    onComplete?: (group: d3.Selection<SVGGElement, unknown, null, undefined>) => void,
    animationType: 'slide-in' | 'fade-in' = 'slide-in'
) => {
    // Get current memval items to calculate positioning
    const memvalItemsEl = memvalContainer.selectAll(".memval-item")
    const memvalItems = memvalItemsEl.nodes()
    const existingItemsCount = memvalItems.length

    // Calculate section height based on existing items
    const scale = 1
    const existingMemvalHeight = existingItemsCount * MEMVAL_ITEM_HEIGHT + (existingItemsCount - 1) * MEMVAL_SECTION_SPACING
    const requiredBaseHeight = Math.max(viewportHeight, existingMemvalHeight + MEMVAL_SECTION_PADDING * 2)
    const actualMemvalSectionHeight = requiredBaseHeight

    // Calculate position at the bottom of the container
    // Start from the bottom and work upwards, with reversed index order
    const itemY = actualMemvalSectionHeight - MEMVAL_SECTION_PADDING - (existingItemsCount + 1) * (MEMVAL_ITEM_HEIGHT + MEMVAL_SECTION_SPACING)
    const itemX = (MEMVAL_SECTION_WIDTH / scale - MEMVAL_ITEM_WIDTH) / 2 // Center horizontally

    const startX = -MEMVAL_ITEM_WIDTH

    const memvalGroup = memvalContainer
        .append("g")
        .attr("class", "memval-item")
        .attr("data-memval-index", existingItemsCount)

    if (animationType === 'slide-in') {
        memvalGroup.attr("transform", `translate(${startX}, ${itemY})`)
    } else {
        memvalGroup.attr("transform", `translate(${itemX}, ${itemY})`).style("opacity", 0)
    }

    // Determine item styling based on type
    const isReference = memvalData.type === "reference"
    const itemColor = isReference ? "#dbeafe" : "#f0f9ff"
    const itemBorderColor = isReference ? "#3b82f6" : "#0ea5e9"
    const itemWidth = MEMVAL_ITEM_WIDTH
    const itemHeight = MEMVAL_ITEM_HEIGHT

    // Draw item background
    memvalGroup
        .append("rect")
        .attr("width", itemWidth)
        .attr("height", itemHeight)
        .attr("rx", 6)
        .attr("ry", 6)
        .attr("fill", itemColor)
        .attr("stroke", itemBorderColor)
        .attr("stroke-width", 1.5)

    // Add memval value
    const memvalType = isReference ? "ref" : typeof memvalData.value
    let value = 'N/A'

    if (isReference) {
        value = "<Reference>"
    } else if (memvalData.value === "not_initialized") {
        value = "<TDZ>"
    } else {
        value = memvalData.value as string
    }

    const formattedValue = memvalType === "string" ? `"${value}"` : value
    const displayText = formattedValue

    memvalGroup
        .append("text")
        .attr("x", itemWidth / 2)
        .attr("y", itemHeight / 2 + 5)
        .attr("font-size", "12px")
        .attr("font-family", "monospace")
        .attr("fill", "#1e293b")
        .attr("font-weight", "500")
        .attr("text-anchor", "middle")
        .text(displayText as string)

    console.log(memvalGroup.node()?.getBoundingClientRect())

    // Store memval position for connections if it's a reference
    if (isReference) {
        // Add a small circle at the connection point
        memvalGroup
            .append("circle")
            .attr("cx", itemWidth - 5)
            .attr("cy", itemHeight / 2)
            .attr("r", 3)
            .attr("fill", "#8b5cf6")
            .attr("stroke", "none")
    }

    const transition = memvalGroup
        .transition()
        .duration(500)
        .ease(d3.easeCubicOut)

    if (animationType === 'slide-in') {
        transition.attr("transform", `translate(${itemX}, ${itemY})`)
    } else {
        transition.style("opacity", 1)
    }

    transition.on("end", function () {
        // Call completion callback if provided
        if (onComplete) {
            onComplete(memvalGroup)
        }
    })
}

/**
 * Removes a single memval item from the container with fade-out animation
 * @param memvalContainer - The D3 container to remove the item from
 * @param itemIndex - The index of the memval item to remove
 * @param viewportHeight - The height of the viewport for positioning calculations
 * @param onComplete - Optional callback when animation completes
 */
export const removeMemvalItem = (
    memvalContainer: d3.Selection<SVGGElement, unknown, null, undefined>,
    itemIndex: number,
    viewportHeight: number,
    onComplete?: () => void
) => {
    // Get all memval items
    const memvalItems = memvalContainer.selectAll(".memval-item")
    const memvalNodes = memvalItems.nodes()

    // Check if the index is valid
    if (itemIndex < 0 || itemIndex >= memvalNodes.length) {
        console.warn(`Invalid memval item index: ${itemIndex}. Available items: ${memvalNodes.length}`)
        return
    }

    // Get the specific item to remove
    const itemToRemove = d3.select(memvalNodes[itemIndex])

    if (itemToRemove.empty()) {
        console.warn(`Memval item at index ${itemIndex} not found`)
        return
    }

    // Add fade-out animation before removal
    itemToRemove
        .transition()
        .duration(500) // 500ms fade-out duration
        .ease(d3.easeCubicIn) // Smooth easing for fade-out
        .style("opacity", 0) // Fade to transparent
        .on("end", function () {
            // Remove the element after animation completes
            d3.select(this).remove()

            // Reposition remaining items if needed
            repositionRemainingMemvalItems(memvalContainer, viewportHeight)

            // Call completion callback if provided
            if (onComplete) {
                onComplete()
            }
        })
}

/**
 * Repositions remaining memval items after one is removed
 * @param memvalContainer - The D3 container with memval items
 * @param viewportHeight - The height of the viewport for positioning calculations
 */
const repositionRemainingMemvalItems = (
    memvalContainer: d3.Selection<SVGGElement, unknown, null, undefined>,
    viewportHeight: number
) => {
    // Get all remaining memval items
    const memvalItems = memvalContainer.selectAll(".memval-item")
    const memvalNodes = memvalItems.nodes()

    if (memvalNodes.length === 0) return

    // Calculate section height based on remaining items
    const scale = 1
    const remainingMemvalHeight = memvalNodes.length * MEMVAL_ITEM_HEIGHT + (memvalNodes.length - 1) * MEMVAL_SECTION_SPACING
    const requiredBaseHeight = Math.max(viewportHeight, remainingMemvalHeight + MEMVAL_SECTION_PADDING * 2)
    const actualMemvalSectionHeight = requiredBaseHeight

    // Reposition each remaining item
    memvalNodes.forEach((node, index) => {
        const itemY = actualMemvalSectionHeight - MEMVAL_SECTION_PADDING - (index + 1) * (MEMVAL_ITEM_HEIGHT + MEMVAL_SECTION_SPACING)
        const itemX = (MEMVAL_SECTION_WIDTH / scale - MEMVAL_ITEM_WIDTH) / 2 // Center horizontally

        d3.select(node)
            .transition()
            .duration(300) // Smooth repositioning animation
            .ease(d3.easeCubicOut)
            .attr("transform", `translate(${itemX}, ${itemY})`)
    })
}

export const renderMemvalSection = ({
    memvalSection,
    memvalItems,
    rootContainer,
    scale = 1,
    viewportHeight,
}: MemvalRendererProps) => {
    // Always create memval section container, even when empty
    const memvalContainer = rootContainer
        .append("g")
        .attr("class", "memval-section")
        .attr("transform", `translate(${memvalSection.x || 0}, ${memvalSection.y || 0}) scale(${scale})`)

    // Add background rectangle for memval section
    const visualWidth = memvalSection.width || MEMVAL_SECTION_WIDTH
    // Draw unscaled sizes so the group scale controls the visual size
    const baseWidth = visualWidth / scale

    // Start with viewport height, then allow content-driven growth (from bottom)
    let baseHeight = (viewportHeight) / scale
    const totalMemvalHeight = memvalItems.length > 0
        ? memvalItems.length * MEMVAL_ITEM_HEIGHT + (memvalItems.length - 1) * MEMVAL_SECTION_SPACING
        : 0
    const requiredBaseHeight = Math.max(baseHeight, totalMemvalHeight + MEMVAL_SECTION_PADDING * 2)
    if (requiredBaseHeight > baseHeight) {
        baseHeight = requiredBaseHeight
        // keep memvalSection height in sync in scaled units
        memvalSection.height = baseHeight * scale
    }

    // Anchor the section to the bottom of the viewport (grow upward)
    const bottomAnchorOffset = Math.max(0, (viewportHeight / scale) - baseHeight)
    memvalContainer.attr(
        "transform",
        `translate(${memvalSection.x || 0}, ${(memvalSection.y || 0) + bottomAnchorOffset}) scale(${scale})`
    )

    memvalContainer
        .append("rect")
        .attr("width", baseWidth)
        .attr("height", baseHeight)
        .attr("fill", "#f5f5f5") // Light gray background
        .attr("stroke", "none") // No border
        .attr("rx", 6) // Rounded corners
        .attr("ry", 6)

    // If no memval items, show a placeholder message
    if (memvalItems.length === 0 || !memvalSection.children) return

    // Position memval items at the bottom of the container
    memvalSection.children.forEach((_memvalNode: ElkNode, memvalIndex: number) => {
        const memvalData = memvalItems[memvalIndex]
        if (!memvalData) return

        addMemvalItem(
            memvalContainer,
            memvalData,
            viewportHeight
        )
    })

    // Add fade-in animation to all memval items in the section
    memvalContainer
        .selectAll(".memval-item")
        .transition()
        .duration(300) // Slightly faster for initial render
        .ease(d3.easeCubicOut)
        .style("opacity", 1)
}

