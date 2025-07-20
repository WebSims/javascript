import { useEffect, useRef } from "react"
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
    const zoomGroupRef = useRef<SVGGElement | null>(null)

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

        // Create a group for content positioning with scale 1
        const contentGroup = svg.append("g")
            .attr("transform", `translate(${centerX}, ${centerY}) scale(1)`)
        zoomGroupRef.current = contentGroup.node()



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
                    width: 200,
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
                        width: 180,
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

        // Create maps to store node positions and data
        const nodePositions = new Map()
        const propertyPositions = new Map()
        const nodeData = new Map()
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

        // Define drag behavior for scopes
        const scopeDrag = d3
            .drag<SVGGElement, unknown>()
            .on("start", function () {
                d3.select(this).raise().classed("active", true)
            })
            .on("drag", function (event) {
                const scopeId = d3.select(this).attr("data-id")
                const scopeData = nodeData.get(scopeId)
                if (!scopeData) return

                let newX = event.x
                let newY = event.y

                // Allow unlimited dragging in all directions
                // Remove horizontal constraints for endless canvas
                newX = event.x
                // Remove vertical constraints for endless canvas
                newY = event.y

                d3.select(this).attr("transform", `translate(${newX},${newY})`)

                // Update node positions
                nodePositions.set(scopeId, { x: newX + scopeData.width / 2, y: newY + scopeData.height / 2 })

                // Update variable positions
                scopeData.variables.forEach((varId: string, index: number) => {
                    const varX = newX + 195 // Position at the right edge of the variable
                    const varY = newY + 40 + index * 35 + 10 // Center of the variable
                    nodePositions.set(varId, { x: varX, y: varY })
                })

                updateConnections()
            })
            .on("end", function () {
                d3.select(this).classed("active", false)
            })

        // Define drag behavior for heap objects
        const heapObjectDrag = d3
            .drag<SVGGElement, unknown>()
            .on("start", function () {
                d3.select(this).raise().classed("active", true)
            })
            .on("drag", function (event) {
                const objId = d3.select(this).attr("data-id")
                const objData = nodeData.get(objId)
                if (!objData) return

                let newX = event.x
                let newY = event.y

                // Allow unlimited dragging in all directions
                // Remove horizontal constraints for endless canvas
                newX = event.x
                // Remove vertical constraints for endless canvas
                newY = event.y

                d3.select(this).attr("transform", `translate(${newX},${newY})`)

                // Update node positions
                nodePositions.set(objId, { x: newX, y: newY + objData.height / 2 })

                // Update property positions
                if (objData.properties) {
                    objData.properties.forEach((propId: string, i: number) => {
                        const propX = newX + objectWidth - 10
                        const propY = newY + 45 + i * 20
                        propertyPositions.set(propId, { x: propX, y: propY })
                    })
                }

                updateConnections()
            })
            .on("end", function () {
                d3.select(this).classed("active", false)
            })

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
                            .attr("y", 15)
                            .attr("font-size", "10px")
                            .attr("font-family", "monospace")
                            .attr("fill", "#64748b")
                            .attr("font-weight", "bold")
                            .text(`[${memvalIndex}]`)

                        // Add memval value
                        const displayValue = isReference ? `ref: ${memvalData.ref}` : String(memvalData.value)
                        const typeText = isReference ? "ref" : typeof memvalData.value

                        memvalGroup
                            .append("text")
                            .attr("x", 25)
                            .attr("y", 15)
                            .attr("font-size", "12px")
                            .attr("font-family", "monospace")
                            .attr("fill", "#1e293b")
                            .attr("font-weight", "500")
                            .text(displayValue)

                        // Add type indicator
                        memvalGroup
                            .append("text")
                            .attr("x", itemWidth - 8)
                            .attr("y", 15)
                            .attr("text-anchor", "end")
                            .attr("font-size", "10px")
                            .attr("font-family", "monospace")
                            .attr("fill", "#64748b")
                            .attr("font-style", "italic")
                            .text(typeText)
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
                            .attr("cursor", "grab")
                            .call(scopeDrag as d3.DragBehavior<SVGGElement, unknown, unknown>)

                        // Store scope data for dragging
                        nodeData.set(scopeNode.id, {
                            id: scopeNode.id,
                            type: "scope",
                            width: scopeNode.width || 200,
                            height: actualScopeHeight,
                            variables: scopeNode.children?.map(child => child.id) || [],
                            sectionOffset: scopeSection.x || 0,
                        })

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
                            const varX = (scopeSection.x || 0) + singleColumnX + 195
                            const varY = (scopeSection.y || 0) + singleColumnY + 40 + varIndex * 35 + 10
                            nodePositions.set(varNodeId, { x: varX, y: varY })

                            // Add a small circle at the connection point for variables (only for reference types)
                            if (varData.type === "reference") {
                                variableGroup
                                    .append("circle")
                                    .attr("cx", 184)
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
                            .attr("cursor", "grab")
                            .call(heapObjectDrag as d3.DragBehavior<SVGGElement, unknown, unknown>)

                        // Store object data for dragging
                        nodeData.set(objNodeId, {
                            id: objNodeId,
                            type: "heap-object",
                            width: objNode?.width || objectWidth,
                            height: objNode?.height || objectHeight,
                            properties: objData.properties
                                .filter(prop => prop.target)
                                .map(prop => `${objNodeId}_${prop.name}`),
                            sectionOffset: heapSection.x || 0,
                        })

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

    return (
        <div className="relative w-full h-full">
            <svg ref={svgRef} className="w-full h-full" />
            {/* <div className="absolute bottom-1 left-0 font-mono text-gray-600">
                MEMVAL: {JSON.stringify(currentStep?.memorySnapshot?.memval.map(val => val.type === "reference" ? `ref: ${val.ref}` : String(val.value)))}
            </div> */}
        </div >
    )
}

export default MemoryModelVisualizer 