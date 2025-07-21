import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkNode as ElkLayoutNode, ElkEdge as ElkLayoutEdge } from "elkjs/lib/elk-api"
import { JSValue, HEAP_OBJECT_TYPE } from "@/types/simulator"
import { useSimulatorStore } from "@/hooks/useSimulatorStore"

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
    color: string
    borderColor: string
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
    const { currentStep } = useSimulatorStore()
    const svgRef = useRef<SVGSVGElement>(null)
    const [zoomLevel, setZoomLevel] = useState(1)
    const [isDragging, setIsDragging] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'scope' | 'heap'; x: number; y: number } | null>(null)

    // Transform snapshot data into visualization format
    const transformData = () => {
        const scopesData: ScopeData[] = []
        const heapData: HeapObjectData[] = []

        // Categorize scopes with meaningful names and colors
        currentStep?.memorySnapshot.scopes.forEach((scope, index) => {
            const scopeId = `scope-${index}`
            let scopeName = "Unknown Scope"
            let scopeColor = "#e2e8f0"
            let scopeBorderColor = "#a0aec0"

            // Identify scope type
            if (scope.type === "global") {
                scopeName = "Global Scope"
                scopeColor = "#e9d8fd"
                scopeBorderColor = "#9f7aea"
            } else if (scope.type === "function") {
                scopeName = `Function Scope ${index}`
                scopeColor = "#c6f6d5"
                scopeBorderColor = "#68d391"
            } else if (scope.type === "block") {
                scopeName = `Block Scope ${index}`
                scopeColor = "#fee2e2"
                scopeBorderColor = "#f87171"
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
                let displayValue: string
                if (variable.value.type === "primitive") {
                    if (variable.value.value === undefined) {
                        displayValue = "undefined"
                    } else if (variable.value.value === null) {
                        displayValue = "null"
                    } else if (variable.value.value === "not_initialized") {
                        displayValue = "<TDZ>"
                    } else {
                        displayValue = String(variable.value.value)
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
                name: scopeName,
                color: scopeColor,
                borderColor: scopeBorderColor,
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
    }

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
                setZoomLevel(transform.k)
                contentGroup.attr("transform", transform)
            })
            .on("start", () => setIsDragging(true))
            .on("end", () => setIsDragging(false))

        // Apply zoom behavior to SVG
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
                    "elk.direction": "DOWN",
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
                    "elk.algorithm": "stress",
                    "elk.direction": "DOWN",
                    "elk.padding": "[top=20, left=20, bottom=20, right=20]",
                    "elk.spacing.nodeNode": "40",
                    "elk.stress.desiredEdgeLength": "100",
                    "elk.stress.quality": "draft",
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
                    width: 300,
                    height: calculateScopeHeight(scope.id),
                    layoutOptions: {
                        "elk.padding": "[top=10, left=10, bottom=10, right=10]",
                    },
                    labels: [{ text: scope.name, width: 100, height: 20 }],
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

        // Define the calculatePath function
        const calculatePath = (
            source: { x: number; y: number },
            target: { x: number; y: number },
            type: string
        ): string => {
            const path = d3.path()

            // Determine if we're crossing between different sections
            const crossingDivider = Math.abs(target.x - source.x) > 200

            // Calculate distances and directions
            const dx = target.x - source.x
            const dy = target.y - source.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const routeAbove = source.y > target.y

            // For variable references (scope to heap)
            if (type === "var-ref") {
                path.moveTo(source.x, source.y)

                // Adjust curve parameters based on distance and crossing
                const curveStrength = crossingDivider ? 0.5 : 0.3
                const curveHeight = Math.min(Math.max(distance * curveStrength, 40), 120) * (routeAbove ? -1 : 1)

                // For long distances, use a more pronounced S-curve
                if (distance > 300) {
                    path.bezierCurveTo(
                        source.x + dx * 0.2,
                        source.y + curveHeight * 0.7,
                        target.x - dx * 0.2,
                        target.y + curveHeight * 0.3,
                        target.x,
                        target.y,
                    )
                } else {
                    // For shorter distances, use a simpler curve
                    path.bezierCurveTo(
                        source.x + dx * 0.3,
                        source.y + curveHeight,
                        target.x - dx * 0.3,
                        target.y + curveHeight,
                        target.x,
                        target.y,
                    )
                }
            }
            // For property references (between heap objects)
            else {
                path.moveTo(source.x, source.y)

                // Adjust curve parameters based on distance and direction
                const curveHeight = Math.min(Math.max(Math.abs(dy) * 1.5, 50), 150) * (routeAbove ? -1 : 1)

                // For objects that are far apart horizontally, use a flatter curve
                if (Math.abs(dx) > 250) {
                    path.bezierCurveTo(
                        source.x + dx * 0.35,
                        source.y + curveHeight * 0.2,
                        target.x - dx * 0.35,
                        target.y + curveHeight * 0.2,
                        target.x,
                        target.y,
                    )
                }
                // For objects that are close horizontally but separated vertically, use a higher curve
                else if (Math.abs(dy) > 120) {
                    path.bezierCurveTo(
                        source.x + dx * 0.4,
                        source.y + curveHeight * 0.5,
                        target.x - dx * 0.4,
                        target.y + curveHeight * 0.5,
                        target.x,
                        target.y,
                    )
                }
                // For objects that are close to each other, use a more pronounced curve
                else {
                    path.bezierCurveTo(
                        source.x + dx * 0.5,
                        source.y + curveHeight * 0.8,
                        target.x - dx * 0.5,
                        target.y + curveHeight * 0.8,
                        target.x,
                        target.y,
                    )
                }
            }

            return path.toString()
        }



        // Function to update connections
        const updateConnections = () => {
            graphContainer.selectAll(".connection").remove()

            edgeData.forEach((edge) => {
                const sourcePos = edge.type === "prop-ref" ? propertyPositions.get(edge.source) : nodePositions.get(edge.source)
                const targetPos = nodePositions.get(edge.target)

                if (!sourcePos || !targetPos) return

                const pathType = edge.type === "var-ref" ? "var-ref" : "prop-ref"
                const arrowType = edge.type === "var-ref" ? "arrow-var-ref" : "arrow-prop-ref"

                graphContainer
                    .append("path")
                    .attr("class", "connection")
                    .attr("d", calculatePath(sourcePos, targetPos, pathType))
                    .attr("stroke", edge.type === "var-ref" ? "#4299e1" : "#ed8936")
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
                            .attr("stroke", edge.type === "var-ref" ? "#4299e1" : "#ed8936")
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
                    if (!section.children || section.children.length === 0) {
                        return section.width || 200 // Default width if no children
                    }

                    // Find the rightmost edge of all children
                    const rightmostEdge = Math.max(...section.children.map(child =>
                        (child.x || 0) + (child.width || 200)
                    ))

                    // Add padding
                    const padding = 40
                    return rightmostEdge + padding
                }

                const calculateSectionHeight = (section: ElkNode): number => {
                    if (!section.children || section.children.length === 0) {
                        return section.height || 200 // Default height if no children
                    }

                    // Find the bottommost edge of all children
                    const bottommostEdge = Math.max(...section.children.map(child =>
                        (child.y || 0) + (child.height || 200)
                    ))

                    // Add padding
                    const padding = 40
                    return bottommostEdge + padding
                }

                // Calculate actual section dimensions
                const actualMemvalSectionWidth = calculateSectionWidth(memvalSection)
                const actualScopeSectionWidth = scopeSection.children && scopeSection.children.length > 0 ? calculateSectionWidth(scopeSection) : 0
                const actualHeapSectionWidth = heapSection.children && heapSection.children.length > 0 ? calculateSectionWidth(heapSection) : 0
                const actualMemvalSectionHeight = calculateSectionHeight(memvalSection)
                const actualScopeSectionHeight = scopeSection.children && scopeSection.children.length > 0 ? calculateSectionHeight(scopeSection) : 0
                const actualHeapSectionHeight = heapSection.children && heapSection.children.length > 0 ? calculateSectionHeight(heapSection) : 0

                // Log calculated section dimensions for debugging
                console.log('Calculated Section Dimensions:', {
                    memval: { width: actualMemvalSectionWidth, height: actualMemvalSectionHeight },
                    scope: { width: actualScopeSectionWidth, height: actualScopeSectionHeight },
                    heap: { width: actualHeapSectionWidth, height: actualHeapSectionHeight }
                })

                // Position sections using calculated widths - only show sections that have content
                memvalSection.x = 0
                scopeSection.x = actualMemvalSectionWidth + sectionSpacing
                heapSection.x = actualMemvalSectionWidth + sectionSpacing + actualScopeSectionWidth + sectionSpacing

                // Apply vertical centering to all sections
                memvalSection.y = 0
                scopeSection.y = 0
                heapSection.y = 0

                // Calculate total content dimensions using actual section widths - only include sections with content
                const totalContentWidth = actualMemvalSectionWidth +
                    (actualScopeSectionWidth > 0 ? sectionSpacing + actualScopeSectionWidth : 0) +
                    (actualHeapSectionWidth > 0 ? sectionSpacing + actualHeapSectionWidth : 0)
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
                const memvalItemHeight = 35
                const memvalItemSpacing = 10
                const memvalPadding = 20

                // Calculate section height based on content (including title)
                const titleHeight = 20 // Space for title (padding + text height)
                const itemCount = Math.max(reversedMemval.length, 1) // At least 1 item height for empty state
                const memvalSectionHeight = titleHeight + (itemCount * memvalItemHeight) + ((itemCount - 1) * memvalItemSpacing) + (memvalPadding * 2)

                // Fixed position for memval section (consistent regardless of content)
                const memvalSectionX = 0
                const memvalSectionY = 0

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
                    .attr("rx", 12)
                    .attr("ry", 12)
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

                        // Add stack position indicator (FILO - First In, Last Out)
                        memvalGroup
                            .append("text")
                            .attr("x", 8)
                            .attr("y", 12)
                            .attr("font-size", "10px")
                            .attr("font-family", "monospace")
                            .attr("fill", "#64748b")
                            .attr("font-weight", "bold")
                            .text(`[${reversedMemval.length - 1 - memvalIndex}]`)

                        // Add memval value with type at the bottom
                        const displayValue = isReference ? `ref: ${memvalData.ref}` : String(memvalData.value)
                        const typeText = isReference ? "ref" : typeof memvalData.value
                        const valueWithType = `${displayValue}: (${typeText})`

                        memvalGroup
                            .append("text")
                            .attr("x", itemWidth / 2)
                            .attr("y", 28)
                            .attr("font-size", "12px")
                            .attr("font-family", "monospace")
                            .attr("fill", "#1e293b")
                            .attr("font-weight", "500")
                            .attr("text-anchor", "middle")
                            .text(valueWithType)
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
                            .call(d3.drag()
                                .on("start", (event) => {
                                    event.sourceEvent.stopPropagation()
                                    // Store the initial position and mouse position
                                    const initialX = (scopeSection.x || 0) + singleColumnX
                                    const initialY = (scopeSection.y || 0) + singleColumnY
                                    const mouseX = event.x
                                    const mouseY = event.y
                                    setDraggedItem({ id: scopeNode.id, type: 'scope', x: initialX, y: initialY })
                                    setIsDragging(true)
                                    scopeGroup.select("rect").style("cursor", "grabbing")
                                    // Store the offset for smooth dragging
                                    scopeGroup.attr("data-drag-offset-x", String(mouseX - initialX))
                                    scopeGroup.attr("data-drag-offset-y", String(mouseY - initialY))
                                })
                                .on("drag", (event) => {
                                    // Get the stored offset
                                    const offsetX = parseFloat(scopeGroup.attr("data-drag-offset-x") || "0")
                                    const offsetY = parseFloat(scopeGroup.attr("data-drag-offset-y") || "0")

                                    // Calculate new position based on current mouse position minus offset
                                    const newX = event.x - offsetX
                                    const newY = event.y - offsetY

                                    // Update the visual position
                                    scopeGroup.attr("transform", `translate(${newX}, ${newY})`)

                                    // Update node positions for connections
                                    const scopeWidth = scopeNode.width || 200
                                    const scopeHeight = actualScopeHeight
                                    nodePositions.set(scopeNode.id, {
                                        x: newX + scopeWidth / 2,
                                        y: newY + scopeHeight / 2
                                    })

                                    // Update variable positions
                                    scopeData.variables.forEach((varData, varIndex) => {
                                        const varNodeId = `var-${scopeNode.id}-${varData.name}`
                                        nodePositions.set(varNodeId, {
                                            x: newX + 295,
                                            y: newY + 40 + varIndex * 35 + 10
                                        })
                                    })

                                    // Update connections
                                    updateConnections()
                                })
                                .on("end", () => {
                                    setDraggedItem(null)
                                    setIsDragging(false)
                                    scopeGroup.select("rect").style("cursor", "grab")
                                    // Clean up the stored offset
                                    scopeGroup.attr("data-drag-offset-x", null)
                                    scopeGroup.attr("data-drag-offset-y", null)
                                }) as unknown as d3.DragBehavior<SVGGElement, unknown, unknown>)



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
                            .attr("rx", 10)
                            .attr("ry", 10)
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

                        // Add scope name
                        scopeGroup.append("text").attr("x", 10).attr("y", 20).attr("font-weight", "bold").text(scopeData.name)

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
                            variableGroup
                                .append("text")
                                .attr("x", 21)
                                .attr("y", 15)
                                .attr("font-size", "12px")
                                .text(`${varData.name}: ${varData.value || ""}`)

                            // Store variable position for connections - position at the right side of the variable
                            const varX = (scopeSection.x || 0) + singleColumnX + 295
                            const varY = (scopeSection.y || 0) + singleColumnY + 40 + varIndex * 35 + 10
                            nodePositions.set(varNodeId, { x: varX, y: varY })

                            // Add a small circle at the connection point for variables (only for reference types)
                            if (varData.type === "reference") {
                                variableGroup
                                    .append("circle")
                                    .attr("cx", 284)
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

                // Draw heap objects - ensure all heap objects are drawn regardless of ELK positioning - only if there are heap objects
                if (memoryModelData.heap.length > 0) {
                    memoryModelData.heap.forEach((objData, objIndex: number) => {
                        const objNodeId = objData.id

                        // Use the x position from ELK layout if available, otherwise calculate manually
                        const objNode = heapSection.children?.find(child => child.id === objNodeId)
                        const objX = objNode?.x || objIndex * (objectWidth + 50) // 50px spacing between objects

                        const objectGroup = graphContainer
                            .append("g")
                            .attr("class", "heap-object")
                            .attr("data-id", objNodeId)
                            .attr("transform", `translate(${(heapSection.x || 0) + objX}, ${(heapSection.y || 0) + (objNode?.y || 0)})`)
                            .call(d3.drag()
                                .on("start", (event) => {
                                    event.sourceEvent.stopPropagation()
                                    // Store the initial position and mouse position
                                    const initialX = (heapSection.x || 0) + objX
                                    const initialY = (heapSection.y || 0) + (objNode?.y || 0)
                                    const mouseX = event.x
                                    const mouseY = event.y
                                    setDraggedItem({ id: objNodeId, type: 'heap', x: initialX, y: initialY })
                                    setIsDragging(true)
                                    objectGroup.select("rect").style("cursor", "grabbing")
                                    // Store the offset for smooth dragging
                                    objectGroup.attr("data-drag-offset-x", String(mouseX - initialX))
                                    objectGroup.attr("data-drag-offset-y", String(mouseY - initialY))
                                })
                                .on("drag", (event) => {
                                    // Get the stored offset
                                    const offsetX = parseFloat(objectGroup.attr("data-drag-offset-x") || "0")
                                    const offsetY = parseFloat(objectGroup.attr("data-drag-offset-y") || "0")

                                    // Calculate new position based on current mouse position minus offset
                                    const newX = event.x - offsetX
                                    const newY = event.y - offsetY

                                    // Update the visual position
                                    objectGroup.attr("transform", `translate(${newX}, ${newY})`)

                                    // Update node positions for connections
                                    const objWidth = objNode?.width || objectWidth
                                    const objHeight = objNode?.height || objectHeight
                                    nodePositions.set(objNodeId, {
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
                                .on("end", () => {
                                    setDraggedItem(null)
                                    setIsDragging(false)
                                    objectGroup.select("rect").style("cursor", "grab")
                                    // Clean up the stored offset
                                    objectGroup.attr("data-drag-offset-x", null)
                                    objectGroup.attr("data-drag-offset-y", null)
                                }) as unknown as d3.DragBehavior<SVGGElement, unknown, unknown>)



                        // Store object position for connections - use left edge for incoming connections
                        nodePositions.set(objNodeId, { x: (heapSection.x || 0) + objX, y: (heapSection.y || 0) + (objNode?.y || 0) + (objNode?.height || objectHeight) / 2 })

                        // Draw object rectangle
                        objectGroup
                            .append("rect")
                            .attr("width", objNode?.width || objectWidth)
                            .attr("height", objNode?.height || objectHeight)
                            .attr("rx", 5)
                            .attr("ry", 5)
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
                            .attr("width", objNode?.width || objectWidth)
                            .attr("height", 25)
                            .attr("rx", 5)
                            .attr("ry", 5)
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
                                    const propX = (heapSection.x || 0) + objX + (objNode?.width || objectWidth) - 10
                                    const propY = (heapSection.y || 0) + (objNode?.y || 0) + 45 + i * 20
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
                                        .attr("cx", (objNode?.width || objectWidth) - 10)
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
    }, [currentStep])

    // Navigation control functions
    const handleZoomIn = () => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        svg.transition()
            .duration(300)
            .call(d3.zoom().scaleBy as any, 1.5)
    }

    const handleZoomOut = () => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        svg.transition()
            .duration(300)
            .call(d3.zoom().scaleBy as any, 1 / 1.5)
    }

    const handleResetZoom = () => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        svg.transition()
            .duration(750)
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
                .call(d3.zoom().transform as any, transform)
        }
    }

    // Helper function to calculate scope height (moved outside useEffect for reuse)
    const calculateScopeHeight = (scopeId: string): number => {
        const scopeData = currentStep?.memorySnapshot.scopes.find((_, index) => `scope-${index}` === scopeId)
        if (!scopeData) return 120

        const headerHeight = 30
        const variableSpacing = 35
        const bottomPadding = 10
        const variableCount = Object.keys(scopeData.variables).length
        const calculatedHeight = headerHeight + variableCount * variableSpacing + bottomPadding

        return variableCount > 0 ? calculatedHeight : 120
    }

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