import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as d3 from "d3"
import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkNode as ElkLayoutNode, ElkEdge as ElkLayoutEdge } from "elkjs/lib/elk-api"
import { JSValue, HEAP_OBJECT_TYPE } from "@/types/simulator"
import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { getStepColorByDepth } from "@/helpers/steps"

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
    scopeTags: string
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
    const { currentStep, steps } = useSimulatorStore()
    const svgRef = useRef<SVGSVGElement>(null)
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
            let scopeTags = ""
            if (scope.type === "global") {
                scopeTags = "[Global Scope]"
            } else if (scope.type === "function") {
                scopeTags = "[Function Scope]"
            } else if (scope.type === "block") {
                scopeTags = "[Block Scope]"
            } else {
                scopeTags = "[Unknown Scope]"
            }

            // Add "[Current]" tag if this is the current scope
            if (originalIndex === currentStep?.scopeIndex) {
                scopeTags += " [Current]"
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
                    displayValue = `[Reference: ${variable.value.ref}]`
                }

                return {
                    id: varId,
                    name,
                    type: varType,
                    target,
                    value: displayValue
                }
            })

            scopesData.push({
                id: scopeId,
                name: scopeTags,
                scopeTags,
                color: stepColor.backgroundColor,
                borderColor: stepColor.borderColor,
                textColor: stepColor.textColor,
                variables
            })
        })

        // Process heap objects
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

            heapData.push({
                id: objId,
                type: objType,
                color: objColor,
                borderColor: objBorderColor,
                properties
            })
        })

        return {
            scopes: scopesData,
            heap: heapData
        }
    }, [currentStep, getMaxDepth])

    // Helper function to format property values
    const formatPropertyValue = (propName: string, propValue: JSValue): { name: string; value: string; target?: string } => {
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
            return {
                name: propName,
                value: `[Reference: ${propValue.ref}]`,
                target: `obj-${propValue.ref}`
            }
        }
    }



    useEffect(() => {
        if (!currentStep) return
        if (!svgRef.current) return

        // Clear any existing SVG content
        d3.select(svgRef.current).selectAll("*").remove()

        // Transform the data into visualization format
        const memoryModelData = transformData()

        // Set up dimensions and calculate content size
        const margin = { top: 40, right: 40, bottom: 20, left: 40 }

        // Define common dimensions
        const scopeHeight = 120
        const variableHeight = 30
        const objectWidth = 180
        const objectHeight = 120

        // Calculate initial content dimensions (will be updated after layout)
        const memvalCount = currentStep?.memorySnapshot.memval?.length || 0
        const memvalSectionHeight = memvalCount * 50 // 50px per memval item

        // Calculate scope section dimensions
        const scopeSectionHeight = memoryModelData.scopes.reduce((total, scope) => {
            const headerHeight = 30
            const variableSpacing = 35
            const bottomPadding = 10
            const calculatedHeight = headerHeight + scope.variables.length * variableSpacing + bottomPadding
            return total + Math.max(scopeHeight, calculatedHeight) + 40
        }, 0)

        // Calculate heap section dimensions
        const heapSectionHeight = memoryModelData.heap.reduce((total, objData) => {
            const propCount = objData.properties ? objData.properties.length : 0
            const objHeight = Math.max(objectHeight, 40 + propCount * 20)
            return total + objHeight + 50
        }, 0)

        // Calculate initial total content dimensions (will be updated after layout)
        const sectionSpacing = 50
        const initialTotalContentWidth = 800 // Initial estimate, will be updated
        const totalContentHeight = Math.max(memvalSectionHeight, scopeSectionHeight, heapSectionHeight)

        // Calculate viewport dimensions (use container size or default)
        const viewportWidth = Math.max(initialTotalContentWidth + margin.left + margin.right, 1000)
        const viewportHeight = Math.max(totalContentHeight + margin.top + margin.bottom, 1000)

        // Calculate centering offsets
        const centerX = (viewportWidth - initialTotalContentWidth) / 2
        const centerY = (viewportHeight - totalContentHeight) / 2

        // Helper function to calculate scope height based on content
        const calculateScopeHeight = (scopeId: string): number => {
            const scopeData = memoryModelData.scopes.find(s => s.id === scopeId)
            if (!scopeData) return scopeHeight

            const headerHeight = 30 // Space for scope name
            const variableSpacing = 35 // Space between variables (matches rendering)
            const bottomPadding = 10 // Bottom padding
            const calculatedHeight = headerHeight + scopeData.variables.length * variableSpacing + bottomPadding

            return scopeData.variables.length > 0 ? calculatedHeight : scopeHeight
        }

        // Create SVG with calculated dimensions
        const svg = d3
            .select(svgRef.current)
            .attr("width", viewportWidth)
            .attr("height", viewportHeight)
            .attr("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`)

        // Create zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 5]) // Min zoom 0.1x, max zoom 3x
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



        // Section titles will be added dynamically after layout

        // Create a container for the graph
        const graphContainer = contentGroup.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`)

        // Background rectangles and dividers will be added dynamically after layout

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

            // Create a section for memval with content-based sizing
            const memvalSection: ElkNode = {
                id: "memvalSection",
                layoutOptions: {
                    "elk.algorithm": "layered",
                    "elk.direction": "UP",
                    "elk.partitioning.activate": "true",
                    "elk.padding": "[top=20, left=20, bottom=20, right=20]",
                    "elk.spacing.nodeNode": "20",
                    "elk.layered.spacing.baseValue": "15",
                    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
                    "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
                    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
                },
                children: [],
            }

            // Create a section for scopes with content-based sizing
            const scopeSection: ElkNode = {
                id: "scopeSection",
                layoutOptions: {
                    "elk.algorithm": "layered",
                    "elk.direction": "UP",
                    "elk.partitioning.activate": "true",
                    "elk.padding": "[top=20, left=20, bottom=20, right=20]",
                    "elk.spacing.nodeNode": "20",
                    "elk.layered.spacing.baseValue": "15",
                    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
                    "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
                    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
                },
                children: [],
            }

            // Create a section for heap with content-based sizing
            const heapSection: ElkNode = {
                id: "heapSection",
                layoutOptions: {
                    "elk.algorithm": "layered",
                    "elk.direction": "RIGHT",
                    "elk.partitioning.activate": "true",
                    "elk.padding": "[top=20, left=20, bottom=20, right=20]",
                    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
                    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
                    "elk.spacing.nodeNode": "50",
                    "elk.layered.spacing.nodeNodeBetweenLayers": "60",
                    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
                    "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
                    "elk.edgeRouting": "SPLINES",
                },
                children: [],
            }

            // Add memval nodes (FILO pattern - reverse the array to show first in at bottom)
            const memvalItems = currentStep?.memorySnapshot.memval || []
            const reversedMemval = [...memvalItems].reverse() // Reverse for FILO display

            reversedMemval.forEach((memval, index) => {
                const memvalNode: ElkNode = {
                    id: `memval-${index}`,
                    width: 150,
                    height: 40,
                    layoutOptions: {
                        "elk.padding": "[top=5, left=5, bottom=5, right=5]",
                    },
                    labels: [{
                        text: memval.type === "reference" ? `ref: ${memval.ref}` : String(memval.value),
                        width: 130,
                        height: 30
                    }],
                }
                memvalSection.children?.push(memvalNode)
            })

            // Add scope nodes
            memoryModelData.scopes.forEach((scope) => {
                const scopeNode: ElkNode = {
                    id: scope.id,
                    width: 200,
                    height: calculateScopeHeight(scope.id),
                    layoutOptions: {
                        "elk.padding": "[top=5, left=5, bottom=5, right=5]",
                    },
                    labels: [{ text: scope.scopeTags, width: 120, height: 20 }],
                    children: [],
                }

                // Add variable nodes as children of scope
                scope.variables.forEach((variable) => {
                    const varNode: ElkNode = {
                        id: variable.id,
                        width: 280,
                        height: variableHeight,
                        labels: [{ text: variable.name, width: 80, height: 20 }],
                    }

                    scopeNode.children?.push(varNode)
                })

                scopeSection.children?.push(scopeNode)
            })

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

            // Add edges from variables to heap objects
            memoryModelData.scopes.forEach((scope) => {
                scope.variables.forEach((variable) => {
                    if (variable.type === "reference" && variable.target) {
                        graph.edges.push({
                            id: `${variable.id}_to_${variable.target}`,
                            sources: [variable.id],
                            targets: [variable.target],
                            layoutOptions: {
                                "elk.layered.priority.direction": "1",
                            },
                        })
                    }
                })
            })

            // Add edges between heap objects
            memoryModelData.heap.forEach((object) => {
                if (object.properties) {
                    object.properties.forEach((prop, propIndex) => {
                        if (prop.target) {
                            graph.edges.push({
                                id: `${object.id}_${prop.name}_to_${prop.target}`,
                                sources: [object.id],
                                targets: [prop.target],
                                layoutOptions: {
                                    "elk.layered.priority.direction": "1",
                                },
                                propIndex,
                            })
                        }
                    })
                }
            })

            return graph
        }

        const elkGraph = createElkGraph()
        const elk = new ELK()

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
                            x: newX,
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
                                x: newX + objWidth - 10,
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
                        return 200
                    }

                    if (section.id === "scopeSection") {
                        return 300
                    }

                    // Find the rightmost edge of all children
                    const rightmostEdge = Math.max(...section.children.map(child =>
                        (child.x || 0) + (child.width || 200) + 200
                    ))

                    return rightmostEdge
                }

                const calculateSectionHeight = (section: ElkNode): number => {
                    if (!section.children || section.children.length === 0) {
                        return 100 // Default height if no children
                    }

                    // For scope sections, calculate height based on scope content
                    if (section.id === "scopeSection") {
                        let totalHeight = 0

                        section.children.forEach((scopeNode) => {
                            // Find the corresponding scope data
                            const scopeHeight = calculateScopeHeight(scopeNode.id)
                            totalHeight += scopeHeight + 20// Add spacing between scopes
                        })

                        return totalHeight
                    }

                    // For memval sections, calculate height based on memval content
                    if (section.id === "memvalSection") {
                        const memvalItems = currentStep?.memorySnapshot.memval || []
                        const reversedMemval = [...memvalItems].reverse()

                        // Define consistent dimensions for memval section
                        const titleHeight = 20 // Space for section title
                        const memvalItemHeight = 30 // Height of each memval item
                        const memvalItemSpacing = 10 // Spacing between items
                        const sectionPadding = 20 // Padding around the section

                        // Calculate section height based on content
                        const itemCount = Math.max(reversedMemval.length, 1) // At least 1 item height for empty state
                        const itemsHeight = itemCount * (memvalItemHeight + memvalItemSpacing)
                        const totalHeight = titleHeight + itemsHeight + sectionPadding * 2 + 15

                        return totalHeight
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
                const actualMemvalSectionWidth = calculateSectionWidth(memvalSection)
                const actualScopeSectionWidth = scopeSection.children && scopeSection.children.length > 0 ? calculateSectionWidth(scopeSection) : 0
                const actualHeapSectionWidth = heapSection.children && heapSection.children.length > 0 ? calculateSectionWidth(heapSection) : 0

                const actualMemvalSectionHeight = memvalSection.children && memvalSection.children.length > 0 ? calculateSectionHeight(memvalSection) : 110
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
                memvalSection.x = 0
                heapSection.x = sectionSpacing + actualMemvalSectionWidth
                scopeSection.x = heapSection.x + sectionSpacing + actualHeapSectionWidth

                memvalSection.y = actualScopeSectionHeight - actualMemvalSectionHeight
                scopeSection.y = 0
                heapSection.y = 0

                // Calculate total content dimensions using actual section widths - only include sections with content
                // New layout order: memval -> heap -> scope
                const totalContentWidth = actualMemvalSectionWidth + actualHeapSectionWidth + actualScopeSectionWidth + 2 * sectionSpacing
                const totalContentHeight = Math.max(actualMemvalSectionHeight, actualScopeSectionHeight, actualHeapSectionHeight)

                // Update viewport dimensions if needed
                const newViewportWidth = Math.max(totalContentWidth + margin.left + margin.right, 700)
                const newViewportHeight = Math.max(totalContentHeight + margin.top + margin.bottom, 700)

                // Update SVG dimensions if they changed significantly
                if (Math.abs(newViewportWidth - viewportWidth) > 50 || Math.abs(newViewportHeight - viewportHeight) > 50) {
                    svg
                        .attr("width", newViewportWidth)
                        .attr("height", newViewportHeight)
                        .attr("viewBox", `0 0 ${newViewportWidth} ${newViewportHeight}`)
                }

                // Recalculate centering offsets with actual dimensions
                const newCenterX = (newViewportWidth - totalContentWidth) / 2
                const newCenterY = (newViewportHeight - totalContentHeight) / 2

                // Update content group position with scale 1
                contentGroup.attr("transform", `translate(${newCenterX}, ${newCenterY}) scale(1)`)

                // Reset zoom to fit content
                const fitTransform = d3.zoomIdentity
                    .translate(newCenterX, newCenterY)
                    .scale(1)

                svg.transition()
                    .duration(750)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .call(zoom.transform as any, fitTransform)

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

                // Refactored MEMVAL section with improved UI and calculated positioning
                const memvalItems = currentStep?.memorySnapshot.memval || []
                const reversedMemval = [...memvalItems].reverse()

                // Define consistent dimensions for memval section
                const memvalItemHeight = 30
                const memvalItemSpacing = 10
                const memvalPadding = 20

                // Calculate section height based on content (including title)
                const titleHeight = 20 // Space for title (padding + text height)
                const itemCount = Math.max(reversedMemval.length, 1) // At least 1 item height for empty state
                const memvalSectionHeight = titleHeight + (itemCount * memvalItemHeight) + ((itemCount - 1) * memvalItemSpacing) + (memvalPadding * 2)

                // Fixed position for memval section (consistent regardless of content)
                const memvalSectionX = memvalSection.x || 0
                const memvalSectionY = memvalSection.y || 0

                // Create memval section container
                const memvalContainer = graphContainer
                    .append("g")
                    .attr("class", "memval-section")
                    .attr("transform", `translate(${memvalSectionX}, ${memvalSectionY})`)

                // Draw memval section background with improved styling using calculated width
                memvalContainer
                    .append("rect")
                    .attr("width", actualMemvalSectionWidth)
                    .attr("height", memvalSectionHeight)
                    .attr("rx", 6)
                    .attr("ry", 6)
                    .attr("fill", "#f8fafc")
                    .attr("stroke", "#e2e8f0")
                    .attr("stroke-width", 2)

                // Add memval section title
                memvalContainer
                    .append("text")
                    .attr("x", actualMemvalSectionWidth / 2)
                    .attr("y", memvalPadding)
                    .attr("text-anchor", "middle")
                    .attr("font-size", "14px")
                    .attr("font-family", "monospace")
                    .attr("font-weight", "bold")
                    .attr("fill", "#374151")
                    .text("MEMVAL Stack")

                // Draw memval items or empty state
                if (reversedMemval.length > 0) {
                    // Draw actual memval items
                    reversedMemval.forEach((memvalData, memvalIndex: number) => {
                        const itemY = memvalPadding + titleHeight + (memvalIndex * (memvalItemHeight + memvalItemSpacing))

                        const memvalGroup = memvalContainer
                            .append("g")
                            .attr("class", "memval-item")
                            .attr("transform", `translate(${memvalPadding}, ${itemY})`)

                        // Determine item styling based on type
                        const isReference = memvalData.type === "reference"
                        const itemColor = isReference ? "#dbeafe" : "#f0f9ff"
                        const itemBorderColor = isReference ? "#3b82f6" : "#0ea5e9"
                        const itemWidth = actualMemvalSectionWidth - (memvalPadding * 2)

                        // Draw item background
                        memvalGroup
                            .append("rect")
                            .attr("width", itemWidth)
                            .attr("height", memvalItemHeight)
                            .attr("rx", 6)
                            .attr("ry", 6)
                            .attr("fill", itemColor)
                            .attr("stroke", itemBorderColor)
                            .attr("stroke-width", 1.5)

                        // Add memval value with type at the bottom
                        const memvalType = isReference ? "ref" : typeof memvalData.value
                        const value = isReference ? memvalData.ref : memvalData.value
                        const formattedValue = memvalType === "string" ? `"${value}"` : value
                        const displayText = formattedValue

                        memvalGroup
                            .append("text")
                            .attr("x", itemWidth / 2)
                            .attr("y", 20)
                            .attr("font-size", "12px")
                            .attr("font-family", "monospace")
                            .attr("fill", "#1e293b")
                            .attr("font-weight", "500")
                            .attr("text-anchor", "middle")
                            .text(displayText as string)

                        // Store memval position for connections if it's a reference
                        if (isReference) {
                            const memvalId = `memval-${memvalIndex}`
                            const memvalX = memvalSectionX + memvalPadding + itemWidth
                            const memvalY = memvalSectionY + itemY + memvalItemHeight / 2
                            nodePositions.set(memvalId, { x: memvalX, y: memvalY })

                            // Add edge data for memval references
                            edgeData.push({
                                source: memvalId,
                                target: `obj-${memvalData.ref}-left`,
                                type: "memval-ref",
                                label: `memval-${memvalIndex}`,
                            })

                            // Add a small circle at the connection point
                            memvalGroup
                                .append("circle")
                                .attr("cx", itemWidth - 5)
                                .attr("cy", memvalItemHeight / 2)
                                .attr("r", 3)
                                .attr("fill", "#8b5cf6")
                                .attr("stroke", "none")
                        }
                    })
                } else {
                    // Draw empty state with placeholder
                    const emptyItemY = memvalPadding + titleHeight
                    const emptyItemWidth = actualMemvalSectionWidth - (memvalPadding * 2)

                    const emptyGroup = memvalContainer
                        .append("g")
                        .attr("class", "memval-empty")
                        .attr("transform", `translate(${memvalPadding}, ${emptyItemY})`)

                    // Draw empty item background
                    emptyGroup
                        .append("rect")
                        .attr("width", emptyItemWidth)
                        .attr("height", memvalItemHeight)
                        .attr("rx", 6)
                        .attr("ry", 6)
                        .attr("fill", "#f1f5f9")
                        .attr("stroke", "#cbd5e1")
                        .attr("stroke-width", 1.5)
                        .attr("stroke-dasharray", "3,3")

                    // Add empty state text
                    emptyGroup
                        .append("text")
                        .attr("x", emptyItemWidth / 2)
                        .attr("y", memvalItemHeight / 2 + 5)
                        .attr("text-anchor", "middle")
                        .attr("font-size", "12px")
                        .attr("font-family", "monospace")
                        .attr("fill", "#94a3b8")
                        .attr("font-style", "italic")
                        .text("empty")
                }

                // Draw scopes in a single column - only if there are scopes
                if (scopeSection.children && scopeSection.children.length > 0) {
                    scopeSection.children.forEach((scopeNode: ElkNode, scopeIndex: number) => {
                        // Find the original scope data
                        const scopeData = memoryModelData.scopes.find(s => s.id === scopeNode.id)
                        if (!scopeData) return

                        // Force single column positioning
                        const singleColumnX = 0
                        const actualScopeHeight = calculateScopeHeight(scopeNode.id)
                        const singleColumnY = scopeIndex === 0 ? 0 :
                            scopeSection.children?.slice(0, scopeIndex).reduce((total, prevNode) =>
                                total + calculateScopeHeight(prevNode.id) + 20, 0) || 0

                        const scopeGroup = graphContainer
                            .append("g")
                            .attr("class", "scope")
                            .attr("data-id", scopeNode.id)
                            .attr("transform", `translate(${(scopeSection.x || 0) + singleColumnX}, ${(scopeSection.y || 0) + singleColumnY})`)
                            .style("cursor", "grab")
                            .call(createScopeDragBehavior(scopeNode, scopeData, actualScopeHeight))

                        // Store scope position for connections - use the forced single column position
                        nodePositions.set(scopeNode.id, {
                            x: (scopeSection.x || 0) + singleColumnX + (scopeNode.width || 200) / 2,
                            y: (scopeSection.y || 0) + singleColumnY + actualScopeHeight / 2
                        })

                        // Draw scope rectangle
                        scopeGroup
                            .append("rect")
                            .attr("width", scopeNode.width || 200)
                            .attr("height", actualScopeHeight)
                            .attr("rx", 6)
                            .attr("ry", 6)
                            .attr("fill", scopeData.color)
                            .attr("stroke", scopeData.borderColor)
                            .attr("stroke-width", 2)
                            .style("cursor", "grab")
                            .on("mouseover", function () {
                                d3.select(this).style("cursor", "grab").attr("stroke-width", 3)
                            })
                            .on("mouseout", function () {
                                d3.select(this).style("cursor", "grab").attr("stroke-width", 2)
                            })

                        // Add scope type tag
                        scopeGroup
                            .append("text")
                            .attr("x", 10)
                            .attr("y", 20)
                            .attr("font-weight", "bold")
                            .attr("fill", scopeData.textColor)
                            .attr("font-size", "12px")
                            .text(scopeData.scopeTags)

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
                            const displayText = `${varData.name}${isReference ? "" : `: ${varData.value}`}`

                            variableGroup
                                .append("text")
                                .attr("x", 21)
                                .attr("y", 15)
                                .attr("font-size", "12px")
                                .attr("fill", scopeData.textColor)
                                .text(displayText)

                            // Store variable position for connections - position at the left side of the scope
                            const varX = (scopeSection.x || 0) + singleColumnX
                            const varY = (scopeSection.y || 0) + singleColumnY + 40 + varIndex * 35 + 10
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

                    // Set up D3 force simulation for heap objects with crossing avoidance
                    const simulation = d3.forceSimulation(heapNodes)
                        .force("collision", d3.forceCollide().radius((d: d3.SimulationNodeDatum) => {
                            const node = d as HeapNodeDatum
                            return Math.max(node.width, node.height) / 2 + 80 // Increased from 40 to 80 for more spacing
                        }).strength(0.8)) // Add strength parameter for stronger collision avoidance
                        .force("center", d3.forceCenter((heapSection.x || 0) + (heapSection.width || 400) / 2, (heapSection.y || 0) + (heapSection.height || 300) / 2))
                        .force("x", d3.forceX((heapSection.x || 0) + 100).strength(0.1)) // Reduced from 0.15 to allow more spread
                        .force("y", d3.forceY((heapSection.y || 0) + 100).strength(0.1)) // Reduced from 0.15 to allow more spread
                        .force("avoidCrossings", avoidCrossingsForce())
                        .force("repel", d3.forceManyBody().strength(-500)) // Add general repulsion force
                        .alphaDecay(0.01) // Reduced from 0.02 for longer simulation
                        .velocityDecay(0.3) // Reduced from 0.4 for more dynamic movement

                    // Run simulation to completion with more iterations for better results
                    simulation.stop()
                    for (let i = 0; i < 400; ++i) simulation.tick() // Increased from 200 to 400 for better convergence

                    // Recalculate heap section bounds after force simulation
                    if (heapNodes.length > 0) {
                        const minX = Math.min(...heapNodes.map(node => (node.x || 0)))
                        const maxX = Math.max(...heapNodes.map(node => (node.x || 0) + node.width))
                        const minY = Math.min(...heapNodes.map(node => (node.y || 0)))
                        const maxY = Math.max(...heapNodes.map(node => (node.y || 0) + node.height))

                        // Update heap section bounds with padding
                        const padding = 40
                        const actualHeapWidth = maxX - minX + padding * 2
                        const actualHeapHeight = maxY - minY + padding * 2

                        // Adjust heap section position if objects moved outside bounds
                        const adjustedHeapX = Math.min(heapSection.x || 0, minX - padding)
                        heapSection.x = adjustedHeapX
                        heapSection.width = actualHeapWidth
                        heapSection.height = actualHeapHeight

                        // Recalculate total content width with updated heap section
                        // New layout order: memval -> heap -> scope
                        const updatedTotalContentWidth = actualMemvalSectionWidth + actualHeapWidth + actualScopeSectionWidth + 2 * sectionSpacing

                        // Update viewport if content is wider than current viewport
                        const currentViewportWidth = parseFloat(svg.attr("width"))
                        const requiredViewportWidth = updatedTotalContentWidth + margin.left + margin.right

                        if (requiredViewportWidth > currentViewportWidth) {
                            const newViewportWidth = Math.max(requiredViewportWidth, 700)
                            const newCenterX = (newViewportWidth - updatedTotalContentWidth) / 2

                            svg
                                .attr("width", newViewportWidth)
                                .attr("viewBox", `0 0 ${newViewportWidth} ${newViewportHeight}`)

                            // Update content group position
                            contentGroup.attr("transform", `translate(${newCenterX}, ${newCenterY}) scale(1)`)

                            // Update zoom transform
                            const newFitTransform = d3.zoomIdentity
                                .translate(newCenterX, newCenterY)
                                .scale(1)

                            svg.transition()
                                .duration(300)
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .call(zoom.transform as any, newFitTransform)
                        }
                    }

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
                                    const propX = (heapNode.x || 0) + heapNode.width - 10
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
                                        .attr("cx", heapNode.width - 10)
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
    }, [currentStep, transformData])

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
        <div className="relative w-full h-full">
            {/* Navigation Controls
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-gray-200">
                <button
                    onClick={handleZoomIn}
                    className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                    title="Zoom In"
                    aria-label="Zoom In"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                </button>

                <button
                    onClick={handleZoomOut}
                    className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                    title="Zoom Out"
                    aria-label="Zoom Out"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                </button>

                <button
                    onClick={handleResetZoom}
                    className="p-2 rounded-md bg-gray-500 text-white hover:bg-gray-600 transition-colors"
                    title="Reset Zoom"
                    aria-label="Reset Zoom"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                </button>

                <button
                    onClick={handleFitToView}
                    className="p-2 rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors"
                    title="Fit to View"
                    aria-label="Fit to View"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                </button>
            </div>

            <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 shadow-lg border border-gray-200">
                <span className="text-sm font-mono text-gray-700">
                    {Math.round(zoomLevel * 100)}%
                </span>
            </div>

            <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200 max-w-xs">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Navigation</h3>
                <ul className="text-xs text-gray-600 space-y-1">
                    <li>• <strong>Drag</strong> to pan around</li>
                    <li>• <strong>Scroll</strong> to zoom in/out</li>
                    <li>• <strong>Double-click</strong> to reset zoom</li>
                </ul>
            </div> */}

            <svg
                ref={svgRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            />
        </div>
    )
}

export default MemoryModelVisualizer 