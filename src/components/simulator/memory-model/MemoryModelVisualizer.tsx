import { useEffect, useRef } from "react"
import * as d3 from "d3"
import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkNode as ElkLayoutNode, ElkEdge as ElkLayoutEdge } from "elkjs/lib/elk-api"
import { Scope, Heap, JSValue } from "@/types/simulation"
import { ZoomInIcon, ZoomOutIcon, HomeIcon } from "lucide-react"

type MemoryModelVisualizerProps = {
    snapshot: {
        scopes: Scope[]
        heap: Heap
    }
}

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

const MemoryModelVisualizer = ({ snapshot }: MemoryModelVisualizerProps) => {
    const svgRef = useRef<SVGSVGElement>(null)
    const zoomGroupRef = useRef<SVGGElement | null>(null)

    // Transform snapshot data into visualization format
    const transformData = () => {
        const scopesData: ScopeData[] = []
        const heapData: HeapObjectData[] = []

        // Categorize scopes with meaningful names and colors
        snapshot.scopes.forEach((scope, index) => {
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
            const variables = Object.entries(scope.variables).map(([name, value]) => {
                const varId = `var-${scopeId}-${name}`
                let varType = "primitive"
                let target = undefined

                // Check if it's a reference to a heap object
                if (value.type === "reference") {
                    varType = "reference"
                    target = `obj-${value.ref}`
                }

                // Format the value for display
                let displayValue: string
                if (value.type === "primitive") {
                    if (value.value === undefined) {
                        displayValue = "undefined"
                    } else if (value.value === null) {
                        displayValue = "null"
                    } else if (value.value === "not_initialized") {
                        displayValue = "<TDZ>"
                    } else {
                        displayValue = String(value.value)
                    }
                } else {
                    displayValue = `[Reference: ${value.ref}]`
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
        Object.entries(snapshot.heap).forEach(([ref, obj]) => {
            const objId = `obj-${ref}`
            let objType = "OBJECT"
            let objColor = "#fefcbf"
            let objBorderColor = "#ecc94b"

            if (obj.type === "array") {
                objType = "ARRAY"
                objColor = "#c6f6d5"
                objBorderColor = "#68d391"
            } else if (obj.type === "function") {
                objType = "FUNCTION"
                objColor = "#bee3f8"
                objBorderColor = "#63b3ed"
            }

            const properties: { name: string; value: string; target?: string }[] = []

            if (obj.type === "object") {
                // Process object properties
                Object.entries(obj.properties).forEach(([propName, propValue]) => {
                    const property = formatPropertyValue(propName, propValue)
                    properties.push(property)
                })
            } else if (obj.type === "array") {
                // Process array elements
                obj.elements.forEach((element, index) => {
                    const property = formatPropertyValue(String(index), element)
                    properties.push(property)
                })
                // Add length property
                properties.push({
                    name: "length",
                    value: String(obj.elements.length)
                })
            } else if (obj.type === "function") {
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
        if (!svgRef.current) return

        // Clear any existing SVG content
        d3.select(svgRef.current).selectAll("*").remove()

        // Transform the data into visualization format
        const memoryModelData = transformData()

        // Set up dimensions
        const width = 1000
        const height = 700
        const margin = { top: 40, right: 20, bottom: 20, left: 20 }
        const contentWidth = width - margin.left - margin.right
        const contentHeight = height - margin.top - margin.bottom
        const dividerX = contentWidth * 0.4

        // Define common dimensions
        const scopeWidth = 300
        const scopeHeight = 120
        const variableHeight = 30
        const objectWidth = 180
        const objectHeight = 120

        // Create SVG
        const svg = d3
            .select(svgRef.current)
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("style", "max-width: 100%; height: auto;")

        // Create a group for zooming
        const zoomGroup = svg.append("g")
        zoomGroupRef.current = zoomGroup.node()

        // Define zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 3])
            .on("zoom", (event) => {
                zoomGroup.attr("transform", event.transform)
            })

        // Initialize zoom
        svg.call(zoom)

        // Add zoom controls
        const zoomControlsGroup = svg.append("g")
            .attr("transform", `translate(${width - 100}, ${margin.top})`)
            .attr("class", "zoom-controls")

        // Zoom in button
        const zoomInButton = zoomControlsGroup.append("g")
            .attr("transform", "translate(0, 0)")
            .attr("class", "zoom-button")
            .style("cursor", "pointer")
            .on("click", () => {
                svg.transition().duration(300).call(zoom.scaleBy, 1.3)
            })

        zoomInButton.append("rect")
            .attr("width", 30)
            .attr("height", 30)
            .attr("rx", 5)
            .attr("fill", "#e2e8f0")

        zoomInButton.append("text")
            .attr("x", 15)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "20px")
            .text("+")

        // Zoom out button
        const zoomOutButton = zoomControlsGroup.append("g")
            .attr("transform", "translate(0, 35)")
            .attr("class", "zoom-button")
            .style("cursor", "pointer")
            .on("click", () => {
                svg.transition().duration(300).call(zoom.scaleBy, 0.7)
            })

        zoomOutButton.append("rect")
            .attr("width", 30)
            .attr("height", 30)
            .attr("rx", 5)
            .attr("fill", "#e2e8f0")

        zoomOutButton.append("text")
            .attr("x", 15)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "20px")
            .text("−")

        // Reset zoom button
        const resetButton = zoomControlsGroup.append("g")
            .attr("transform", "translate(0, 70)")
            .attr("class", "zoom-button")
            .style("cursor", "pointer")
            .on("click", () => {
                svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity)
            })

        resetButton.append("rect")
            .attr("width", 30)
            .attr("height", 30)
            .attr("rx", 5)
            .attr("fill", "#e2e8f0")

        resetButton.append("text")
            .attr("x", 15)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .text("⌂")

        // Add title for scopes section
        zoomGroup.append("text")
            .attr("x", margin.left + contentWidth * 0.25)
            .attr("y", margin.top - 20)
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .text("Scopes")

        // Add title for heap section
        zoomGroup.append("text")
            .attr("x", margin.left + contentWidth * 0.75)
            .attr("y", margin.top - 20)
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .text("Memory Heap")

        // Create a container for the graph
        const graphContainer = zoomGroup.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`)

        // Add background rectangles for scope and heap areas
        graphContainer
            .append("rect")
            .attr("class", "scope-area")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", dividerX)
            .attr("height", contentHeight)
            .attr("fill", "#f7fafc")
            .attr("opacity", 0.5)

        graphContainer
            .append("rect")
            .attr("class", "heap-area")
            .attr("x", dividerX)
            .attr("y", 0)
            .attr("width", contentWidth - dividerX)
            .attr("height", contentHeight)
            .attr("fill", "#f7fafc")
            .attr("opacity", 0.5)

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

            // Create a section for scopes with fixed position - changed direction to DOWN
            const scopeSection: ElkNode = {
                id: "scopeSection",
                layoutOptions: {
                    "elk.algorithm": "layered",
                    "elk.direction": "DOWN",
                    "elk.partitioning.activate": "true",
                    "elk.padding": "[top=20, left=20, bottom=20, right=20]",
                    "elk.spacing.nodeNode": "40",
                    "elk.layered.spacing.baseValue": "30",
                    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
                    "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
                    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
                },
                width: dividerX,
                height: contentHeight,
                x: 0,
                y: 0,
                children: [],
            }

            // Create a section for heap with fixed position
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
                width: contentWidth - dividerX,
                height: contentHeight,
                x: dividerX,
                y: 0,
                children: [],
            }

            // Add scope nodes
            memoryModelData.scopes.forEach((scope) => {
                const scopeNode: ElkNode = {
                    id: scope.id,
                    width: scopeWidth,
                    height: Math.max(scopeHeight, 40 + scope.variables.length * (variableHeight + 5)),
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
                        width: scopeWidth - 20,
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

            // Determine if we're crossing the divider
            const crossingDivider =
                (source.x < dividerX && target.x >= dividerX) || (source.x >= dividerX && target.x < dividerX)

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
                // Disable zoom during drag
                svg.on(".zoom", null)
            })
            .on("drag", function (event) {
                const scopeId = d3.select(this).attr("data-id")
                const scopeData = nodeData.get(scopeId)
                if (!scopeData) return

                let newX = event.x
                let newY = event.y

                // Confine dragging to the scope area
                newX = Math.max(0, Math.min(dividerX - scopeData.width, newX))
                newY = Math.max(0, Math.min(contentHeight - scopeData.height, newY))

                d3.select(this).attr("transform", `translate(${newX},${newY})`)

                // Update node positions
                nodePositions.set(scopeId, { x: newX + scopeData.width / 2, y: newY + scopeData.height / 2 })

                // Update variable positions
                scopeData.variables.forEach((varId: string, index: number) => {
                    const varX = newX + scopeWidth - 5 // Position at the right edge of the variable
                    const varY = newY + 40 + index * 35 + 10 // Center of the variable
                    nodePositions.set(varId, { x: varX, y: varY })
                })

                updateConnections()
            })
            .on("end", function () {
                d3.select(this).classed("active", false)
                // Re-enable zoom after drag
                svg.call(zoom)
            })

        // Define drag behavior for heap objects
        const heapObjectDrag = d3
            .drag<SVGGElement, unknown>()
            .on("start", function () {
                d3.select(this).raise().classed("active", true)
                // Disable zoom during drag
                svg.on(".zoom", null)
            })
            .on("drag", function (event) {
                const objId = d3.select(this).attr("data-id")
                const objData = nodeData.get(objId)
                if (!objData) return

                let newX = event.x
                let newY = event.y

                // Confine dragging to the heap area
                newX = Math.max(dividerX, Math.min(contentWidth - objData.width, newX))
                newY = Math.max(0, Math.min(contentHeight - objData.height, newY))

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
                // Re-enable zoom after drag
                svg.call(zoom)
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
                // Draw a divider between scopes and heap
                graphContainer
                    .append("line")
                    .attr("x1", dividerX)
                    .attr("y1", 0)
                    .attr("x2", dividerX)
                    .attr("y2", contentHeight)
                    .attr("stroke", "#e2e8f0")
                    .attr("stroke-width", 2)
                    .attr("stroke-dasharray", "4")

                // Get scope and heap sections from layouted graph
                const scopeSection = layoutedGraph.children?.find(section => section.id === "scopeSection")
                const heapSection = layoutedGraph.children?.find(section => section.id === "heapSection")

                if (!scopeSection || !heapSection) return

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

                // Draw scopes
                scopeSection.children?.forEach((scopeNode: ElkNode) => {
                    // Find the original scope data
                    const scopeData = memoryModelData.scopes.find(s => s.id === scopeNode.id)
                    if (!scopeData || !scopeNode.x || !scopeNode.y) return

                    const scopeGroup = graphContainer
                        .append("g")
                        .attr("class", "scope")
                        .attr("data-id", scopeNode.id)
                        .attr("transform", `translate(${scopeNode.x}, ${scopeNode.y})`)
                        .attr("cursor", "grab")
                        .call(scopeDrag as d3.DragBehavior<SVGGElement, unknown, unknown>)

                    // Store scope data for dragging
                    nodeData.set(scopeNode.id, {
                        id: scopeNode.id,
                        type: "scope",
                        width: scopeNode.width || scopeWidth,
                        height: scopeNode.height || scopeHeight,
                        variables: scopeNode.children?.map(child => child.id) || [],
                    })

                    // Draw scope rectangle
                    scopeGroup
                        .append("rect")
                        .attr("width", scopeNode.width || scopeWidth)
                        .attr("height", scopeNode.height || scopeHeight)
                        .attr("rx", 10)
                        .attr("ry", 10)
                        .attr("fill", scopeData.color)
                        .attr("stroke", scopeData.borderColor)
                        .attr("stroke-width", 2)

                    // Add scope name
                    scopeGroup.append("text").attr("x", 10).attr("y", 20).attr("font-weight", "bold").text(scopeData.name)

                    // Draw variables
                    scopeNode.children?.forEach((varNode: ElkNode, varIndex: number) => {
                        if (!varNode.x || !varNode.y) return

                        const varData = scopeData.variables.find(v => v.id === varNode.id)
                        if (!varData) return

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
                        if (scopeNode.x !== undefined && scopeNode.y !== undefined) {
                            const varX = scopeNode.x + scopeWidth - 5
                            const varY = scopeNode.y + 40 + varIndex * 35 + 10
                            nodePositions.set(varNode.id, { x: varX, y: varY })
                        } else {
                            console.warn(`Scope node position is undefined for scope ${scopeNode.id}, var ${varNode.id}`)
                        }

                        // Add a small circle at the connection point for variables
                        variableGroup
                            .append("circle")
                            .attr("cx", scopeWidth - 16)
                            .attr("cy", 10)
                            .attr("r", 3)
                            .attr("fill", "#4299e1")
                            .attr("stroke", "none")

                        // Add edge data if it's a reference
                        if (varData.type === "reference" && varData.target) {
                            edgeData.push({
                                source: varNode.id,
                                target: varData.target,
                                type: "var-ref",
                                label: varData.name,
                            })
                        }
                    })
                })

                // Draw heap objects
                heapSection.children?.forEach((objNode: ElkNode) => {
                    const objData = memoryModelData.heap.find(o => o.id === objNode.id)
                    if (!objData || !objNode.x || !objNode.y) return

                    // Adjust x position to be in the heap section
                    const objX = objNode.x + dividerX

                    const objectGroup = graphContainer
                        .append("g")
                        .attr("class", "heap-object")
                        .attr("data-id", objNode.id)
                        .attr("transform", `translate(${objX}, ${objNode.y})`)
                        .attr("cursor", "grab")
                        .call(heapObjectDrag as d3.DragBehavior<SVGGElement, unknown, unknown>)

                    // Store object data for dragging
                    nodeData.set(objNode.id, {
                        id: objNode.id,
                        type: "heap-object",
                        width: objNode.width || objectWidth,
                        height: objNode.height || objectHeight,
                        properties: objData.properties
                            .filter(prop => prop.target)
                            .map(prop => `${objNode.id}_${prop.name}`),
                    })

                    // Store object position for connections - use left edge for incoming connections
                    nodePositions.set(objNode.id, { x: objX, y: objNode.y + (objNode.height || objectHeight) / 2 })

                    // Draw object rectangle
                    objectGroup
                        .append("rect")
                        .attr("width", objNode.width || objectWidth)
                        .attr("height", objNode.height || objectHeight)
                        .attr("rx", 5)
                        .attr("ry", 5)
                        .attr("fill", objData.color)
                        .attr("stroke", objData.borderColor)
                        .attr("stroke-width", 2)

                    // Add object type header
                    objectGroup
                        .append("rect")
                        .attr("width", objNode.width || objectWidth)
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
                                .attr("data-property-id", `${objNode.id}_${prop.name}`)

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
                                if (objNode.x !== undefined && objNode.y !== undefined) {
                                    const propX = objX + (objNode.width || objectWidth) - 10
                                    const propY = objNode.y + 45 + i * 20
                                    const propId = `${objNode.id}_${prop.name}`
                                    propertyPositions.set(propId, { x: propX, y: propY })
                                } else {
                                    console.warn(`Object node position is undefined for object ${objNode.id}, property ${prop.name}`)
                                }

                                // Add edge data for property references
                                const propId = `${objNode.id}_${prop.name}`
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
                                    .attr("cx", (objNode.width || objectWidth) - 10)
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

                // Initial draw of connections
                updateConnections()
            })
            .catch((error) => {
                console.error("ELK layout error:", error)
            })
    }, [snapshot])

    return (
        <>
            <svg ref={svgRef} className="w-full"></svg>
            <div className="mt-4 text-sm text-gray-600">
                <p>
                    Drag scopes and objects to rearrange them. Scopes are restricted to the left area, and heap objects to the
                    right area. Hover over connections to highlight relationships.
                </p>
            </div>
        </>
    )
}

export default MemoryModelVisualizer 