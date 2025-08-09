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

type HeapObjectData = {
    id: string
    type: string
    color: string
    borderColor: string
    properties: { name: string; value: string; target?: string }[]
}

export interface MemvalRendererProps {
    memvalSection: ElkNode
    memvalItems: JSValue[]
    rootContainer: d3.Selection<SVGGElement, unknown, null, undefined>
    memoryModelData: {
        scopes: unknown[]
        heap: HeapObjectData[]
    }
    nodePositions: Map<string, { x: number; y: number }>
    edgeData: Array<{
        source: string
        target: string
        type: string
        label?: string
        propIndex?: number
    }>
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

export const renderMemvalSection = ({
    memvalSection,
    memvalItems,
    rootContainer,
    memoryModelData,
    nodePositions,
    edgeData,
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
    const bottomPadding = 10
    const totalMemvalHeight = memvalItems.length > 0
        ? memvalItems.length * MEMVAL_ITEM_HEIGHT + (memvalItems.length - 1) * MEMVAL_SECTION_SPACING
        : 0
    const requiredBaseHeight = Math.max(baseHeight, totalMemvalHeight + bottomPadding)
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
        .attr("fill", "#f8f9fa") // Light gray background
        .attr("stroke", "none") // No border
        .attr("rx", 6) // Rounded corners
        .attr("ry", 6)

    // If no memval items, show a placeholder message
    if (memvalItems.length === 0 || !memvalSection.children) return

    // Use baseHeight so after scaling the visual height equals the assigned section height
    const actualMemvalSectionHeight = baseHeight

    // Position memval items at the bottom of the container
    memvalSection.children.forEach((memvalNode: ElkNode, memvalIndex: number) => {
        const memvalData = memvalItems[memvalIndex]
        if (!memvalData) return

        // Calculate position at the bottom of the container
        // Start from the bottom and work upwards, with reversed index order
        const reversedIndex = memvalItems.length - 1 - memvalIndex
        const itemY = actualMemvalSectionHeight - bottomPadding - totalMemvalHeight + (reversedIndex * (MEMVAL_ITEM_HEIGHT + MEMVAL_SECTION_SPACING))
        const itemX = (baseWidth - MEMVAL_ITEM_WIDTH) / 2 // Center horizontally

        const memvalGroup = memvalContainer
            .append("g")
            .attr("class", "memval-item")
            .attr("transform", `translate(${itemX}, ${itemY})`)

        // Determine item styling based on type
        const isReference = memvalData.type === "reference"
        const itemColor = isReference ? "#dbeafe" : "#f0f9ff"
        const itemBorderColor = isReference ? "#3b82f6" : "#0ea5e9"
        const itemWidth = memvalNode.width || MEMVAL_ITEM_WIDTH
        const itemHeight = memvalNode.height || MEMVAL_ITEM_HEIGHT

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

        // For references, find the referenced object type and show it
        if (isReference) {
            const referencedObject = memoryModelData.heap.find(obj => obj.id === `obj-${memvalData.ref}`)
            if (referencedObject) {
                value = `${referencedObject.type}`
            }
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

        // Store memval position for layered structure edges
        const memvalId = `memval-${memvalIndex}`
        const memvalX = (memvalSection.x || 0) + scale * (itemX + itemWidth / 2)
        const memvalY = (memvalSection.y || 0) + scale * (bottomAnchorOffset + itemY + itemHeight / 2)
        nodePositions.set(memvalId, { x: memvalX, y: memvalY })

        // Store memval position for connections if it's a reference
        if (isReference) {
            const memvalRefX = (memvalSection.x || 0) + scale * (itemX + itemWidth - 5)
            const memvalRefY = (memvalSection.y || 0) + scale * (bottomAnchorOffset + itemY + itemHeight / 2)
            nodePositions.set(`${memvalId}-ref`, { x: memvalRefX, y: memvalRefY })

            // Add edge data for memval references
            edgeData.push({
                source: `${memvalId}-ref`,
                target: `obj-${memvalData.ref}-left`,
                type: "memval-ref",
                label: `memval-${memvalIndex}`,
            })

            // Add a small circle at the connection point
            memvalGroup
                .append("circle")
                .attr("cx", itemWidth - 5)
                .attr("cy", itemHeight / 2)
                .attr("r", 3)
                .attr("fill", "#8b5cf6")
                .attr("stroke", "none")
        }
    })
} 