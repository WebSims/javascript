import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
} from "./memval"
import {
    createScopeSection,
    createScopeNodes,
    createScopeEdges,
    renderScopeSection,
    calculateScopeHeight,
    SCOPE_SECTION_SPACING,
    SCOPE_BADGE_HEIGHT,
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
    const [isDragging, setIsDragging] = useState(false)
    // Track dragged item for state management (value used in drag handlers)
    const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'scope' | 'heap'; x: number; y: number } | null>(null)
    // Suppress unused warning as draggedItem is used for state tracking
    void draggedItem

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
    }, [currentStep, getMaxDepth])

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

        // Set up dimensions and calculate content size
        const margin = { top: 40, right: 40, bottom: 20, left: 40 }

        // Define common dimensions
        const scopeHeight = 120
        const objectWidth = 180
        const objectHeight = 120

        // Calculate initial content dimensions (will be updated after layout)
        const memvalCount = currentStep?.memorySnapshot.memval?.length || 0
        const memvalSectionHeight = memvalCount * 50 // 50px per memval item

        // Calculate scope section dimensions
        const scopeSectionHeight = memoryModelData.scopes.reduce((total, scope) => {
            const variableSpacing = 35
            const bottomPadding = 10
            const calculatedHeight = SCOPE_BADGE_HEIGHT + scope.variables.length * variableSpacing + bottomPadding
            return total + Math.max(scopeHeight, calculatedHeight) + SCOPE_SECTION_SPACING
        }, 0)

        // Calculate heap section dimensions
        const heapSectionHeight = memoryModelData.heap.reduce((total, objData) => {
            const propCount = objData.properties ? objData.properties.length : 0
            const objHeight = Math.max(objectHeight, 40 + propCount * 20)
            return total + objHeight + 50
        }, 0)

        // Calculate initial total content dimensions (will be updated after layout)
        const sectionSpacing = 40
        const initialTotalContentWidth = 800 // Initial estimate, will be updated
        const totalContentHeight = Math.max(memvalSectionHeight, scopeSectionHeight, heapSectionHeight)

        // Calculate viewport dimensions (use container size or default)
        const viewportWidth = containerSize.width
        const viewportHeight = containerSize.height

        // Calculate centering offsets
        const centerX = (viewportWidth - initialTotalContentWidth) / 2
        const centerY = (viewportHeight - totalContentHeight) / 2



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
                contentGroup.attr("transform", transform)
            })
            .on("start", () => setIsDragging(true))
            .on("end", () => setIsDragging(false))

        // Apply zoom behavior to SVG
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        svg.call(zoom as any)

        // Create a group for content positioning
        const contentGroup = svg.append("g")
            .attr("transform", `translate(${centerX}, ${centerY})`)

        // Create a container for the graph
        const graphContainer = contentGroup.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`)

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
                layoutOptions: {
                    "elk.algorithm": "box",
                    "elk.direction": "RIGHT",
                    "elk.spacing.nodeNode": "40",
                    "elk.padding": "[top=20, left=20, bottom=20, right=20]",
                    "elk.aspectRatio": "1.6",
                    "elk.randomSeed": "1",
                },
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
                    "elk.algorithm": "layered",
                    "elk.direction": "LEFT",
                    "elk.partitioning.activate": "true",
                    "elk.padding": "[top=20, left=20, bottom=20, right=20]",
                    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
                    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
                    "elk.spacing.nodeNode": "50",
                    "elk.layered.spacing.nodeNodeBetweenLayers": "50",
                    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
                    "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
                    "elk.edgeRouting": "SPLINES",
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

            graphContainer.selectAll(".connection").remove()

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

                graphContainer
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

        // Helper type for drag data
        type DragData = {
            dragOffsetX: number
            dragOffsetY: number
            initialX: number
            initialY: number
        }

        // Helper function to create drag behavior for scope elements
        const createScopeDragBehavior = (scopeNode: ElkNode, scopeData: ScopeData, actualScopeHeight: number) => {
            return d3.drag<SVGGElement, unknown>()
                .on("start", function (event) {
                    event.sourceEvent.stopPropagation()

                    // Get current transform
                    const transform = d3.select(this).attr("transform")
                    const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/)
                    const currentX = translateMatch ? parseFloat(translateMatch[1]) : 0
                    const currentY = translateMatch ? parseFloat(translateMatch[2]) : 0

                    // Get mouse position relative to SVG
                    const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgRef.current)

                    // Store drag offset
                    d3.select(this).datum({
                        dragOffsetX: mouseX - currentX,
                        dragOffsetY: mouseY - currentY,
                        initialX: currentX,
                        initialY: currentY
                    } as DragData)

                    // Update state and cursor
                    setDraggedItem({ id: scopeNode.id, type: 'scope', x: currentX, y: currentY })
                    setIsDragging(true)
                    d3.select(this).style("cursor", "grabbing")
                })
                .on("drag", function (event) {
                    // Get stored drag data
                    const dragData = d3.select(this).datum() as DragData

                    // Get current mouse position relative to SVG
                    const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgRef.current)

                    // Calculate new position
                    const newX = mouseX - dragData.dragOffsetX
                    const newY = mouseY - dragData.dragOffsetY

                    // Update visual position
                    d3.select(this).attr("transform", `translate(${newX}, ${newY})`)

                    // Update node positions for connections
                    const scopeWidth = scopeNode.width || 200
                    nodePositions.set(scopeNode.id, {
                        x: newX + scopeWidth / 2,
                        y: newY + actualScopeHeight / 2
                    })

                    // Update variable positions
                    scopeData.variables.forEach((varData, varIndex) => {
                        const varNodeId = `var-${scopeNode.id}-${varData.name}`
                        nodePositions.set(varNodeId, {
                            x: newX + 5,
                            y: newY + 40 + varIndex * 35 + 10
                        })
                    })

                    // Update connections
                    updateConnections()
                })
                .on("end", function () {
                    // Clean up state
                    setDraggedItem(null)
                    setIsDragging(false)
                    d3.select(this).style("cursor", "grab")

                    // Clear stored drag data
                    d3.select(this).datum(null)
                })
        }

        // Helper function to create drag behavior for heap objects
        const createHeapDragBehavior = (heapNode: ElkNode, objData: HeapObjectData, objNodeId: string) => {
            return d3.drag<SVGGElement, unknown>()
                .on("start", function (event) {
                    event.sourceEvent.stopPropagation()

                    // Get current transform
                    const transform = d3.select(this).attr("transform")
                    const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/)
                    const currentX = translateMatch ? parseFloat(translateMatch[1]) : 0
                    const currentY = translateMatch ? parseFloat(translateMatch[2]) : 0

                    // Get mouse position relative to SVG
                    const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgRef.current)

                    // Store drag offset
                    d3.select(this).datum({
                        dragOffsetX: mouseX - currentX,
                        dragOffsetY: mouseY - currentY,
                        initialX: currentX,
                        initialY: currentY
                    } as DragData)

                    // Update state and cursor
                    setDraggedItem({ id: objNodeId, type: 'heap', x: currentX, y: currentY })
                    setIsDragging(true)
                    d3.select(this).style("cursor", "grabbing")
                })
                .on("drag", function (event) {
                    // Get stored drag data
                    const dragData = d3.select(this).datum() as DragData

                    // Get current mouse position relative to SVG
                    const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgRef.current)

                    // Calculate new position
                    const newX = mouseX - dragData.dragOffsetX
                    const newY = mouseY - dragData.dragOffsetY

                    // Update visual position
                    d3.select(this).attr("transform", `translate(${newX}, ${newY})`)

                    // Update node positions for connections
                    const objWidth = heapNode.width || 180
                    const objHeight = heapNode.height || 120
                    nodePositions.set(objNodeId, {
                        x: newX + objWidth,
                        y: newY + objHeight / 2
                    })

                    // Update left edge position for memval connections
                    nodePositions.set(`${objNodeId}-left`, {
                        x: newX,
                        y: newY + objHeight / 2
                    })

                    // Update property positions
                    objData.properties?.forEach((prop, propIndex) => {
                        if (prop.target) {
                            const propId = `${objNodeId}_${prop.name}`
                            propertyPositions.set(propId, {
                                x: newX + 5,
                                y: newY + 45 + propIndex * 20
                            })
                        }
                    })

                    // Update connections
                    updateConnections()
                })
                .on("end", function () {
                    // Clean up state
                    setDraggedItem(null)
                    setIsDragging(false)
                    d3.select(this).style("cursor", "grab")

                    // Clear stored drag data
                    d3.select(this).datum(null)
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
                    if (!section.children || section.children.length === 0) {
                        return (section.width || 200) // Default width if no children
                    }

                    if (section.id === "memvalSection") {
                        if (!section.children || section.children.length === 0) {
                            return 160 // Default width if no children
                        }

                        // Use ELK layout width
                        const rightmostEdge = Math.max(...section.children.map(child =>
                            (child.x || 0) + (child.width || 150)
                        ))

                        return rightmostEdge + 20 // Add some padding
                    }

                    if (section.id === "scopeSection") {
                        return 200
                    }

                    // Find the rightmost edge of all children
                    const rightmostEdge = Math.max(...section.children.map(child =>
                        (child.x || 0) + (child.width || 200)
                    ))

                    return rightmostEdge + 160
                }

                const calculateSectionHeight = (section: ElkNode): number => {
                    if (!section.children || section.children.length === 0) {
                        return 100 // Default height if no children
                    }

                    // For scope sections, calculate height based on scope content
                    if (section.id === "scopeSection") {
                        let totalHeight = 0

                        section.children?.forEach((scopeNode, index) => {
                            // Find the corresponding scope data
                            const scopeHeight = calculateScopeHeight(scopeNode.id, memoryModelData.scopes, 100)
                            const isFirst = index === 0
                            const isLast = index === (section.children?.length || 0) - 1
                            const spacing = isFirst || isLast ? 10 : 20
                            totalHeight += scopeHeight + spacing
                        })

                        return totalHeight
                    }

                    // For memval sections, calculate height based on ELK layout
                    if (section.id === "memvalSection") {
                        if (!section.children || section.children.length === 0) {
                            return 100 // Default height if no children
                        }

                        // Use ELK layout height
                        const bottommostEdge = Math.max(...section.children.map(child =>
                            (child.y || 0) + (child.height || 40)
                        ))

                        // Add padding
                        const padding = 40
                        return bottommostEdge + padding
                    }

                    // For other sections, use the original calculation
                    const bottommostEdge = Math.max(...section.children.map(child =>
                        (child.y || 0) + (child.height || 100)
                    ))

                    // Add padding
                    const padding = 40
                    return bottommostEdge + padding
                }

                // Calculate actual section dimensions
                const actualMemvalSectionWidth = calculateSectionWidth(memvalSection) // Always calculate width for memval section
                const actualScopeSectionWidth = scopeSection.children && scopeSection.children.length > 0 ? calculateSectionWidth(scopeSection) : 0

                // Calculate heap section width based on auto zoom setting
                let actualHeapSectionWidth: number
                if (settings.autoZoom) {
                    // When auto zoom is on, calculate based on content
                    actualHeapSectionWidth = heapSection.children && heapSection.children.length > 0 ? calculateSectionWidth(heapSection) : 0
                } else {
                    // When auto zoom is off, calculate as: containerSize.width - memvalSection.width - scopeSection.width
                    const availableWidth = containerSize.width - margin.left - margin.right
                    actualHeapSectionWidth = availableWidth - actualMemvalSectionWidth - actualScopeSectionWidth - (4 * sectionSpacing) // Account for spacing between sections
                }

                // Set section heights to fit container height if they are smaller
                if (memvalSection.height && memvalSection.height < containerSize.height) {
                    memvalSection.height = containerSize.height
                }
                if (scopeSection.height && scopeSection.height < containerSize.height) {
                    scopeSection.height = containerSize.height
                }
                if (heapSection.height && heapSection.height < containerSize.height) {
                    heapSection.height = containerSize.height
                }
                const actualMemvalSectionHeight = calculateSectionHeight(scopeSection)
                const actualScopeSectionHeight = scopeSection.children && scopeSection.children.length > 0 ? calculateSectionHeight(scopeSection) : 0
                const actualHeapSectionHeight = heapSection.children && heapSection.children.length > 0 ? calculateSectionHeight(heapSection) : 0
                // Log calculated section dimensions for debugging
                // console.log('Calculated Section Dimensions:', {
                //     memval: { width: actualMemvalSectionWidth, height: actualMemvalSectionHeight },
                //     scope: { width: actualScopeSectionWidth, height: actualScopeSectionHeight },
                //     heap: { width: actualHeapSectionWidth, height: actualHeapSectionHeight }
                // })

                // Position sections using calculated widths - only show sections that have content
                // New layout: memval -> heap -> scope

                // Update heap section width to match calculated width when auto zoom is off
                if (!settings.autoZoom && heapSection.children && heapSection.children.length > 0) {
                    heapSection.width = actualHeapSectionWidth
                }

                memvalSection.x = 0
                memvalSection.x = memvalSection.x + actualMemvalSectionWidth
                scopeSection.x = memvalSection.x + actualMemvalSectionWidth + actualScopeSectionWidth

                memvalSection.y = 0
                scopeSection.y = 0
                heapSection.y = 0

                // Calculate total content dimensions using actual section widths - only include sections with content
                // New layout order: memval -> heap -> scope
                const totalContentWidth = actualMemvalSectionWidth + actualHeapSectionWidth + actualScopeSectionWidth
                const totalContentHeight = Math.max(actualMemvalSectionHeight, actualScopeSectionHeight, actualHeapSectionHeight) + 2 * sectionSpacing

                const newViewportWidth = settings.autoZoom ? Math.max(totalContentWidth + margin.left + margin.right, viewportWidth) : viewportWidth
                const newViewportHeight = settings.autoZoom ? Math.max(totalContentHeight + margin.top + margin.bottom, viewportHeight) : viewportHeight

                svg.attr("viewBox", `0 0 ${newViewportWidth} ${newViewportHeight}`)
                // Update content group position with scale 1
                const scale = 1
                let centerX = 0
                let centerY = 0

                if (settings.autoZoom) {
                    centerX = (newViewportWidth - totalContentWidth * scale) / 2
                    centerY = (newViewportHeight - totalContentHeight * scale) / 2
                } else {
                    // When auto zoom is off, center Y-axis on the current scope
                    const currentScopeData = memoryModelData.scopes.find(scope => scope.isCurrentScope)
                    if (currentScopeData && scopeSection.children && scopeSection.children.length > 0) {
                        // Find the current scope node
                        const currentScopeNode = scopeSection.children.find(scopeNode => scopeNode.id === currentScopeData.id)
                        if (currentScopeNode) {
                            // Calculate the position of the current scope
                            const currentScopeIndex = scopeSection.children.findIndex(scopeNode => scopeNode.id === currentScopeData.id)
                            const currentScopeHeight = calculateScopeHeight(currentScopeNode.id, memoryModelData.scopes, 100) + 2 * sectionSpacing
                            const currentScopeY = currentScopeIndex === 0 ? 0 :
                                scopeSection.children?.slice(0, currentScopeIndex).reduce((total, prevNode) =>
                                    total + calculateScopeHeight(prevNode.id, memoryModelData.scopes, 100) + 20, 0) || 0

                            // Calculate the center position of the current scope
                            const currentScopeCenterY = (scopeSection.y || 0) + currentScopeY + currentScopeHeight / 2

                            // Center the viewport on the current scope
                            centerY = (newViewportHeight / 2) - currentScopeCenterY
                        }
                    }
                }

                contentGroup.attr("transform", `translate(${centerX}, ${centerY}) scale(1)`)

                const centerTransform = d3.zoomIdentity
                    // .translate(centerX, centerY)
                    .scale(scale)

                svg.transition()
                    .duration(750)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .call(zoom.transform as any, centerTransform)

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

                renderMemvalSection({
                    memvalSection,
                    memvalItems,
                    graphContainer,
                    memoryModelData,
                    nodePositions,
                    edgeData,
                })

                // Draw scopes using the module
                if (scopeSection.children && scopeSection.children.length > 0) {
                    renderScopeSection({
                        scopeSection,
                        scopeItems: memoryModelData.scopes,
                        graphContainer,
                        nodePositions,
                        edgeData,
                        createScopeDragBehavior,
                    })
                }

                // Draw heap objects with D3 force simulation for optimal positioning
                if (memoryModelData.heap.length > 0) {
                    // Define type for heap nodes with simulation properties
                    type HeapNodeDatum = d3.SimulationNodeDatum & {
                        id: string
                        width: number
                        height: number
                        data: HeapObjectData
                    }

                    // Create force simulation for heap objects
                    const heapNodes: HeapNodeDatum[] = memoryModelData.heap.map((objData, objIndex) => {
                        const objNode = heapSection.children?.find(child => child.id === objData.id)
                        return {
                            id: objData.id,
                            x: (heapSection.x || 0) + (objNode?.x || objIndex * (objectWidth + 50)),
                            y: (heapSection.y || 0) + (objNode?.y || 0),
                            width: objNode?.width || objectWidth,
                            height: objNode?.height || objectHeight,
                            data: objData
                        }
                    })

                    // Create connections data for force simulation
                    const connections: Array<{ source: string; target: string; type: string }> = []

                    // Add variable to heap connections
                    memoryModelData.scopes.forEach((scope) => {
                        scope.variables.forEach((variable) => {
                            if (variable.type === "reference" && variable.target) {
                                connections.push({
                                    source: variable.id,
                                    target: variable.target,
                                    type: "var-ref"
                                })
                            }
                        })
                    })

                    // Add heap object property connections
                    memoryModelData.heap.forEach((object) => {
                        if (object.properties) {
                            object.properties.forEach((prop) => {
                                if (prop.target) {
                                    connections.push({
                                        source: object.id,
                                        target: prop.target,
                                        type: "prop-ref"
                                    })
                                }
                            })
                        }
                    })

                    // Custom force to minimize line crossings
                    const avoidCrossingsForce = () => {
                        const strength = 0.2 // Increased from 0.05 for stronger repulsion
                        return (alpha: number) => {
                            heapNodes.forEach((node1, i) => {
                                heapNodes.forEach((node2, j) => {
                                    if (i >= j) return

                                    // Check if there are connections that would cross
                                    const connections1 = connections.filter(c => c.target === node1.id || c.source === node1.id)
                                    const connections2 = connections.filter(c => c.target === node2.id || c.source === node2.id)

                                    if (connections1.length > 0 && connections2.length > 0) {
                                        // Calculate repulsion based on potential crossings
                                        const dx = (node2.x || 0) - (node1.x || 0)
                                        const dy = (node2.y || 0) - (node1.y || 0)
                                        const distance = Math.sqrt(dx * dx + dy * dy) || 1

                                        // Apply stronger repulsion when nodes are closer
                                        const distanceFactor = Math.max(1, distance / 100) // Normalize distance
                                        const connectionWeight = (connections1.length + connections2.length) * 2 // Increase connection importance
                                        const force = strength * alpha * connectionWeight / (distanceFactor * distanceFactor)
                                        const fx = (dx / distance) * force
                                        const fy = (dy / distance) * force

                                        if (node1.vx !== undefined && node1.vy !== undefined) {
                                            node1.vx = (node1.vx || 0) - fx
                                            node1.vy = (node1.vy || 0) - fy
                                        }
                                        if (node2.vx !== undefined && node2.vy !== undefined) {
                                            node2.vx = (node2.vx || 0) + fx
                                            node2.vy = (node2.vy || 0) + fy
                                        }
                                    }
                                })
                            })
                        }
                    }

                    // Custom force to constrain objects within heap section bounds when auto zoom is off
                    const constrainToHeapBoundsForce = () => {
                        const strength = 0.3
                        return (alpha: number) => {
                            if (!settings.autoZoom) {
                                heapNodes.forEach((node) => {
                                    const nodeRadius = Math.max(node.width, node.height) / 2
                                    const leftBound = (heapSection.x || 0) + nodeRadius
                                    const rightBound = (heapSection.x || 0) + actualHeapSectionWidth - nodeRadius

                                    // Constrain X position within bounds
                                    if ((node.x || 0) < leftBound) {
                                        if (node.vx !== undefined) {
                                            node.vx = (node.vx || 0) + strength * alpha * (leftBound - (node.x || 0))
                                        }
                                    } else if ((node.x || 0) > rightBound) {
                                        if (node.vx !== undefined) {
                                            node.vx = (node.vx || 0) + strength * alpha * (rightBound - (node.x || 0))
                                        }
                                    }
                                })
                            }
                        }
                    }

                    // Set up D3 force simulation for heap objects with crossing avoidance
                    const simulation = d3.forceSimulation(heapNodes)
                        .force("collision", d3.forceCollide().radius((d: d3.SimulationNodeDatum) => {
                            const node = d as HeapNodeDatum
                            return Math.max(node.width, node.height) / 2 + 80 // Increased from 40 to 80 for more spacing
                        }).strength(0.8)) // Add strength parameter for stronger collision avoidance
                        .force("center", d3.forceCenter((heapSection.x || 0) + actualHeapSectionWidth / 2, (heapSection.y || 0) + (heapSection.height || 300) / 2))
                        .force("x", d3.forceX((heapSection.x || 0) + actualHeapSectionWidth / 2).strength(0.1)) // Center objects in the calculated width
                        .force("y", d3.forceY((heapSection.y || 0) + 100).strength(0.1)) // Reduced from 0.15 to allow more spread
                        .force("avoidCrossings", avoidCrossingsForce())
                        .force("constrainBounds", constrainToHeapBoundsForce()) // Constrain objects within heap bounds when auto zoom is off
                        .force("repel", d3.forceManyBody().strength(-500)) // Add general repulsion force
                        .alphaDecay(0.01) // Reduced from 0.02 for longer simulation
                        .velocityDecay(0.3) // Reduced from 0.4 for more dynamic movement

                    // Run simulation to completion with more iterations for better results
                    simulation.stop()
                    for (let i = 0; i < 400; ++i) simulation.tick() // Increased from 200 to 400 for better convergence

                    // Recalculate heap section bounds after force simulation


                    // Now render heap objects with optimized positions
                    heapNodes.forEach((heapNode) => {
                        const objData = heapNode.data
                        const objNodeId = objData.id

                        const objectGroup = graphContainer
                            .append("g")
                            .attr("class", "heap-object")
                            .attr("data-id", objNodeId)
                            .attr("transform", `translate(${heapNode.x || 0}, ${heapNode.y || 0})`)
                            .style("cursor", "grab")
                            .call(createHeapDragBehavior(heapNode, objData, objNodeId))




                        // Store object position for connections - use right edge for incoming connections
                        nodePositions.set(objNodeId, { x: (heapNode.x || 0) + heapNode.width, y: (heapNode.y || 0) + heapNode.height / 2 })

                        // Store left edge position for memval connections
                        nodePositions.set(`${objNodeId}-left`, { x: (heapNode.x || 0), y: (heapNode.y || 0) + heapNode.height / 2 })

                        // Draw object rectangle
                        objectGroup
                            .append("rect")
                            .attr("width", heapNode.width)
                            .attr("height", heapNode.height)
                            .attr("rx", 6)
                            .attr("ry", 6)
                            .attr("fill", objData.color)
                            .attr("stroke", objData.borderColor)
                            .attr("stroke-width", 2)
                            .style("cursor", "grab")
                            .on("mouseover", function () {
                                d3.select(this).style("cursor", "grab").attr("stroke-width", 3)
                            })
                            .on("mouseout", function () {
                                d3.select(this).style("cursor", "grab").attr("stroke-width", 2)
                            })

                        // Add object type header
                        objectGroup
                            .append("rect")
                            .attr("width", heapNode.width)
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
                                    .attr("data-property-id", `${objNodeId}_${prop.name}`)

                                // Property icon (document icon for references)
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
                                        .attr("d", `M11,0 L11,5 L16,5 L16,0 Z`)
                                        .attr("fill", "white")
                                        .attr("stroke", "black")
                                        .attr("stroke-width", 0.5)

                                    // Store property position for connections
                                    const propX = (heapNode.x || 0) + 5
                                    const propY = (heapNode.y || 0) + 45 + i * 20
                                    const propId = `${objNodeId}_${prop.name}`
                                    propertyPositions.set(propId, { x: propX, y: propY })

                                    // Add edge data for property references
                                    edgeData.push({
                                        source: propId,
                                        target: prop.target,
                                        type: "prop-ref",
                                        label: prop.name,
                                        propIndex: i,
                                    })

                                    // Add a small circle at the connection point
                                    objectGroup
                                        .append("circle")
                                        .attr("cx", 5)
                                        .attr("cy", 45 + i * 20)
                                        .attr("r", 3)
                                        .attr("fill", "#ed8936")
                                        .attr("stroke", "none")
                                }

                                // Property name and value
                                propertyGroup
                                    .append("text")
                                    .attr("x", prop.target ? 20 : 0)
                                    .attr("y", 10)
                                    .attr("font-size", "12px")
                                    .text(`${prop.name}: ${prop.value}`)
                            })
                        }
                    })
                }

                // Initial draw of connections
                updateConnections()


            })
            .catch((error) => {
                console.error("ELK layout error:", error)
            })
    }, [currentStep, transformData, containerSize])

    // Navigation control functions (commented out - not currently used)
    /*
    const handleZoomIn = () => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        svg.transition()
            .duration(300)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .call(d3.zoom().scaleBy as any, 1.5)
    }
     
    const handleZoomOut = () => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        svg.transition()
            .duration(300)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .call(d3.zoom().scaleBy as any, 1 / 1.5)
    }
     
    const handleResetZoom = () => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        svg.transition()
            .duration(750)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .call(d3.zoom().transform as any, d3.zoomIdentity)
    }
     
    const handleFitToView = () => {
        if (!svgRef.current || !currentStep) return
        const svg = d3.select(svgRef.current)
        const svgElement = svgRef.current
     
        // Get the content bounds
        const contentGroup = svg.select("g")
        const node = contentGroup.node() as SVGGElement
        const bbox = node?.getBBox()
     
        if (bbox) {
            const padding = 40
            const scale = Math.min(
                (svgElement.clientWidth - padding) / bbox.width,
                (svgElement.clientHeight - padding) / bbox.height,
                1 // Don't scale up beyond 1x
            )
     
            const transform = d3.zoomIdentity
                .translate(
                    (svgElement.clientWidth - bbox.width * scale) / 2 - bbox.x * scale,
                    (svgElement.clientHeight - bbox.height * scale) / 2 - bbox.y * scale
                )
                .scale(scale)
     
            svg.transition()
                .duration(750)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .call(d3.zoom().transform as any, transform)
        }
    }
    */

    return (
        <div ref={containerRef} className="relative w-full h-full">
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div className="w-full h-full">
                        <svg
                            ref={svgRef}
                            className="w-full h-full cursor-grab active:cursor-grabbing"
                            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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