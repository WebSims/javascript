import { useCallback, useEffect, useMemo, useRef } from "react"
import * as d3 from "d3"
import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkNode as ElkLayoutNode, ElkEdge as ElkLayoutEdge } from "elkjs/lib/elk-api"
import { JSValue, HEAP_OBJECT_TYPE, EXEC_STEP_TYPE } from "@/types/simulator"
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
} from "./memval"
import {
    createScopeSection,
    createScopeNodes,
    createScopeEdges,
    renderScopeSection,
    SCOPE_SECTION_WIDTH,
} from "./scope"

type HeapObjectData = {
    id: string
    type: string
    color: string
    borderColor: string
    properties: { name: string; value: string; target?: string }[]
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

const MemoryModelVisualizer = () => {
    const { currentStep, steps, settings, toggleAutoZoom } = useSimulatorStore()
    const svgRef = useRef<SVGSVGElement>(null)
    const [containerRef, containerSize] = useElementSize<HTMLDivElement>()

    const getMaxDepth = useMemo(() => {
        return Math.max(...steps.map(step => step.scopeIndex))
    }, [steps])

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
                        displayValue = "TDZ"
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
        Object.entries(currentStep?.memorySnapshot.heap ?? {}).forEach(([ref, obj]) => {
            const objId = `obj-${ref}`
            let objType = "OBJECT"
            let objColor = "#fefcbf"
            let objBorderColor = "#ecc94b"

            if (obj.type === HEAP_OBJECT_TYPE.ARRAY) {
                objType = "ARRAY"
                objColor = "#c6f6d5"
                objBorderColor = "#68d391"
            } else if (obj.type === HEAP_OBJECT_TYPE.FUNCTION) {
                objType = "FUNCTION"
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
                    const property = formatPropertyValue(propName, propValue, heapData)
                    properties.push(property)
                })
            } else if (obj.type === HEAP_OBJECT_TYPE.ARRAY) {
                // Process array elements
                obj.elements.forEach((element, index) => {
                    if (element !== undefined) {
                        const property = formatPropertyValue(String(index), element, heapData)
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

        // Enhance scope variable references with object type information
        scopesData.forEach(scope => {
            scope.variables.forEach(variable => {
                if (variable.type === "reference" && variable.target) {
                    const referencedObject = heapData.find(obj => obj.id === variable.target)
                    if (referencedObject) {
                        variable.value = referencedObject.type
                    }
                }
            })
        })

        return {
            scopes: scopesData,
            heap: heapData
        }
    }, [currentStep, getMaxDepth, steps])

    // Helper function to format property values
    const formatPropertyValue = (propName: string, propValue: JSValue, heapData?: HeapObjectData[]): { name: string; value: string; target?: string } => {
        if (propValue.type === "primitive") {
            if (propValue.value === undefined) {
                return { name: propName, value: "undefined" }
            } else if (propValue.value === null) {
                return { name: propName, value: "null" }
            } else if (propValue.value === "not_initialized") {
                return { name: propName, value: "<TDZ>" }
            } else {
                return { name: propName, value: String(propValue.value) }
            }
        } else {
            // It's a reference
            let refDisplay = 'N/A'

            // If heap data is available, show the object type
            if (heapData) {
                const referencedObject = heapData.find(obj => obj.id === `obj-${propValue.ref}`)
                if (referencedObject) {
                    refDisplay = referencedObject.type
                }
            }

            return {
                name: propName,
                value: refDisplay,
                target: `obj-${propValue.ref}`
            }
        }
    }

    useEffect(() => {
        if (!currentStep) return
        if (!svgRef.current) return
        if (!containerSize.width || !containerSize.height) return
        console.log("containerSize", containerSize)

        // Clear any existing SVG content
        d3.select(svgRef.current).selectAll("*").remove()

        // Transform the data into visualization format
        const memoryModelData = transformData()

        // Define common dimensions
        const objectWidth = 180
        const objectHeight = 120

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
            const heapSection: ElkNode = {
                id: "heapSection",
                layoutOptions: {
                    // Use ELK Force-directed algorithm for heap
                    "elk.algorithm": "force",
                    // Increase spacing to reduce overlap chances
                    "elk.spacing.nodeNode": "80",
                    // Keep edges simple within heap if any are later added
                    "elk.edgeRouting": "POLYLINE",
                    // Provide padding so force layout has room around borders
                    "elk.padding": "[top=20, left=20, bottom=20, right=20]",
                },
                children: [],
            }

            // Add memval nodes with layered algorithm (bottom to top)
            const memvalItems = currentStep?.memorySnapshot.memval || []

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
            memoryModelData.heap.forEach((object) => {
                const propCount = object.properties ? object.properties.length : 0
                const objHeight = Math.max(objectHeight, 40 + propCount * 20)

                const objNode: ElkNode = {
                    id: object.id,
                    width: objectWidth,
                    height: objHeight,
                    labels: [{ text: object.type, width: 100, height: 25 }],
                }

                heapSection.children?.push(objNode)
            })

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

            rootContainer.selectAll(".connection").remove()

            edgeData.forEach((edge) => {
                const sourcePos = edge.type === "prop-ref" ? propertyPositions.get(edge.source) : nodePositions.get(edge.source)
                const targetPos = nodePositions.get(edge.target)

                if (!sourcePos || !targetPos) return

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

                rootContainer
                    .append("path")
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

                // Calculate heap section width as remaining width: containerSize.width - memvalSection.width - scopeSection.width
                let actualHeapSectionWidth = containerSize.width - actualMemvalSectionWidth - actualScopeSectionWidth

                // Calculate heap section height based on viewport; will grow after layout if needed
                const heapContentHeight = containerSize.height

                // Determine if we need to proportionally scale memval and scope sections
                const minHeapWidthNeeded = objectWidth + 40
                const fixedSectionsWidth = actualMemvalSectionWidth + actualScopeSectionWidth
                let sectionsScale = 1
                if (actualHeapSectionWidth < minHeapWidthNeeded && fixedSectionsWidth > 0) {
                    const availableForFixed = Math.max(60, containerSize.width - minHeapWidthNeeded)
                    sectionsScale = Math.max(0.4, Math.min(1, availableForFixed / fixedSectionsWidth))
                    // Recompute widths with scale
                    const scaledMemvalWidth = Math.round(actualMemvalSectionWidth * sectionsScale)
                    const scaledScopeWidth = Math.round(actualScopeSectionWidth * sectionsScale)
                    actualHeapSectionWidth = containerSize.width - scaledMemvalWidth - scaledScopeWidth
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

                // Position sections: memval -> heap -> scope
                memvalSection.x = 0
                heapSection.x = memvalSection.width
                scopeSection.x = (memvalSection.width || 0) + (heapSection.width || 0)

                memvalSection.y = 0
                scopeSection.y = 0
                heapSection.y = 0

                // Calculate total content dimensions
                const totalContentWidth = (memvalSection.width || 0) + (heapSection.width || 0) + (scopeSection.width || 0)
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
                const memvalItems = currentStep?.memorySnapshot.memval || []

                // Prepare heap container with uniform scaling like other sections
                let heapContainer: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
                let baseHeapWidth = 0
                let baseHeapHeight = 0
                if (memoryModelData.heap.length > 0) {
                    baseHeapWidth = (heapSection.width || actualHeapSectionWidth) / sectionsScale
                    baseHeapHeight = (heapSection.height || heapContentHeight) / sectionsScale

                    heapContainer = rootContainer
                        .append("g")
                        .attr("class", "heap-section")
                        .attr("transform", `translate(${heapSection.x || 0}, ${heapSection.y || 0}) scale(${sectionsScale})`)

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
                }

                renderMemvalSection({
                    memvalSection,
                    memvalItems,
                    rootContainer,
                    memoryModelData,
                    nodePositions,
                    edgeData,
                    scale: sectionsScale,
                })

                // Draw scopes using the module (always render section, even when empty)
                renderScopeSection({
                    scopeSection,
                    scopeItems: memoryModelData.scopes,
                    rootContainer,
                    nodePositions,
                    edgeData,
                    scale: sectionsScale,
                })

                // Draw heap objects using ELK Force layout with center-x and bottom-y bias
                if (memoryModelData.heap.length > 0 && heapContainer) {
                    // Build a heap-only graph using the same children prepared earlier
                    const heapOnlyGraph: ElkGraph = {
                        id: "heapRoot",
                        width: baseHeapWidth,
                        height: baseHeapHeight,
                        layoutOptions: {
                            "elk.algorithm": "force",
                            "elk.spacing.nodeNode": "80",
                            "elk.padding": "[top=20, left=20, bottom=20, right=20]",
                            "elk.edgeRouting": "POLYLINE",
                        },
                        children: heapSection.children || [],
                        edges: [],
                    }

                    // Run ELK on the heap-only graph to get force-directed positions
                    elk.layout(heapOnlyGraph).then((heapLayouted) => {
                        const children = heapLayouted.children || []
                        if (children.length === 0) return

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
                            heapSection.height = baseHeapHeight * sectionsScale
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
                        const bottomAnchorOffset = Math.max(0, (containerSize.height / sectionsScale) - baseHeapHeight)
                        heapContainer.attr(
                            "transform",
                            `translate(${heapSection.x || 0}, ${(heapSection.y || 0) + bottomAnchorOffset}) scale(${sectionsScale})`
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
                            const newOffset = Math.max(0, (containerSize.height / sectionsScale) - baseHeapHeight)
                            heapContainer.attr(
                                "transform",
                                `translate(${heapSection.x || 0}, ${(heapSection.y || 0) + newOffset}) scale(${sectionsScale})`
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
                            heapSection.height = baseHeapHeight * sectionsScale
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
                            const objData = memoryModelData.heap.find(h => h.id === c.id)
                            if (!objData) return

                            const propCount = objData.properties ? objData.properties.length : 0
                            const objHeight = Math.max(objectHeight, 40 + propCount * 20)
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
                                x: (heapSection.x || 0) + sectionsScale * (localX + objWidth),
                                y: (heapSection.y || 0) + sectionsScale * (yOffset + localY + objHeight / 2),
                            })
                            // Store left edge position for memval connections
                            nodePositions.set(`${c.id}-left`, {
                                x: (heapSection.x || 0) + sectionsScale * (localX),
                                y: (heapSection.y || 0) + sectionsScale * (yOffset + localY + objHeight / 2),
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
                                .append("rect")
                                .attr("width", objWidth)
                                .attr("height", 25)
                                .attr("rx", 6)
                                .attr("ry", 6)
                                .attr("fill", objData.borderColor)

                            objectGroup
                                .append("text")
                                .attr("x", 10)
                                .attr("y", 17)
                                .attr("fill", "white")
                                .attr("font-weight", "bold")
                                .text(objData.type)

                            // Add object properties
                            if (objData.properties) {
                                objData.properties.forEach((prop, i) => {
                                    const propertyGroup = objectGroup
                                        .append("g")
                                        .attr("class", "property")
                                        .attr("transform", `translate(10, ${35 + i * 20})`)
                                        .attr("data-property-id", `${c.id}_${prop.name}`)

                                    if (prop.target) {
                                        propertyGroup
                                            .append("rect")
                                            .attr("width", 12)
                                            .attr("height", 15)
                                            .attr("fill", "white")
                                            .attr("stroke", "black")
                                            .attr("stroke-width", 0.5)

                                        propertyGroup
                                            .append("path")
                                            .attr("d", "M11, 0 L11, 5 L16, 5 L16, 0 Z")
                                            .attr("fill", "white")
                                            .attr("stroke", "black")
                                            .attr("stroke-width", 0.5)

                                        // Store property position for connections
                                        const propXAbs = (heapSection.x || 0) + sectionsScale * (localX + 5)
                                        const propYAbs = (heapSection.y || 0) + sectionsScale * (yOffset + localY + 45 + i * 20)
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
                                            .attr("cy", 45 + i * 20)
                                            .attr("r", 3)
                                            .attr("fill", "#ed8936")
                                            .attr("stroke", "none")
                                    }

                                    propertyGroup
                                        .append("text")
                                        .attr("x", prop.target ? 20 : 0)
                                        .attr("y", 10)
                                        .attr("font-size", "12px")
                                        .text(`${prop.name}: ${prop.value}`)
                                })
                            }
                        })

                        // After rendering heap and collecting edges, update connections
                        updateConnections()
                    })
                }

                // Initial draw of connections
                updateConnections()


            })
            .catch((error) => {
                console.error("ELK layout error:", error)
            })
    }, [currentStep, transformData, containerSize])

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
