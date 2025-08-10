import * as d3 from "d3"
import type { ElkNode as ElkLayoutNode } from "elkjs/lib/elk-api"

// Constants for scope rendering
export const SCOPE_SECTION_WIDTH = 200
export const SCOPE_SECTION_PADDING = 10
export const SCOPE_SECTION_SPACING = 10
export const SCOPE_BADGE_HEIGHT = 30
export const SCOPE_ITEM_HEIGHT = 35
export const SCOPE_ITEM_SPACING = 5

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

type ScopeData = {
    id: string
    name: string
    scopeTags: string[]
    scopeType: string
    isCurrentScope: boolean
    color: string
    borderColor: string
    textColor: string
    variables: { id: string; name: string; type: string; target?: string; value?: string }[]
}

export interface ScopeRendererProps {
    scopeSection: ElkNode
    scopeItems: ScopeData[]
    rootContainer: d3.Selection<SVGGElement, unknown, null, undefined>
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

export const createScopeSection = (): ElkNode => {
    return {
        id: "scopeSection",
        layoutOptions: {
            "elk.algorithm": "layered",
            "elk.direction": "UP",
            "elk.partitioning.activate": "true",
            "elk.padding": `[top=${SCOPE_SECTION_PADDING}, left=${SCOPE_SECTION_PADDING}, bottom=${SCOPE_SECTION_PADDING}, right=${SCOPE_SECTION_PADDING}]`,
            "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
            "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
            "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
            "elk.layered.spacing.nodeNodeBetweenLayers": `${SCOPE_SECTION_SPACING}`,
            "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
            "elk.edgeRouting": "SPLINES",
        },
        children: [],
    }
}

export const createScopeNodes = (scopeItems: ScopeData[]): ElkNode[] => {
    return scopeItems.map((scope) => ({
        id: scope.id,
        width: SCOPE_SECTION_WIDTH,
        height: calculateScopeHeight(scope.id, scopeItems, 100),
        labels: [{ text: scope.scopeTags.join(" ") }],
    }))
}

export const createScopeEdges = (scopeItems: ScopeData[]): Array<{
    id: string
    sources: string[]
    targets: string[]
    layoutOptions: Record<string, string>
}> => {
    const edges = []
    for (let i = 0; i < scopeItems.length - 1; i++) {
        edges.push({
            id: `scope-edge-${i}`,
            sources: [scopeItems[i].id],
            targets: [scopeItems[i + 1].id],
            layoutOptions: {
                "elk.layered.priority.direction": "1",
            },
        })
    }
    return edges
}

export const calculateScopeHeight = (scopeId: string, scopeItems: ScopeData[], defaultHeight: number = 100): number => {
    const scopeData = scopeItems.find(s => s.id === scopeId)
    if (!scopeData) return defaultHeight
    const calculatedHeight = SCOPE_BADGE_HEIGHT + scopeData.variables.length * (SCOPE_ITEM_HEIGHT + SCOPE_ITEM_SPACING) + SCOPE_SECTION_SPACING
    return scopeData.variables.length > 0 ? calculatedHeight : defaultHeight
}

export const renderScopeSection = ({
    scopeSection,
    scopeItems,
    rootContainer,
    nodePositions,
    edgeData,
    scale = 1,
    viewportHeight,
}: ScopeRendererProps) => {
    // Always create scope section container, even when empty
    const scopeContainer = rootContainer
        .append("g")
        .attr("class", "scope-section")
        .attr("transform", `translate(${scopeSection.x || 0}, ${scopeSection.y || 0}) scale(${scale})`)

    // Add background rectangle for scope section
    const visualWidth = scopeSection.width || SCOPE_SECTION_WIDTH
    const baseWidth = visualWidth / scale

    // Start with viewport height, then allow content-driven growth (from bottom)
    let baseHeight = (viewportHeight) / scale
    const bottomPadding = 10
    // Calculate total height of all scopes including spacing
    const totalScopesHeight = scopeItems.reduce((acc, s, idx) => {
        const h = calculateScopeHeight(s.id, scopeItems, 100)
        // add spacing between scopes except after the top-most
        const spacing = idx < scopeItems.length - 1 ? SCOPE_SECTION_SPACING : 0
        return acc + h + spacing
    }, 0)
    const requiredBaseHeight = Math.max(baseHeight, totalScopesHeight + bottomPadding)
    if (requiredBaseHeight > baseHeight) {
        baseHeight = requiredBaseHeight
        // keep scopeSection height in sync in scaled units
        scopeSection.height = baseHeight * scale
    }

    // Anchor the section to the bottom of the viewport (grow upward)
    const bottomAnchorOffset = Math.max(0, (viewportHeight / scale) - baseHeight)
    scopeContainer.attr(
        "transform",
        `translate(${scopeSection.x || 0}, ${(scopeSection.y || 0) + bottomAnchorOffset}) scale(${scale})`
    )

    scopeContainer
        .append("rect")
        .attr("class", "scope-section-background")
        .attr("width", baseWidth)
        .attr("height", baseHeight)
        .attr("fill", "#f1f3f4") // Slightly darker gray background
        .attr("stroke", "none") // No border
        .attr("rx", 6) // Rounded corners
        .attr("ry", 6)

    // If no scope items or no children, stop after drawing background
    if (scopeItems.length === 0 || !scopeSection.children) return

    // After scaling, baseHeight equals the assigned height for the visual section
    const actualScopeSectionHeight = baseHeight

    // Draw scope items positioned at the bottom of the container
    scopeSection.children.forEach((scopeNode: ElkNode, scopeIndex: number) => {
        // Find the original scope data
        const scopeData = scopeItems.find(s => s.id === scopeNode.id)
        if (!scopeData) return

        // Calculate position at the bottom of the container
        // Start from the bottom and work upwards
        const bottomPadding = 10
        let cumulativeHeight = 0

        // Calculate the Y position by summing up the heights of previous scopes from bottom
        for (let i = scopeItems.length - 1; i > scopeIndex; i--) {
            const nextScopeId = scopeItems[i].id
            cumulativeHeight += calculateScopeHeight(nextScopeId, scopeItems, 100) + SCOPE_SECTION_SPACING
        }

        const scopeX = scopeNode.x || 0
        const scopeY = actualScopeSectionHeight - bottomPadding - cumulativeHeight - calculateScopeHeight(scopeNode.id, scopeItems, 100)
        const actualScopeHeight = calculateScopeHeight(scopeNode.id, scopeItems, 100)

        const scopeGroup = scopeContainer
            .append("g")
            .attr("class", "scope")
            .attr("data-id", scopeNode.id)
            .attr("transform", `translate(${scopeX}, ${scopeY})`)

        // Store scope position for connections - use ELK layout position
        const absoluteScopeX = (scopeSection.x || 0) + scale * (scopeX + (scopeNode.width || 200) / 2)
        const absoluteScopeY = (scopeSection.y || 0) + scale * (bottomAnchorOffset + scopeY + actualScopeHeight / 2)
        nodePositions.set(scopeNode.id, { x: absoluteScopeX, y: absoluteScopeY })

        // Draw scope rectangle
        scopeGroup
            .append("rect")
            .attr("width", (scopeNode.width || SCOPE_SECTION_WIDTH) - SCOPE_SECTION_PADDING * 2)
            .attr("height", actualScopeHeight)
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("fill", scopeData.color)
            .attr("stroke", scopeData.borderColor)
            .attr("stroke-width", 2)

        // Add scope type badges
        const badgeGroup = scopeGroup.append("g").attr("class", "scope-badges")

        let currentX = 10
        const badgeHeight = 20
        const badgeSpacing = 8

        scopeData.scopeTags.forEach((tag) => {
            const badgeText = tag
            const textWidth = badgeText.length * 7

            // Determine badge styling based on tag type
            let badgeFill = "#f3f4f6"
            let badgeStroke = "#d1d5db"
            let textFill = "#374151"

            if (tag === "Current") {
                badgeFill = "#059669"
                badgeStroke = "#047857"
                textFill = "#ffffff"
            } else if (tag === "Global Scope") {
                badgeFill = "#8b5cf6"
                badgeStroke = "#7c3aed"
                textFill = "#ffffff"
            } else if (tag === "Function Scope") {
                badgeFill = "#3b82f6"
                badgeStroke = "#1d4ed8"
                textFill = "#ffffff"
            } else if (tag === "Block Scope") {
                badgeFill = "#f59e0b"
                badgeStroke = "#d97706"
                textFill = "#ffffff"
            }

            // Badge background rectangle
            badgeGroup
                .append("rect")
                .attr("x", currentX)
                .attr("y", 10)
                .attr("width", textWidth)
                .attr("height", badgeHeight)
                .attr("rx", 10) // Rounded corners
                .attr("ry", 10)
                .attr("fill", badgeFill)
                .attr("stroke", badgeStroke)
                .attr("stroke-width", 1)

            // Badge text
            badgeGroup
                .append("text")
                .attr("x", currentX)
                .attr("y", 24)
                .attr("font-weight", "600")
                .attr("font-size", "10px")
                .attr("fill", textFill)
                .attr("text-anchor", "middle")
                .attr("transform", `translate(${textWidth / 2}, 0)`)
                .text(badgeText)

            // Update position for next badge
            currentX += textWidth + badgeSpacing
        })

        // Draw variables - ensure all variables are drawn regardless of ELK positioning
        scopeData.variables.forEach((varData, varIndex: number) => {
            const varNodeId = `var-${scopeNode.id}-${varData.name}`

            const variableGroup = scopeGroup
                .append("g")
                .attr("class", "variable")
                .attr("transform", `translate(10, ${40 + varIndex * 35})`)

            // Draw file icon
            variableGroup
                .append("rect")
                .attr("width", 16)
                .attr("height", 20)
                .attr("fill", "white")
                .attr("stroke", "black")
                .attr("stroke-width", 1)

            // Draw file icon fold
            variableGroup
                .append("path")
                .attr("d", `M11,0 L11,5 L16,5 L16,0 Z`)
                .attr("fill", "white")
                .attr("stroke", "black")
                .attr("stroke-width", 1)

            // Add variable name   
            const isReference = varData.type === "reference"
            const displayText = `${varData.name}${isReference ? " ↗️" : ` = ${varData.value}`}`

            variableGroup
                .append("text")
                .attr("x", 21)
                .attr("y", 15)
                .attr("font-size", "12px")
                .attr("fill", scopeData.textColor)
                .text(displayText)

            // Store variable position for connections - position at the left side of the scope
            const varX = (scopeSection.x || 0) + scale * (scopeX + 5)
            const varY = (scopeSection.y || 0) + scale * (bottomAnchorOffset + scopeY + 35 + varIndex * 35 + 15)
            nodePositions.set(varNodeId, { x: varX, y: varY })

            // Add a small circle at the connection point for variables (only for reference types)
            if (varData.type === "reference") {
                variableGroup
                    .append("circle")
                    .attr("cx", -5)
                    .attr("cy", 10)
                    .attr("r", 3)
                    .attr("fill", "#4299e1")
                    .attr("stroke", "none")
            }

            // Add edge data if it's a reference
            if (varData.type === "reference" && varData.target) {
                edgeData.push({
                    source: varNodeId,
                    target: varData.target,
                    type: "var-ref",
                    label: varData.name,
                })
            }
        })
    })
}
