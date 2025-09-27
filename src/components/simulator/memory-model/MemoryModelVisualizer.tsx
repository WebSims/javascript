import { useCallback, useEffect, useMemo, useRef } from "react"
import * as d3 from "d3"
import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkNode as ElkLayoutNode, ElkEdge as ElkLayoutEdge } from "elkjs/lib/elk-api"
import { HEAP_OBJECT_TYPE, EXEC_STEP_TYPE, type MemvalChange, type Memval } from "@/types/simulator"
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
    addMemvalItem,
    removeMemvalItem,
    MEMVAL_ITEM_HEIGHT,
    MEMVAL_ITEM_WIDTH,
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

export const MemoryModelVisualizer = () => {
    const { currentStep, steps, settings, toggleAutoZoom } = useSimulatorStore()
    const svgRef = useRef<SVGSVGElement>(null)
    const [containerRef, containerSize] = useElementSize<HTMLDivElement>()
    const previousStepRef = useRef<number | null>(null)
    const rootContainerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
    const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
    const propertyPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

    const getMaxDepth = useMemo(() => {
        return Math.max(...steps.map(step => step.scopeIndex))
    }, [steps])


    // Utility function to get memval items from d3 DOM elements
    const getMemvalItemsFromD3 = useCallback(() => {
        const svg = d3.select(svgRef.current)
        if (svg.empty()) {
            console.warn("SVG element not found")
            return []
        }

        const memvalContainer = svg.select(".memval-section")
        if (memvalContainer.empty()) {
            console.warn("Memval section container not found")
            return []
        }

        const memvalItems = memvalContainer.selectAll(".memval-item")

        return memvalItems.nodes()
    }, [])


    const calculatePath = useCallback((
        source: { x: number; y: number },
        target: { x: number; y: number }
    ): string => {
        const path = d3.path()
        path.moveTo(source.x, source.y)
        path.lineTo(target.x, target.y)
        return path.toString()
    }, [])

    const drawConnection = useCallback((
        sourcePos: { x: number; y: number },
        targetPos: { x: number; y: number },
        type: 'var-ref' | 'prop-ref' | 'memval-ref' | 'memval-layered',
        id: string
    ) => {
        const rootContainer = rootContainerRef.current
        if (!rootContainer) return

        let arrowType: string
        let strokeColor: string

        if (type === "var-ref") {
            arrowType = "arrow-var-ref"
            strokeColor = "#4299e1"
        } else if (type === "prop-ref") {
            arrowType = "arrow-prop-ref"
            strokeColor = "#ed8936"
        } else if (type === "memval-ref") {
            arrowType = "arrow-memval-ref"
            strokeColor = "#8b5cf6"
        } else if (type === "memval-layered") {
            arrowType = "arrow-memval-layered"
            strokeColor = "#10b981"
        } else {
            arrowType = "arrow-var-ref"
            strokeColor = "#4299e1"
        }

        rootContainer
            .append("path")
            .attr("class", "connection connection-memval")
            .attr("id", id)
            .attr("d", calculatePath(sourcePos, targetPos))
            .attr("stroke", strokeColor)
            .attr("stroke-width", 1.5)
            .attr("fill", "none")
            .attr("marker-end", `url(#${arrowType})`)
    }, [calculatePath])

    /*
     * Usage Examples:
     * 
     * 1. Get memval items from data source:
     *    const { items, count } = getCurrentMemvalItems()
     *    console.log(`Found ${count} memval items:`, items)
     * 
     * 2. Get memval items from d3 DOM elements:
     *    const { items, count } = getMemvalItemsFromD3()
     *    console.log(`Found ${count} rendered memval items:`, items)
     * 
     * 3. Get comprehensive memval information:
     *    const memvalInfo = getAllMemvalInfo()
     *    console.log('Data count:', memvalInfo.fromData.count)
     *    console.log('D3 DOM count:', memvalInfo.fromD3DOM.count)
     *    console.log('Are counts consistent?', memvalInfo.summary.isConsistent)
     */

    // Special function for single step changes with sequential animation
    const handleMemvalChanges = useCallback((direction: 'forward' | 'backward') => {
        console.log(`Handling memval changes for ${direction} step`)

        const svg = d3.select(svgRef.current)
        if (svg.empty()) {
            console.warn("SVG element not found")
            return
        }

        const memvalContainer = svg.select(".memval-section")
        if (memvalContainer.empty()) {
            console.warn("Memval section container not found")
            return
        }

        let changesToProcess: MemvalChange[] = []

        if (direction === 'forward' && currentStep?.memvalChanges) {
            changesToProcess = currentStep.memvalChanges
        } else if (direction === 'backward' && previousStepRef.current !== null) {
            const previousStep = steps.find(step => step.index === previousStepRef.current)
            if (previousStep?.memvalChanges) {
                // To reverse the changes, we invert the operation and reverse the order
                changesToProcess = [...previousStep.memvalChanges].reverse().map(change => ({
                    ...change,
                    type: change.type === 'push' ? 'pop' : 'push',
                }))
            }
        }

        if (changesToProcess.length === 0) {
            return
        }

        // Process memvalChanges sequentially with proper animation callbacks
        const processMemvalChangesSequentially = (changes: MemvalChange[], index = 0) => {
            if (index >= changes.length) {
                console.log("All memval changes processed sequentially")
                return
            }

            const item = changes[index]
            console.log(`Processing memval change ${index + 1}/${changes.length}:`, item)

            if (item.type === 'push') {
                console.log("Adding item to current chart:", item.value)

                // Add the new memval item using the addMemvalItem function with completion callback
                addMemvalItem(
                    memvalContainer as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
                    item.value,
                    containerSize.height / 1,
                    (memvalGroup) => {
                        if (item.value.type === 'reference') {
                            const containerTransform = memvalContainer.attr('transform')
                            let sectionX = 0
                            let sectionY = 0
                            if (containerTransform) {
                                const translateMatch = containerTransform.match(/translate\(([^,]+),([^)]+)\)/)
                                if (translateMatch) {
                                    sectionX = parseFloat(translateMatch[1])
                                    sectionY = parseFloat(translateMatch[2])
                                }
                            }

                            const itemTransform = memvalGroup.attr('transform')
                            const [localX, localY] = itemTransform.replace(/translate\(|\)/g, "").split(',').map(Number)

                            const sourcePos = {
                                x: sectionX + localX + MEMVAL_ITEM_WIDTH - 5,
                                y: sectionY + localY + MEMVAL_ITEM_HEIGHT / 2
                            }

                            const targetId = `obj-${item.value.ref}-left`
                            const targetPos = nodePositionsRef.current.get(targetId)

                            if (targetPos) {
                                const memvalIndex = memvalGroup.attr('data-memval-index')
                                const connectionId = `connection-memval-${memvalIndex}`
                                drawConnection(sourcePos, targetPos, 'memval-ref', connectionId)
                            }
                        }
                        console.log("Fade-in animation completed for:", item.value)
                        processMemvalChangesSequentially(changes, index + 1)
                    },
                    direction === 'backward' ? 'fade-in' : 'slide-in'
                )

                console.log("Successfully added new memval item with fade-in animation:", item.value)

            } else if (item.type === 'pop') {
                console.log("Removing item from current chart:", item.value)

                // Get current memval items to find the index to remove
                const memvalItems = getMemvalItemsFromD3()
                const itemIndex = memvalItems.length - 1

                if (item.value.type === 'reference') {
                    const connectionId = `connection-memval-${itemIndex}`
                    rootContainerRef.current?.select(`#${connectionId}`).remove()
                }

                // Remove the memval item using the removeMemvalItem function with completion callback
                removeMemvalItem(
                    memvalContainer as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
                    itemIndex,
                    containerSize.height / 1,
                    () => {
                        console.log("Fade-out animation completed for:", item.value)
                        // Process next change after animation completes
                        processMemvalChangesSequentially(changes, index + 1)
                    }
                )

                console.log("Successfully removed memval item with fade-out animation:", item.value)

            } else {
                // For other types, process immediately without animation delay
                processMemvalChangesSequentially(changes, index + 1)
            }
        }

        // Start processing changes sequentially
        processMemvalChangesSequentially(changesToProcess)
    }, [currentStep, getMemvalItemsFromD3, containerSize.height, steps, drawConnection])

    // Transform snapshot data into visualization format
    const transformData = useCallback(() => {
        const scopesData: ScopeData[] = []
        const heapData: HeapObjectData[] = []

        // Categorize scopes with depth-based colors (reverse order - global at bottom)
        const reversedScopes = [...(currentStep?.memorySnapshot.scopes || [])].reverse()
        reversedScopes.forEach((scope, reversedIndex) => {
            // Calculate original index for color and current scope detection
            const originalIndex = (currentStep?.memorySnapshot.scopes.length || 0) - 1 - reversedIndex
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
            const effectiveScopeIndex = currentStep?.type === EXEC_STEP_TYPE.POP_SCOPE && currentStep.index < steps.length - 1
                ? steps[currentStep.index + 1].scopeIndex
                : currentStep?.scopeIndex
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
                name: `Scope ${originalIndex}`,
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
        Object.entries(currentStep?.memorySnapshot.heap ?? {}).forEach(([ref, obj]) => {
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
        Object.entries(currentStep?.memorySnapshot.heap ?? {}).forEach(([ref, obj]) => {
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
    }, [currentStep, getMaxDepth, steps])

    // D3 rendering function
    const renderD3Visualization = useCallback((memvalOverride?: Memval[]) => {
        if (!currentStep) return
        if (!svgRef.current) return
        if (!containerSize.width || !containerSize.height) return

        // Clear any existing SVG content
        d3.select(svgRef.current).selectAll("*").remove()

        // Transform the data into visualization format
        const memoryModelData = transformData()

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
                rootContainerRef.current?.attr("transform", transform)
            })

        // Apply zoom behavior to SVG
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        svg.call(zoom as any)

        // Create a container for the graph within the root container
        const rootContainer = svg.append("g")
        rootContainerRef.current = rootContainer

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
            scopeSection.layoutOptions = { 'elk.algorithm': 'layered', 'elk.direction': 'UP' }

            // Create a section for heap with content-based sizing
            const heapSection = createHeapSection()

            // Add memval nodes with layered algorithm (bottom to top)
            const memvalItems = memvalOverride ?? (currentStep?.memorySnapshot.memval || [])

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

        // Function to update connections
        const updateConnections = () => {
            // Define the calculatePath function for exactly straight lines
            // This function is now defined globally or passed as a prop

            rootContainerRef.current?.selectAll(".connection").remove()

            console.log(`Drawing ${edgeData.length} connections:`, edgeData)
            console.log('Node positions:', Array.from(nodePositions.entries()))
            console.log('Property positions:', Array.from(propertyPositions.entries()))

            edgeData.forEach((edge) => {
                const sourcePos = edge.type === "prop-ref" ? propertyPositions.get(edge.source) : nodePositions.get(edge.source)
                const targetPos = nodePositions.get(edge.target)

                if (!sourcePos || !targetPos) {
                    console.warn(`Missing position for edge: ${edge.source} -> ${edge.target}`, {
                        sourcePos: sourcePos ? 'found' : 'missing',
                        targetPos: targetPos ? 'found' : 'missing',
                        sourceInNodePositions: nodePositions.has(edge.source),
                        sourceInPropertyPositions: propertyPositions.has(edge.source),
                        targetInNodePositions: nodePositions.has(edge.target)
                    })
                    return
                }

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

                rootContainerRef.current
                    ?.append("path")
                    .attr("class", "connection")
                    .attr("d", calculatePath(sourcePos, targetPos))
                    .attr("stroke", strokeColor)
                    .attr("stroke-width", 1.5)
                    .attr("fill", "none")
                    .attr("marker-end", `url(#${arrowType})`)
                    .attr("data-source", edge.source)
                    .attr("data-target", edge.target)
                    .on("mouseover", function () {
                        d3.select(this).attr("stroke", "#e53e3e").attr("marker-end", "url(#arrow-highlight)")
                    })
                    .on("mouseout", function () {
                        d3.select(this)
                            .attr("stroke", strokeColor)
                            .attr("marker-end", `url(#${arrowType})`)
                    })
            })
        }

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

                // Highlight arrow (red)
                defs
                    .append("marker")
                    .attr("id", "arrow-highlight")
                    .attr("viewBox", "0 -5 10 10")
                    .attr("refX", 8)
                    .attr("refY", 0)
                    .attr("markerWidth", 6)
                    .attr("markerHeight", 6)
                    .attr("orient", "auto")
                    .append("path")
                    .attr("d", "M0,-4L8,0L0,4")
                    .attr("fill", "#e53e3e")


                // Draw memval items using the module - always show memval section
                const memvalItems = memvalOverride ?? (currentStep?.memorySnapshot.memval || [])

                // Render sections sequentially to ensure edgeData is populated
                renderMemvalSection({
                    memvalSection,
                    memvalItems,
                    rootContainer,
                    viewportHeight: containerSize.height
                })

                // Draw scope items using the module
                renderScopeSection({
                    scopeSection,
                    scopeItems: memoryModelData.scopes,
                    nodePositions,
                    edgeData,
                    scale: sectionsScale,
                    rootContainer,
                    viewportHeight: containerSize.height
                })

                // Draw heap items using the module (async)
                renderHeapSection({
                    heapSection,
                    heapData: memoryModelData.heap,
                    rootContainer,
                    nodePositions,
                    propertyPositions,
                    edgeData,
                    scale: 1,
                    viewportHeight: containerSize.height,
                    objectWidth,
                    objectHeight
                }).then(() => {
                    // Update connections after all sections are rendered
                    nodePositionsRef.current = nodePositions
                    propertyPositionsRef.current = propertyPositions
                    updateConnections()
                })
            })
            .catch((error) => {
                console.error("ELK layout error:", error)
            })
    }, [currentStep, transformData, containerSize, calculatePath])

    const rerenderScopesAndHeap = useCallback((memvalForLayout: Memval[]) => {
        if (!currentStep || !rootContainerRef.current) return

        rootContainerRef.current.selectAll(".scope-section, .heap-section, .connection").remove()

        const memoryModelData = transformData()
        const objectWidth = 150
        const objectHeight = 90
        const nodePositions = new Map()
        const propertyPositions = new Map()
        const edgeData: Array<{ source: string; target: string; type: string; label?: string; propIndex?: number }> = []

        const createElkGraph = (): ElkGraph => {
            const graph: ElkGraph = {
                id: "root",
                children: [],
                edges: [],
            }

            const memvalSection = createMemvalSection()
            const scopeSection = createScopeSection()
            scopeSection.layoutOptions = { 'elk.algorithm': 'layered', 'elk.direction': 'UP' }
            const heapSection = createHeapSection()

            const memvalItems = memvalForLayout ?? []
            const memvalNodes = createMemvalNodes(memvalItems)
            memvalSection.children?.push(...memvalNodes)

            if (memvalItems.length > 0) {
                const memvalEdges = createMemvalEdges(memvalItems)
                graph.edges.push(...memvalEdges)
            }

            const scopeItems = memoryModelData.scopes
            const scopeNodes = createScopeNodes(scopeItems)
            scopeSection.children?.push(...scopeNodes)

            const scopeEdges = createScopeEdges(scopeItems)
            graph.edges.push(...scopeEdges)

            const heapNodes = createHeapNodes(memoryModelData.heap, objectWidth, objectHeight)
            heapSection.children?.push(...heapNodes)

            graph.children?.push(memvalSection)
            graph.children?.push(scopeSection)
            graph.children?.push(heapSection)

            return graph
        }

        const elkGraph = createElkGraph()
        const elk = new ELK()

        const updateConnections = () => {
            rootContainerRef.current?.selectAll(".connection").remove()

            edgeData.forEach((edge) => {
                const sourcePos = edge.type === "prop-ref" ? propertyPositions.get(edge.source) : nodePositions.get(edge.source)
                const targetPos = nodePositions.get(edge.target)

                if (!sourcePos || !targetPos) {
                    return
                }

                let arrowType, strokeColor
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

                rootContainerRef.current
                    ?.append("path")
                    .attr("class", "connection")
                    .attr("d", calculatePath(sourcePos, targetPos))
                    .attr("stroke", strokeColor)
                    .attr("stroke-width", 1.5)
                    .attr("fill", "none")
                    .attr("marker-end", `url(#${arrowType})`)
                    .attr("data-source", edge.source)
                    .attr("data-target", edge.target)
                    .on("mouseover", function () {
                        d3.select(this).attr("stroke", "#e53e3e").attr("marker-end", "url(#arrow-highlight)")
                    })
                    .on("mouseout", function () {
                        d3.select(this)
                            .attr("stroke", strokeColor)
                            .attr("marker-end", `url(#${arrowType})`)
                    })
            })
        }

        elk.layout(elkGraph).then((layoutedGraph) => {
            const memvalSection = layoutedGraph.children?.find(section => section.id === "memvalSection")
            const scopeSection = layoutedGraph.children?.find(section => section.id === "scopeSection")
            const heapSection = layoutedGraph.children?.find(section => section.id === "heapSection")

            if (!memvalSection || !scopeSection || !heapSection) return

            const calculateSectionWidth = (section: ElkNode): number => {
                if (section.id === "memvalSection") return MEMVAL_SECTION_WIDTH
                if (section.id === "scopeSection") return SCOPE_SECTION_WIDTH
                const children = section.children ?? []
                if (children.length === 0) return 0
                const rightmostEdge = Math.max(...children.map(child => (child.x || 0) + (child.width || 200)))
                return rightmostEdge + 160
            }

            const actualMemvalSectionWidth = calculateSectionWidth(memvalSection)
            const actualScopeSectionWidth = calculateSectionWidth(scopeSection)
            let actualHeapSectionWidth = containerSize.width - actualMemvalSectionWidth - actualScopeSectionWidth - SECTION_HORIZONTAL_GAP * 2
            const heapContentHeight = containerSize.height

            const minHeapWidthNeeded = objectWidth + 40
            const fixedSectionsWidth = actualMemvalSectionWidth + actualScopeSectionWidth
            let sectionsScale = 1
            if (actualHeapSectionWidth < minHeapWidthNeeded && fixedSectionsWidth > 0) {
                const availableForFixed = Math.max(60, containerSize.width - minHeapWidthNeeded - SECTION_HORIZONTAL_GAP * 2)
                sectionsScale = Math.max(0.6, Math.min(1, availableForFixed / fixedSectionsWidth))
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

            if (!memvalSection.height || memvalSection.height < containerSize.height) {
                memvalSection.height = containerSize.height
            }
            if (!scopeSection.height || scopeSection.height < containerSize.height) {
                scopeSection.height = containerSize.height
            }
            heapSection.height = heapContentHeight

            memvalSection.x = 0
            heapSection.x = (memvalSection.width || 0) + SECTION_HORIZONTAL_GAP
            scopeSection.x = (memvalSection.width || 0) + SECTION_HORIZONTAL_GAP + (heapSection.width || 0) + SECTION_HORIZONTAL_GAP
            memvalSection.y = 0
            scopeSection.y = 0
            heapSection.y = 0

            if (rootContainerRef.current) {
                renderScopeSection({
                    scopeSection,
                    scopeItems: memoryModelData.scopes,
                    nodePositions,
                    edgeData,
                    scale: sectionsScale,
                    rootContainer: rootContainerRef.current,
                    viewportHeight: containerSize.height
                })

                renderHeapSection({
                    heapSection,
                    heapData: memoryModelData.heap,
                    rootContainer: rootContainerRef.current,
                    nodePositions,
                    propertyPositions,
                    edgeData,
                    scale: 1,
                    viewportHeight: containerSize.height,
                    objectWidth,
                    objectHeight
                }).then(() => {
                    nodePositionsRef.current = nodePositions
                    propertyPositionsRef.current = propertyPositions
                    updateConnections()
                })
            }
        })
    }, [currentStep, transformData, containerSize, calculatePath])

    // Handle step changes
    useEffect(() => {
        if (currentStep && previousStepRef.current !== null) {
            const stepChange = currentStep.index - previousStepRef.current

            if (Math.abs(stepChange) === 1) {
                const previousStep = steps.find(s => s.index === previousStepRef.current)
                const prevMemval = previousStep?.memorySnapshot.memval || []
                rerenderScopesAndHeap(prevMemval)
                handleMemvalChanges(stepChange > 0 ? 'forward' : 'backward')
            } else {
                renderD3Visualization()
            }
        } else if (currentStep) {
            renderD3Visualization()
        }

        if (currentStep) {
            previousStepRef.current = currentStep.index
        }
    }, [currentStep, handleMemvalChanges, renderD3Visualization, rerenderScopesAndHeap, steps])

    return (
        <div ref={containerRef} className="relative w-full h-full">
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div className="w-full h-full">
                        <svg
                            ref={svgRef}
                            className="w-full h-full"
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
