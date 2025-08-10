import * as d3 from "d3"
import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkNode as ElkLayoutNode, ElkEdge as ElkLayoutEdge } from "elkjs/lib/elk-api"
import { JSValue } from "@/types/simulator"

// Define types for ELK graph structure
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

type ElkEdge = Omit<ElkLayoutEdge, 'sources' | 'targets'> & {
    id: string
    sources: string[]
    targets: string[]
    layoutOptions?: Record<string, string>
    propIndex?: number
}

type ElkGraph = ElkNode & {
    edges: ElkEdge[]
}

export type HeapObjectData = {
    id: string
    type: string
    color: string
    borderColor: string
    properties: { name: string; value: string; target?: string }[]
}

export const HEAP_SECTION_WIDTH = 400

export const createHeapSection = (): ElkNode => {
    return {
        id: "heapSection",
        layoutOptions: {
            "elk.algorithm": "force",
            "elk.spacing.nodeNode": "80",
            "elk.edgeRouting": "POLYLINE",
            "elk.padding": "[top=20, left=20, bottom=20, right=20]",
        },
        children: [],
    }
}

export const createHeapNodes = (heapData: HeapObjectData[], objectWidth: number, objectHeight: number): ElkNode[] => {
    return heapData.map((object) => {
        const propCount = object.properties ? object.properties.length : 0
        const objHeight = Math.max(objectHeight, 30 + propCount * 16)

        return {
            id: object.id,
            width: objectWidth,
            height: objHeight,
            labels: [{ text: object.type, width: 100, height: 20 }],
        }
    })
}

export const formatPropertyValue = (propName: string, propValue: JSValue): { name: string; value: string; target?: string } => {
    if (propValue.type === "primitive") {
        if (propValue.value === undefined) {
            return { name: propName, value: "undefined" }
        } else if (propValue.value === null) {
            return { name: propName, value: "null" }
        } else if (propValue.value === "not_initialized") {
            return { name: propName, value: "<TDZ> 🤔" }
        } else {
            return { name: propName, value: String(propValue.value) }
        }
    } else {
        // It's a reference - show just the icon
        return {
            name: propName,
            value: "↗️",
            target: `obj-${propValue.ref}`
        }
    }
}

export const renderHeapSection = ({
    heapSection,
    heapData,
    rootContainer,
    nodePositions,
    propertyPositions,
    edgeData,
    scale,
    viewportHeight,
    objectWidth,
    objectHeight,
}: {
    heapSection: ElkNode
    heapData: HeapObjectData[]
    rootContainer: d3.Selection<SVGGElement, unknown, null, undefined>
    nodePositions: Map<string, { x: number; y: number }>
    propertyPositions: Map<string, { x: number; y: number }>
    edgeData: Array<{ source: string; target: string; type: string; label?: string; propIndex?: number }>
    scale: number
    viewportHeight: number
    objectWidth: number
    objectHeight: number
}): Promise<void> => {
    // Always show heap section, even when empty

    // Prepare heap container with uniform scaling like other sections
    const baseHeapWidth = (heapSection.width || HEAP_SECTION_WIDTH) / scale
    let baseHeapHeight = (heapSection.height || viewportHeight) / scale

    const heapContainer = rootContainer
        .append("g")
        .attr("class", "heap-section")
        .attr("transform", `translate(${heapSection.x || 0}, ${heapSection.y || 0}) scale(${scale})`)

    const heapBackground = heapContainer
        .append("rect")
        .attr("class", "heap-section-background")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", baseHeapWidth)
        .attr("height", baseHeapHeight)
        .attr("fill", "#fefce8")
        .attr("stroke", "none")
        .attr("rx", 6)
        .attr("ry", 6)

    // Store on container for later height updates
    // @ts-expect-error attach for internal use
    heapContainer.node().__background = heapBackground
    // @ts-expect-error attach for internal use
    heapContainer.node().__yOffset = 0

    // Build a heap-only graph using the same children prepared earlier
    const heapOnlyGraph: ElkGraph = {
        id: "heapRoot",
        width: baseHeapWidth,
        height: baseHeapHeight,
        layoutOptions: {
            "elk.algorithm": "force",
            "elk.spacing.nodeNode": "40",
            "elk.padding": "[top=20, left=20, bottom=20, right=20]",
            "elk.edgeRouting": "POLYLINE",
        },
        children: heapSection.children || [],
        edges: [],
    }

    const elk = new ELK()

    // Run ELK on the heap-only graph to get force-directed positions
    return elk.layout(heapOnlyGraph).then((heapLayouted) => {
        const children = heapLayouted.children || []
        if (children.length === 0) {
            // No heap objects, but still show the empty section
            return
        }

        // Compute bounding box of heap children (base units)
        const minX = Math.min(...children.map(c => (c.x || 0)))
        const maxX = Math.max(...children.map(c => (c.x || 0) + (c.width || objectWidth)))
        const minY = Math.min(...children.map(c => (c.y || 0)))
        const maxY = Math.max(...children.map(c => (c.y || 0) + (c.height || objectHeight)))
        const bboxWidth = maxX - minX
        const bboxHeight = maxY - minY

        // If content taller than current heap height, grow from bottom (increase height upward)
        const padding = 20
        const requiredBaseHeight = Math.max(baseHeapHeight, bboxHeight + padding * 2)
        if (requiredBaseHeight > baseHeapHeight) {
            baseHeapHeight = requiredBaseHeight
            // Update visual background height
            const bg = // @ts-expect-error internal handle
                (heapContainer.node().__background as d3.Selection<SVGRectElement, unknown, null, undefined>)
            if (bg) bg.attr("height", baseHeapHeight)
            // Keep section height in sync for absolute position calculations
            heapSection.height = baseHeapHeight * scale
        }

        // Bias: center horizontally, bottom-align vertically within heap section (base units)
        const targetCenterX = baseHeapWidth / 2
        const currentCenterX = minX + bboxWidth / 2
        const dx = targetCenterX - currentCenterX

        const heapLeft = 0
        const heapTop = 0
        const heapRight = heapLeft + baseHeapWidth
        const heapBottom = heapTop + baseHeapHeight

        // Align bottom of bbox to bottom of heap area with padding
        const dy = (heapBottom - padding) - maxY

        // Anchor heap group's bottom to viewport bottom when section grows
        const bottomAnchorOffset = Math.max(0, (viewportHeight / scale) - baseHeapHeight)
        heapContainer.attr(
            "transform",
            `translate(${heapSection.x || 0}, ${(heapSection.y || 0) + bottomAnchorOffset}) scale(${scale})`
        )
        // @ts-expect-error internal handle
        heapContainer.node().__yOffset = bottomAnchorOffset

        // Helpers to avoid overlaps and grow section height if needed
        type PlacedRect = { x: number; y: number; w: number; h: number }
        const placedRects: PlacedRect[] = []
        const ySpacing = 32
        const intersects = (a: PlacedRect, b: PlacedRect) => {
            const aTop = a.y - ySpacing / 2
            const aBottom = a.y + a.h + ySpacing / 2
            const bTop = b.y - ySpacing / 2
            const bBottom = b.y + b.h + ySpacing / 2
            const noOverlap = a.x + a.w <= b.x || b.x + b.w <= a.x || aBottom <= bTop || bBottom <= aTop
            return !noOverlap
        }
        const updateBottomAnchor = () => {
            const newOffset = Math.max(0, (viewportHeight / scale) - baseHeapHeight)
            heapContainer.attr(
                "transform",
                `translate(${heapSection.x || 0}, ${(heapSection.y || 0) + newOffset}) scale(${scale})`
            )
            // @ts-expect-error internal handle
            heapContainer.node().__yOffset = newOffset
        }
        const growHeightIfNeeded = (required: number) => {
            if (required <= baseHeapHeight) return
            baseHeapHeight = required
            const bg = // @ts-expect-error internal handle
                (heapContainer.node().__background as d3.Selection<SVGRectElement, unknown, null, undefined>)
            if (bg) bg.attr("height", baseHeapHeight)
            heapSection.height = baseHeapHeight * scale
            updateBottomAnchor()
        }
        const resolveVerticalPosition = (x: number, y: number, w: number, h: number): number => {
            const minUp = heapTop + padding
            const step = 20
            let offset = 0
            let tryUp = true // prefer moving upward first to fill from bottom
            for (let attempts = 0; attempts < 2000; attempts++) {
                const currentHeapBottom = heapTop + baseHeapHeight
                const maxDown = currentHeapBottom - padding - h
                const candidateY = tryUp ? Math.max(y - offset, minUp) : Math.min(y + offset, maxDown)
                const candidate: PlacedRect = { x, y: candidateY, w, h }
                const collides = placedRects.some(r => intersects(candidate, r))
                if (!collides) return candidateY
                tryUp = !tryUp
                offset += step
                // If we've exceeded available vertical space, grow height and continue
                if (candidateY <= minUp || candidateY >= maxDown) {
                    const needed = baseHeapHeight + Math.max(h + ySpacing, 60)
                    growHeightIfNeeded(needed)
                }
            }
            // As a last resort, place at the bottom with growth
            const needed = baseHeapHeight + Math.max(h + ySpacing, 60)
            growHeightIfNeeded(needed)
            const currentHeapBottom = heapTop + baseHeapHeight
            const maxDown = currentHeapBottom - padding - h
            return Math.min(Math.max(y, minUp), maxDown)
        }

        // Render each heap object using adjusted positions
        children.forEach((c) => {
            const objData = heapData.find(h => h.id === c.id)
            if (!objData) return

            const propCount = objData.properties ? objData.properties.length : 0
            const objHeight = Math.max(objectHeight, 30 + propCount * 16)
            const objWidth = c.width || objectWidth

            // Compute local positions in heap container (base units) and clamp to bounds
            let localX = heapLeft + (c.x || 0) + dx
            let localY = heapTop + (c.y || 0) + dy

            localX = Math.min(Math.max(localX, heapLeft + padding), heapRight - objWidth - padding)
            localY = Math.min(Math.max(localY, heapTop + padding), heapBottom - objHeight - padding)

            // If overlapping with already placed items, move vertically (downwards first, then upwards)
            localY = resolveVerticalPosition(localX, localY, objWidth, objHeight)
            placedRects.push({ x: localX, y: localY, w: objWidth, h: objHeight })

            const objectGroup = heapContainer
                .append("g")
                .attr("class", "heap-object")
                .attr("data-id", c.id)
                .attr("transform", `translate(${localX}, ${localY})`)

            // Store object position for connections - use right edge for incoming connections
            const yOffset = // @ts-expect-error internal handle
                (heapContainer.node().__yOffset as number) || 0
            nodePositions.set(c.id, {
                x: (heapSection.x || 0) + scale * (localX + objWidth),
                y: (heapSection.y || 0) + scale * (yOffset + localY + objHeight / 2),
            })
            // Store left edge position for memval connections
            nodePositions.set(`${c.id}-left`, {
                x: (heapSection.x || 0) + scale * (localX),
                y: (heapSection.y || 0) + scale * (yOffset + localY + objHeight / 2),
            })

            // Draw object rectangle
            objectGroup
                .append("rect")
                .attr("width", objWidth)
                .attr("height", objHeight)
                .attr("rx", 6)
                .attr("ry", 6)
                .attr("fill", objData.color)
                .attr("stroke", objData.borderColor)
                .attr("stroke-width", 2)

            // Add object type header
            objectGroup
                .append("path")
                .attr("d", `M 0 6 Q 0 0 6 0 L ${objWidth - 6} 0 Q ${objWidth} 0 ${objWidth} 6 L ${objWidth} 20 L 0 20 Z`)
                .attr("fill", objData.borderColor)

            objectGroup
                .append("text")
                .attr("x", 10)
                .attr("y", 14)
                .attr("fill", "white")
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .text(objData.type)

            // Add object properties
            if (objData.properties) {
                objData.properties.forEach((prop, i) => {
                    const propertyGroup = objectGroup
                        .append("g")
                        .attr("class", "property")
                        .attr("transform", `translate(10, ${28 + i * 16})`)
                        .attr("data-property-id", `${c.id}_${prop.name}`)

                    if (prop.target) {
                        propertyGroup
                            .append("rect")
                            .attr("width", 10)
                            .attr("height", 12)
                            .attr("fill", "white")
                            .attr("stroke", "black")
                            .attr("stroke-width", 0.5)

                        propertyGroup
                            .append("path")
                            .attr("d", "M9, 0 L9, 4 L14, 4 L14, 0 Z")
                            .attr("fill", "white")
                            .attr("stroke", "black")
                            .attr("stroke-width", 0.5)

                        // Store property position for connections
                        const propXAbs = (heapSection.x || 0) + scale * (localX + 5)
                        const propYAbs = (heapSection.y || 0) + scale * (yOffset + localY + 38 + i * 16)
                        const propId = `${c.id}_${prop.name}`
                        propertyPositions.set(propId, { x: propXAbs, y: propYAbs })

                        // Add edge data for property references
                        edgeData.push({
                            source: propId,
                            target: prop.target,
                            type: "prop-ref",
                            label: prop.name,
                            propIndex: i,
                        })

                        objectGroup
                            .append("circle")
                            .attr("cx", 5)
                            .attr("cy", 38 + i * 16)
                            .attr("r", 2)
                            .attr("fill", "#ed8936")
                            .attr("stroke", "none")
                    }

                    propertyGroup
                        .append("text")
                        .attr("x", prop.target ? 20 : 0)
                        .attr("y", 10)
                        .attr("font-size", "12px")
                        .text(`${prop.name} ${prop.value}`)
                })
            }
        })
    })
}
