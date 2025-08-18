import { useCallback, useEffect, useMemo, useRef } from "react"
import * as d3 from "d3"
import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkNode as ElkLayoutNode, ElkEdge as ElkLayoutEdge } from "elkjs/lib/elk-api"
import { HEAP_OBJECT_TYPE, EXEC_STEP_TYPE } from "@/types/simulator"
import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { getStepColorByDepth } from "@/helpers/steps"
import useElementSize from "@/hooks/useElementSize"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuTrigger,
    ContextMenuCheckboxItem,
    ContextMenuLabel,
    ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
    createMemvalSection,
    createMemvalNodes,
    createMemvalEdges,
    renderMemvalSection,
    MEMVAL_SECTION_WIDTH,
} from "./sections/memval"
import {
    createScopeSection,
    createScopeNodes,
    createScopeEdges,
    renderScopeSection,
    SCOPE_SECTION_WIDTH,
} from "./sections/scope"
import {
    createHeapSection,
    createHeapNodes,
    formatPropertyValue,
    renderHeapSection,
    type HeapObjectData,
} from "./sections/heap"



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

// Define types for ELK graph structure - Adjusted ElkNode and ElkEdge to be closer to elkjs types
type ElkNode = Omit<ElkLayoutNode, 'labels' | 'children' | 'edges'> & {
    id: string // Ensure id is always string
    width?: number
    height?: number
    x?: number
    y?: number
    layoutOptions?: Record<string, string>
    // Adjust label type to match elkjs (text, width, height can be undefined)
    labels?: { text?: string; width?: number; height?: number }[]
    children?: ElkNode[]
}

type ElkEdge = Omit<ElkLayoutEdge, 'sources' | 'targets'> & {
    id: string // Ensure id is always string
    sources: string[]
    targets: string[]
    layoutOptions?: Record<string, string>
    propIndex?: number
}

// Ensure ElkGraph uses the adjusted ElkNode and ElkEdge
type ElkGraph = ElkNode & {
    edges: ElkEdge[]
}

// Horizontal spacing between major sections (memval | heap | scope)
const SECTION_HORIZONTAL_GAP = 5

type ArrowState = {
    sourcePos: { x: number; y: number } | null
    targetPos: { x: number; y: number } | null
    direction: { dx: number; dy: number } | null
}

const MemoryModelVisualizer = () => {
    const { currentStep, steps, settings, toggleAutoZoom } = useSimulatorStore()
    const svgRef = useRef<SVGSVGElement>(null)
    const [containerRef, containerSize] = useElementSize<HTMLDivElement>()

    // Refs for mutable data to prevent re-renders
    const currentStepRef = useRef(currentStep)
    const stepsRef = useRef(steps)
    const isInitializedRef = useRef(false)
    const isUpdatingRef = useRef(false)
    const d3ContainerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
    const zoomRef = useRef<d3.ZoomBehavior<Element, unknown> | null>(null)

    // Add refs for arrow state tracking
    const previousArrowStatesRef = useRef<Map<string, ArrowState>>(new Map())
    const currentArrowStatesRef = useRef<Map<string, ArrowState>>(new Map())

    // Update refs when props change
    useEffect(() => {
        currentStepRef.current = currentStep
        stepsRef.current = steps
    }, [currentStep, steps])

    const getMaxDepth = useMemo(() => {
        return Math.max(...steps.map(step => step.scopeIndex))
    }, [steps])

    // Transform snapshot data into visualization format
    const transformData = useCallback(() => {
        const currentStepData = currentStepRef.current
        const stepsData = stepsRef.current
        const scopesData: ScopeData[] = []
        const heapData: HeapObjectData[] = []

        // Categorize scopes with depth-based colors (reverse order - global at bottom)
        const reversedScopes = [...(currentStepData?.memorySnapshot.scopes || [])].reverse()
        reversedScopes.forEach((scope, reversedIndex) => {
            // Calculate original index for color and current scope detection
            const originalIndex = (currentStepData?.memorySnapshot.scopes.length || 0) - 1 - reversedIndex
            const scopeId = `scope-${originalIndex}`

            // Get depth-based colors using original depth and max depth
            const stepColor = getStepColorByDepth(
                originalIndex,
                getMaxDepth,
                scope.type === "function"
            )

            // Identify scope type for tag
            let scopeTags: string[] = []
            let scopeType = ""
            if (scope.type === "global") {
                scopeTags = ["Global Scope"]
                scopeType = "global"
            } else if (scope.type === "function") {
                scopeTags = ["Function Scope"]
                scopeType = "function"
            } else if (scope.type === "block") {
                scopeTags = ["Block Scope"]
                scopeType = "block"
            } else {
                scopeTags = ["Unknown Scope"]
                scopeType = "unknown"
            }

            // Add current scope indicator
            // For POP_SCOPE steps, use the parent scope (next step's scopeIndex)
            const effectiveScopeIndex = currentStepData?.type === EXEC_STEP_TYPE.POP_SCOPE && currentStepData.index < stepsData.length - 1
                ? stepsData[currentStepData.index + 1].scopeIndex
                : currentStepData?.scopeIndex
            const isCurrentScope = originalIndex === effectiveScopeIndex
            if (isCurrentScope) {
                scopeTags.push("Current")
            }

            // Process variables in scope
            const variables = Object.entries(scope.variables).map(([name, variable]) => {
                const varId = `var-${scopeId}-${name}`
                let varType = "primitive"
                let target = undefined

                // Check if it's a reference to a heap object
                if (variable.value.type === "reference") {
                    varType = "reference"
                    target = `obj-${variable.value.ref}`
                }

                // Format the value for display
                let displayValue
                if (variable.value.type === "primitive") {
                    if (variable.value.value === undefined) {
                        displayValue = "undefined"
                    } else if (variable.value.value === null) {
                        displayValue = "null"
                    } else if (variable.value.value === "not_initialized") {
                        displayValue = "<TDZ>"
                    } else {
                        if (typeof variable.value.value === 'string') {
                            displayValue = `"${variable.value.value}"`
                        } else {
                            displayValue = String(variable.value.value)
                        }
                    }
                } else {
                    // For references, we'll enhance this after heap data is available
                    displayValue = variable.value.ref
                }

                return {
                    id: varId,
                    name,
                    type: varType,
                    target,
                    value: displayValue as string
                }
            })

            scopesData.push({
                id: scopeId,
                name: scopeTags.join(" "),
                scopeTags,
                scopeType,
                isCurrentScope,
                color: stepColor.backgroundColor,
                borderColor: stepColor.borderColor,
                textColor: stepColor.textColor,
                variables
            })
        })

        // Process heap objects first to get type information
        Object.entries(currentStepData?.memorySnapshot.heap ?? {}).forEach(([ref, obj]) => {
            const objId = `obj-${ref}`
            let objType = "Object"
            let objColor = "#fefcbf"
            let objBorderColor = "#ecc94b"

            if (obj.type === HEAP_OBJECT_TYPE.ARRAY) {
                objType = "Array"
                objColor = "#c6f6d5"
                objBorderColor = "#68d391"
            } else if (obj.type === HEAP_OBJECT_TYPE.FUNCTION) {
                objType = "Function"
                objColor = "#bee3f8"
                objBorderColor = "#63b3ed"
            }

            heapData.push({
                id: objId,
                type: objType,
                color: objColor,
                borderColor: objBorderColor,
                properties: [] // Will be populated after heap data is available
            })
        })

        // Now process heap object properties with type information available
        Object.entries(currentStepData?.memorySnapshot.heap ?? {}).forEach(([ref, obj]) => {
            const objId = `obj-${ref}`
            const heapObj = heapData.find(h => h.id === objId)
            if (!heapObj) return

            const properties: { name: string; value: string; target?: string }[] = []

            if (obj.type === HEAP_OBJECT_TYPE.OBJECT) {
                // Process object properties
                Object.entries(obj.properties).forEach(([propName, propValue]) => {
                    const property = formatPropertyValue(propName, propValue)
                    properties.push(property)
                })
            } else if (obj.type === HEAP_OBJECT_TYPE.ARRAY) {
                // Process array elements
                obj.elements.forEach((element, index) => {
                    if (element !== undefined) {
                        const property = formatPropertyValue(String(index), element)
                        properties.push(property)
                    }
                })
                // Add length property
                properties.push({
                    name: "length",
                    value: String(obj.elements.length)
                })
            } else if (obj.type === HEAP_OBJECT_TYPE.FUNCTION) {
                // Display function node information
                properties.push({
                    name: "type",
                    value: "function"
                })
            }

            heapObj.properties = properties
        })

        // Enhance scope variable references with <Reference> display
        scopesData.forEach(scope => {
            scope.variables.forEach(variable => {
                if (variable.type === "reference") {
                    variable.value = "<Reference>"
                }
            })
        })

        return {
            scopes: scopesData,
            heap: heapData
        }
    }, [getMaxDepth])



    // Function to detect if arrow direction has changed
    const hasArrowDirectionChanged = useCallback((edgeId: string, currentState: ArrowState): boolean => {
        const previousState = previousArrowStatesRef.current.get(edgeId)
        if (!previousState) return true // New arrow, consider it changed

        // Check if source or target positions changed
        if (!previousState.sourcePos || !previousState.targetPos || !currentState.sourcePos || !currentState.targetPos) {
            return true
        }

        // Check if positions changed significantly (more than 0.5 pixel for precision)
        const sourceChanged = Math.abs(previousState.sourcePos.x - currentState.sourcePos.x) > 0.5 ||
            Math.abs(previousState.sourcePos.y - currentState.sourcePos.y) > 0.5
        const targetChanged = Math.abs(previousState.targetPos.x - currentState.targetPos.x) > 0.5 ||
            Math.abs(previousState.targetPos.y - currentState.targetPos.y) > 0.5

        return sourceChanged || targetChanged
    }, [])

    // Function to update connections with arrow state tracking
    const updateConnections = useCallback((
        rootContainer: d3.Selection<SVGGElement, unknown, null, undefined>,
        nodePositions: Map<string, { x: number; y: number }>,
        propertyPositions: Map<string, { x: number; y: number }>,
        edgeData: Array<{ source: string; target: string; type: string; label?: string; propIndex?: number }>
    ) => {
        // Define the calculatePath function for exactly straight lines
        const calculatePath = (
            source: { x: number; y: number },
            target: { x: number; y: number }
        ): string => {
            const path = d3.path()

            // Draw exactly straight line from source to target
            path.moveTo(source.x, source.y)
            path.lineTo(target.x, target.y)

            return path.toString()
        }

        // Clear current arrow states
        currentArrowStatesRef.current.clear()

        // Track which arrows need to be updated vs created
        const arrowsToUpdate = new Map<string, { element: d3.Selection<SVGPathElement, unknown, null, undefined>, newPath: string }>()
        const arrowsToCreate = new Array<{ edge: typeof edgeData[0], sourcePos: { x: number; y: number }, targetPos: { x: number; y: number } }>()

        edgeData.forEach((edge) => {
            const sourcePos = edge.type === "prop-ref" ? propertyPositions.get(edge.source) : nodePositions.get(edge.source)
            const targetPos = nodePositions.get(edge.target)

            if (!sourcePos || !targetPos) return

            // Create unique edge ID for tracking
            const edgeId = `${edge.source}-${edge.target}-${edge.type}`

            // Calculate current arrow state
            const currentState: ArrowState = {
                sourcePos,
                targetPos,
                direction: {
                    dx: targetPos.x - sourcePos.x,
                    dy: targetPos.y - sourcePos.y
                }
            }

            // Store current state
            currentArrowStatesRef.current.set(edgeId, currentState)

            // Check if arrow already exists and if its position has changed
            const existingArrow = d3.select(svgRef.current!).select(`[data-edge-id="${edgeId}"]`)
            const hasChanged = hasArrowDirectionChanged(edgeId, currentState)

            if (existingArrow.size() > 0 && !hasChanged) {
                // Arrow exists and hasn't changed - keep it as is
                return
            } else if (existingArrow.size() > 0 && hasChanged) {
                // Arrow exists but has changed - update it
                const newPath = calculatePath(sourcePos, targetPos)
                arrowsToUpdate.set(edgeId, { element: existingArrow as unknown as d3.Selection<SVGPathElement, unknown, null, undefined>, newPath })
            } else {
                // Arrow doesn't exist - create it
                arrowsToCreate.push({ edge, sourcePos, targetPos })
            }
        })

        // Remove arrows that no longer exist
        const currentArrowIds = new Set(currentArrowStatesRef.current.keys())
        const existingArrowIds = new Set<string>()

        d3.select(svgRef.current!).selectAll("[data-edge-id]").each(function () {
            const edgeId = d3.select(this).attr("data-edge-id")
            if (edgeId) {
                existingArrowIds.add(edgeId)
            }
        })

        for (const edgeId of existingArrowIds) {
            if (!currentArrowIds.has(edgeId)) {
                d3.select(svgRef.current!).select(`[data-edge-id="${edgeId}"]`).remove()
            }
        }

        // Update existing arrows that have changed
        arrowsToUpdate.forEach(({ element, newPath }) => {
            element.attr("d", newPath)
                .style("pointer-events", "all")
                .style("z-index", "1000")

            // Move updated arrow to the end of the container to ensure it's on top
            const container = rootContainer.node()
            const arrowNode = element.node()
            if (container && arrowNode) {
                container.appendChild(arrowNode)
            }
        })

        // Log optimization stats
        if (arrowsToUpdate.size > 0 || arrowsToCreate.length > 0) {
            console.log(`Arrow optimization: ${arrowsToUpdate.size} updated, ${arrowsToCreate.length} created, ${edgeData.length - arrowsToUpdate.size - arrowsToCreate.length} unchanged`)
        }

        // Create new arrows
        arrowsToCreate.forEach(({ edge, sourcePos, targetPos }) => {
            const edgeId = `${edge.source}-${edge.target}-${edge.type}`

            let arrowType
            let strokeColor

            if (edge.type === "var-ref") {
                arrowType = "arrow-var-ref"
                strokeColor = "#4299e1"
            } else if (edge.type === "prop-ref") {
                arrowType = "arrow-prop-ref"
                strokeColor = "#ed8936"
            } else if (edge.type === "memval-ref") {
                arrowType = "arrow-memval-ref"
                strokeColor = "#8b5cf6"
            } else if (edge.type === "memval-layered") {
                arrowType = "arrow-memval-layered"
                strokeColor = "#10b981"
            } else {
                arrowType = "arrow-var-ref"
                strokeColor = "#4299e1"
            }

            // Create the arrow path and move it to the top
            const arrowElement = rootContainer
                .append("path")
                .attr("class", "connection")
                .attr("d", calculatePath(sourcePos, targetPos))
                .attr("stroke", strokeColor)
                .attr("stroke-width", 1.5)
                .attr("fill", "none")
                .attr("marker-end", `url(#${arrowType})`)
                .attr("data-source", edge.source)
                .attr("data-target", edge.target)
                .attr("data-edge-id", edgeId)
                .style("pointer-events", "all")
                .style("z-index", "1000")
                .on("mouseover", function () {
                    d3.select(this).attr("stroke", "#e53e3e").attr("marker-end", "url(#arrow-highlight)")
                })
                .on("mouseout", function () {
                    d3.select(this)
                        .attr("stroke", strokeColor)
                        .attr("marker-end", `url(#${arrowType})`)
                })

            // Move arrow to the end of the container to ensure it's on top
            rootContainer.node()?.appendChild(arrowElement.node()!)
        })

        // Update previous states for next comparison
        previousArrowStatesRef.current = new Map(currentArrowStatesRef.current)
    }, [hasArrowDirectionChanged])

    // Function to render the complete visualization
    const renderVisualization = useCallback((memoryModelData: ReturnType<typeof transformData>) => {
        if (!svgRef.current || !d3ContainerRef.current) return
        if (!containerSize.width || !containerSize.height) return

        const currentStepData = currentStepRef.current
        if (!currentStepData) return

        // Clear existing content (this will be called after fade-out transition)
        d3ContainerRef.current.selectAll("*").remove()

        // Define common dimensions (smaller heap objects and items)
        const objectWidth = 150
        const objectHeight = 90

        // Calculate viewport dimensions (use container size or default)
        const viewportWidth = containerSize.width
        const viewportHeight = containerSize.height

        // Create SVG with 100% width and height
        const svg = d3
            .select(svgRef.current)
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`)

        // Create zoom behavior - configurable auto zoom
        const zoom = d3.zoom()
            .scaleExtent([0.5, 2])
            .on("zoom", (event) => {
                const { transform } = event
                rootContainer.attr("transform", transform)
            })

        // Apply zoom behavior to SVG
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        svg.call(zoom as any)

        // Create a container for the graph within the root container
        const rootContainer = svg.append("g")

        // Background rectangles and dividers will be added dynamically after layout

        // Create maps to store node positions and edge data
        const nodePositions = new Map()
        const propertyPositions = new Map()
        const edgeData: Array<{
            source: string
            target: string
            type: string
            label?: string
            propIndex?: number
        }> = []

        // Prepare ELK graph structure
        const createElkGraph = (): ElkGraph => {
            const graph: ElkGraph = {
                id: "root",
                children: [],
                edges: [],
            }

            // Create a section for memval with layered algorithm from bottom to top
            const memvalSection = createMemvalSection()

            // Create a section for scopes with layered algorithm from bottom to top
            const scopeSection = createScopeSection()

            // Create a section for heap with content-based sizing
            const heapSection = createHeapSection()

            // Add memval nodes with layered algorithm (bottom to top)
            const memvalItems = currentStepData?.memorySnapshot.memval || []

            // Create memval nodes using the module (even if empty, the section will be created)
            const memvalNodes = createMemvalNodes(memvalItems)
            memvalSection.children?.push(...memvalNodes)

            // Add edges between memval items to create layered structure (only if there are items)
            if (memvalItems.length > 0) {
                const memvalEdges = createMemvalEdges(memvalItems)
                graph.edges.push(...memvalEdges)
            }

            // Note: Removed memval layered edges to avoid drawing lines within the section

            // Add scope nodes with layered algorithm (bottom to top)
            const scopeItems = memoryModelData.scopes

            // Create scope nodes using the module
            const scopeNodes = createScopeNodes(scopeItems)
            scopeSection.children?.push(...scopeNodes)

            // Add edges between scopes to create layered structure (bottom to top)
            const scopeEdges = createScopeEdges(scopeItems)
            graph.edges.push(...scopeEdges)

            // Add heap object nodes
            const heapNodes = createHeapNodes(memoryModelData.heap, objectWidth, objectHeight)
            heapSection.children?.push(...heapNodes)

            graph.children?.push(memvalSection)
            graph.children?.push(scopeSection)
            graph.children?.push(heapSection)

            // Note: Variable-to-heap edges are handled separately in the rendering phase
            // to avoid ELK layout conflicts with variable nodes that are rendered within scopes

            // Note: Heap object property edges are handled separately in the rendering phase
            // to avoid ELK layout conflicts with property nodes that are rendered within heap objects

            return graph
        }

        const elkGraph = createElkGraph()
        const elk = new ELK()

        // Run the layout algorithm
        elk
            .layout(elkGraph)
            .then((layoutedGraph) => {
                // Get memval, scope and heap sections from layouted graph
                const memvalSection = layoutedGraph.children?.find(section => section.id === "memvalSection")
                const scopeSection = layoutedGraph.children?.find(section => section.id === "scopeSection")
                const heapSection = layoutedGraph.children?.find(section => section.id === "heapSection")

                if (!memvalSection || !scopeSection || !heapSection) return

                // Calculate actual section widths after layout
                const calculateSectionWidth = (section: ElkNode): number => {
                    if (section.id === "memvalSection") {
                        return MEMVAL_SECTION_WIDTH
                    }

                    if (section.id === "scopeSection") {
                        return SCOPE_SECTION_WIDTH
                    }

                    const children = section.children ?? []
                    if (children.length === 0) return 0

                    // Find the rightmost edge of all children
                    const rightmostEdge = Math.max(...children.map(child =>
                        (child.x || 0) + (child.width || 200)
                    ))

                    return rightmostEdge + 160
                }

                // Calculate actual section dimensions
                const actualMemvalSectionWidth = calculateSectionWidth(memvalSection) // Always calculate width for memval section
                const actualScopeSectionWidth = calculateSectionWidth(scopeSection)

                // Calculate heap section width as remaining width, accounting for horizontal gaps between sections
                // Layout: [memval] gap [heap] gap [scope]
                let actualHeapSectionWidth = containerSize.width - actualMemvalSectionWidth - actualScopeSectionWidth - SECTION_HORIZONTAL_GAP * 2

                // Calculate heap section height based on viewport; will grow after layout if needed
                const heapContentHeight = containerSize.height

                // Determine if we need to proportionally scale memval and scope sections
                const minHeapWidthNeeded = objectWidth + 40
                const fixedSectionsWidth = actualMemvalSectionWidth + actualScopeSectionWidth
                let sectionsScale = 1
                if (actualHeapSectionWidth < minHeapWidthNeeded && fixedSectionsWidth > 0) {
                    const availableForFixed = Math.max(60, containerSize.width - minHeapWidthNeeded - SECTION_HORIZONTAL_GAP * 2)
                    sectionsScale = Math.max(0.6, Math.min(1, availableForFixed / fixedSectionsWidth))
                    // Recompute widths with scale
                    const scaledMemvalWidth = Math.round(actualMemvalSectionWidth * sectionsScale)
                    const scaledScopeWidth = Math.round(actualScopeSectionWidth * sectionsScale)
                    actualHeapSectionWidth = containerSize.width - scaledMemvalWidth - scaledScopeWidth - SECTION_HORIZONTAL_GAP * 2
                    memvalSection.width = scaledMemvalWidth
                    scopeSection.width = scaledScopeWidth
                    heapSection.width = actualHeapSectionWidth
                } else {
                    memvalSection.width = actualMemvalSectionWidth
                    scopeSection.width = actualScopeSectionWidth
                    heapSection.width = actualHeapSectionWidth
                }

                // Set section heights to fit container height if they are smaller
                if (!memvalSection.height || memvalSection.height && memvalSection.height < containerSize.height) {
                    memvalSection.height = containerSize.height
                }
                if (!scopeSection.height || scopeSection.height && scopeSection.height < containerSize.height) {
                    scopeSection.height = containerSize.height
                }
                // Set heap section height based on content
                heapSection.height = heapContentHeight

                // Position sections with horizontal gaps: memval -> gap -> heap -> gap -> scope
                memvalSection.x = 0
                heapSection.x = (memvalSection.width || 0) + SECTION_HORIZONTAL_GAP
                scopeSection.x = (memvalSection.width || 0) + SECTION_HORIZONTAL_GAP + (heapSection.width || 0) + SECTION_HORIZONTAL_GAP

                memvalSection.y = 0
                scopeSection.y = 0
                heapSection.y = 0

                // Calculate total content dimensions
                const totalContentWidth = (memvalSection.width || 0) + SECTION_HORIZONTAL_GAP + (heapSection.width || 0) + SECTION_HORIZONTAL_GAP + (scopeSection.width || 0)
                const totalContentHeight = containerSize.height

                // Calculate container center
                const containerCenterX = containerSize.width / 2
                const containerCenterY = containerSize.height / 2

                // Calculate content center
                const contentCenterX = totalContentWidth / 2
                const contentCenterY = totalContentHeight / 2

                // Calculate centering offset
                const centerX = containerCenterX - contentCenterX
                const centerY = containerCenterY - contentCenterY

                // Apply centering transform via d3.zoom so internal state stays in sync
                const initialTransform = d3.zoomIdentity.translate(centerX, centerY)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                svg.call((zoom as any).transform, initialTransform)

                // Add arrow marker definitions with different colors and sizes
                const defs = svg.append("defs")

                // Variable reference arrow (blue)
                defs
                    .append("marker")
                    .attr("id", "arrow-var-ref")
                    .attr("viewBox", "0 -5 10 10")
                    .attr("refX", 8)
                    .attr("refY", 0)
                    .attr("markerWidth", 6)
                    .attr("markerHeight", 6)
                    .attr("orient", "auto")
                    .append("path")
                    .attr("d", "M0,-4L8,0L0,4")
                    .attr("fill", "#4299e1")

                // Object property reference arrow (orange)
                defs
                    .append("marker")
                    .attr("id", "arrow-prop-ref")
                    .attr("viewBox", "0 -5 10 10")
                    .attr("refX", 8)
                    .attr("refY", 0)
                    .attr("markerWidth", 6)
                    .attr("markerHeight", 6)
                    .attr("orient", "auto")
                    .append("path")
                    .attr("d", "M0,-4L8,0L0,4")
                    .attr("fill", "#ed8936")

                // Memval reference arrow (purple)
                defs
                    .append("marker")
                    .attr("id", "arrow-memval-ref")
                    .attr("viewBox", "0 -5 10 10")
                    .attr("refX", 8)
                    .attr("refY", 0)
                    .attr("markerWidth", 6)
                    .attr("markerHeight", 6)
                    .attr("orient", "auto")
                    .append("path")
                    .attr("d", "M0,-4L8,0L0,4")
                    .attr("fill", "#8b5cf6")

                // Memval layered arrow (green)
                defs
                    .append("marker")
                    .attr("id", "arrow-memval-layered")
                    .attr("viewBox", "0 -5 10 10")
                    .attr("refX", 8)
                    .attr("refY", 0)
                    .attr("markerWidth", 6)
                    .attr("markerHeight", 6)
                    .attr("orient", "auto")
                    .append("path")
                    .attr("d", "M0,-4L8,0L0,4")
                    .attr("fill", "#10b981")

                // Highlighted arrow (red)
                defs
                    .append("marker")
                    .attr("id", "arrow-highlight")
                    .attr("viewBox", "0 -5 10 10")
                    .attr("refX", 8)
                    .attr("refY", 0)
                    .attr("markerWidth", 8)
                    .attr("markerHeight", 8)
                    .attr("orient", "auto")
                    .append("path")
                    .attr("d", "M0,-5L10,0L0,5")
                    .attr("fill", "#e53e3e")


                // Draw memval items using the module - always show memval section
                const memvalItems = currentStepData?.memorySnapshot.memval || []



                renderMemvalSection({
                    memvalSection,
                    memvalItems,
                    rootContainer,
                    nodePositions,
                    edgeData,
                    scale: sectionsScale,
                    viewportHeight: containerSize.height,
                })

                // Draw scopes using the module (always render section, even when empty)
                renderScopeSection({
                    scopeSection,
                    scopeItems: memoryModelData.scopes,
                    rootContainer,
                    nodePositions,
                    edgeData,
                    scale: sectionsScale,
                    viewportHeight: containerSize.height,
                })

                // Draw heap objects using the module
                renderHeapSection({
                    heapSection,
                    heapData: memoryModelData.heap,
                    rootContainer,
                    nodePositions,
                    propertyPositions,
                    edgeData,
                    scale: sectionsScale,
                    viewportHeight: containerSize.height,
                    objectWidth,
                    objectHeight,
                }).then(() => {
                    // Initial draw of connections after all modules have rendered
                    updateConnections(rootContainer, nodePositions, propertyPositions, edgeData)
                })


            })
            .catch((error) => {
                console.error("ELK layout error:", error)
            })
    }, [containerSize])

    // Function to update visualization without recreating everything
    const updateVisualization = useCallback(() => {
        if (!currentStepRef.current) return
        if (!d3ContainerRef.current) return

        // Transform the data into visualization format
        const memoryModelData = transformData()

        // Check if we need to do a full re-render or just update data
        const currentContainer = d3ContainerRef.current
        const hasExistingContent = currentContainer.selectAll(".heap-object, .scope-object, .memval-object").size() > 0

        if (!hasExistingContent) {
            // First time rendering, do full render
            renderVisualization(memoryModelData)
            return
        }

        // Use smooth transitions to prevent flashing
        renderVisualizationWithTransitions(memoryModelData)
    }, [transformData, renderVisualization])

    // Function to render with smooth transitions to prevent flashing
    const renderVisualizationWithTransitions = useCallback((memoryModelData: ReturnType<typeof transformData>) => {
        if (!svgRef.current || !d3ContainerRef.current) return
        if (!containerSize.width || !containerSize.height) return

        const currentStepData = currentStepRef.current
        if (!currentStepData) return

        // Simple approach: fade out, update, fade in
        const container = d3ContainerRef.current

        // Fade out existing content
        container
            .selectAll("*")
            .transition()
            .duration(100)
            .style("opacity", 0)
            .on("end", function () {
                // Remove old content
                d3.select(this).remove()

                // Render new content
                renderVisualization(memoryModelData)

                // Fade in new content
                container
                    .selectAll("*")
                    .style("opacity", 0)
                    .transition()
                    .duration(150)
                    .style("opacity", 1)
            })
    }, [containerSize, renderVisualization])



    // Initialize D3 visualization once
    useEffect(() => {
        if (!svgRef.current) return
        if (!containerSize.width || !containerSize.height) return
        if (isInitializedRef.current) return

        // Create SVG with 100% width and height
        const svg = d3
            .select(svgRef.current)
            .attr("width", "100%")
            .attr("height", "100%")

        // Create zoom behavior - configurable auto zoom
        const zoom = d3.zoom()
            .scaleExtent([0.5, 2])
            .on("zoom", (event) => {
                const { transform } = event
                if (d3ContainerRef.current) {
                    d3ContainerRef.current.attr("transform", transform)
                }
            })

        // Apply zoom behavior to SVG
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        svg.call(zoom as any)
        zoomRef.current = zoom

        // Create a container for the graph within the root container
        d3ContainerRef.current = svg.append("g")

        isInitializedRef.current = true
    }, [containerSize.width, containerSize.height])

    // Update visualization when step changes with debouncing to prevent rapid re-renders
    useEffect(() => {
        if (!isInitializedRef.current) return
        if (isUpdatingRef.current) return // Prevent concurrent updates

        // Debounce the update to prevent rapid re-renders
        const timeoutId = setTimeout(() => {
            isUpdatingRef.current = true
            updateVisualization()
            // Reset the flag after a short delay to allow for transitions
            setTimeout(() => {
                isUpdatingRef.current = false
            }, 300)
        }, 50) // Small delay to batch rapid step changes

        return () => clearTimeout(timeoutId)
    }, [currentStep, updateVisualization])

    // Add effect to handle arrow direction changes
    useEffect(() => {
        if (!isInitializedRef.current) return

        // Check if arrows need updating when step changes
        // This will trigger a re-render of arrows when their from/to directions change
        const checkArrowChanges = () => {
            // Clear previous arrow states to force re-rendering
            previousArrowStatesRef.current.clear()
            currentArrowStatesRef.current.clear()
        }

        checkArrowChanges()
    }, [currentStep])

    return (
        <div ref={containerRef} className="relative w-full h-full">
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div className="w-full h-full">
                        <svg
                            ref={svgRef}
                            className="w-full h-full [&_*]:transition-opacity [&_*]:duration-200"
                        />
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48 ">
                    <ContextMenuLabel className="text-xs">Memory Model Settings</ContextMenuLabel>
                    <ContextMenuSeparator />
                    <ContextMenuCheckboxItem
                        checked={settings.autoZoom}
                        onCheckedChange={toggleAutoZoom}
                        className="text-xs"
                    >
                        Auto Zoom
                    </ContextMenuCheckboxItem>
                </ContextMenuContent>
            </ContextMenu>
        </div>
    )
}

export default MemoryModelVisualizer 
