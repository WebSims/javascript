import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkNode as ElkLayoutNode, ElkEdge as ElkLayoutEdge } from "elkjs/lib/elk-api"
import { JSValue } from "@/types/simulation"
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
    ports?: { id: string; width: number; height: number; layoutOptions?: Record<string, string> }[]
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
    const { currentExecStep } = useSimulatorStore()
    const svgRef = useRef<SVGSVGElement>(null)
    const zoomGroupRef = useRef<SVGGElement | null>(null)
    // Add state for dynamic dimensions to ensure re-renders use them
    const [svgDimensions, setSvgDimensions] = useState({ width: 1000, height: 700, viewBox: "0 0 1000 700" })

    // Transform snapshot data into visualization format
    const transformData = () => {
        const scopesData: ScopeData[] = []
        const heapData: HeapObjectData[] = []

        // Categorize scopes with meaningful names and colors
        currentExecStep?.memorySnapshot.scopes.forEach((scope, index) => {
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
                let portSide = "EAST" // Default port side for variables

                // Check if it's a reference to a heap object
                if (value.type === "reference") {
                    varType = "reference"
                    target = `obj-${value.ref}`
                    portSide = "EAST" // Variables point right (East)
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
                    displayValue = `[Ref: ${value.ref}]` // Shortened reference display
                }

                return {
                    id: varId,
                    name,
                    type: varType,
                    target,
                    value: displayValue,
                    portSide
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
        Object.entries(currentExecStep?.memorySnapshot.heap ?? {}).forEach(([ref, obj]) => {
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

            const properties: { name: string; value: string; target?: string; portSide?: string }[] = []

            if (obj.type === "object") {
                // Process object properties
                Object.entries(obj.properties).forEach(([propName, propValue]) => {
                    const property = formatPropertyValue(propName, propValue)
                    properties.push({ ...property, portSide: property.target ? "EAST" : undefined }) // Properties point East if they reference
                })
            } else if (obj.type === "array") {
                // Process array elements
                obj.elements.forEach((element, index) => {
                    const property = formatPropertyValue(String(index), element)
                    properties.push({ ...property, portSide: property.target ? "EAST" : undefined }) // Elements point East if they reference
                })
                // Add length property (no port needed)
                properties.push({
                    name: "length",
                    value: String(obj.elements.length)
                })
            } else if (obj.type === "function") {
                // Display function node information (no properties point out)
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
                value: `[Ref: ${propValue.ref}]`, // Shortened display
                target: `obj-${propValue.ref}`
            }
        }
    }

    useEffect(() => {
        if (!currentExecStep || !svgRef.current) {
            // Clear SVG if no step
            d3.select(svgRef.current).selectAll("*").remove()
            setSvgDimensions({ width: 300, height: 100, viewBox: "0 0 300 100" }) // Minimal size when empty
            // Optionally display a message
            d3.select(svgRef.current).append("text")
                .attr("x", 150).attr("y", 50).attr("text-anchor", "middle")
                .text("No execution step selected.")
            return
        }

        // Clear previous SVG content
        const svg = d3.select(svgRef.current)
        svg.selectAll("*").remove()

        const memoryModelData = transformData()

        // --- Element Dimensions ---
        const scopeWidth = 280 // Adjusted width
        const variableHeight = 25
        const scopeHeaderHeight = 30
        const scopePadding = 10
        const scopeVariableSpacing = 5

        const objectWidth = 200 // Adjusted width
        const propertyHeight = 20
        const objectHeaderHeight = 25
        const objectPadding = 10
        const objectPropertySpacing = 4

        const margin = { top: 30, right: 30, bottom: 30, left: 30 }

        // --- Create ELK Graph ---
        const createElkGraph = (): ElkGraph => {
            const graph: ElkGraph = {
                id: "root",
                layoutOptions: {
                    "elk.algorithm": "layered",
                    "elk.direction": "RIGHT",
                    "elk.spacing.nodeNode": "70", // Increased spacing between nodes
                    "elk.layered.spacing.nodeNodeBetweenLayers": "80", // Increased spacing between layers
                    "elk.padding": `[top=${margin.top}, left=${margin.left}, bottom=${margin.bottom}, right=${margin.right}]`,
                    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX", // Or BRANDES_KOEPF
                    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
                    "elk.separateConnectedComponents": "false", // Keep components together if possible
                    "elk.edgeRouting": "SPLINES", // Use splines for smoother edges
                    //"elk.layered.cycleBreaking.strategy": "GREEDY", // Helps with complex graphs
                },
                children: [], // Will contain scopes and heap objects directly
                edges: [],
            }

            // Add scope nodes directly to root children
            memoryModelData.scopes.forEach((scope) => {
                const scopeNodeHeight = scopeHeaderHeight + scope.variables.length * (variableHeight + scopeVariableSpacing) + 2 * scopePadding
                const scopeNode: ElkNode = {
                    id: scope.id,
                    width: scopeWidth,
                    height: scopeNodeHeight,
                    layoutOptions: {
                        "elk.padding": `[top=${scopePadding}, left=${scopePadding}, bottom=${scopePadding}, right=${scopePadding}]`,
                        "elk.portConstraints": "FIXED_SIDE", // Ensure ports are on specified sides
                    },
                    labels: [{ text: scope.name }], // Keep label simple
                    ports: [], // Add ports for variables
                }

                // Add ports for each variable on the EAST side
                scope.variables.forEach((variable, index) => {
                    if (variable.type === "reference") {
                        scopeNode.ports?.push({
                            id: `${variable.id}-port`,
                            width: 0,
                            height: 0,
                            layoutOptions: {
                                "elk.port.side": "EAST",
                                "elk.port.index": String(index), // Maintain order
                            },
                        })
                    }
                })

                graph.children?.push(scopeNode)
            })

            console.log(graph)
            // Add heap object nodes directly to root children
            memoryModelData.heap.forEach((object) => {
                const numProperties = object.properties ? object.properties.length : 0
                const objNodeHeight = objectHeaderHeight + numProperties * (propertyHeight + objectPropertySpacing) + 2 * objectPadding
                const objNode: ElkNode = {
                    id: object.id,
                    width: objectWidth,
                    height: objNodeHeight,
                    layoutOptions: {
                        "elk.padding": `[top=${objectPadding}, left=${objectPadding}, bottom=${objectPadding}, right=${objectPadding}]`,
                        "elk.portConstraints": "FIXED_SIDE",
                    },
                    labels: [{ text: object.type }],
                    ports: [], // Add ports for incoming (WEST) and outgoing (EAST) references
                }

                // Add WEST port for incoming references (target)
                objNode.ports?.push({
                    id: `${object.id}-target-port`,
                    width: 0,
                    height: 0,
                    layoutOptions: { "elk.port.side": "WEST" },
                })

                // Add EAST ports for outgoing property references (source)
                object.properties?.forEach((prop, index) => {
                    if (prop.target) {
                        objNode.ports?.push({
                            id: `${object.id}_${prop.name}-source-port`,
                            width: 0,
                            height: 0,
                            layoutOptions: {
                                "elk.port.side": "EAST",
                                "elk.port.index": String(index),
                            },
                        })
                    }
                })


                graph.children?.push(objNode)
            })

            // Add edges using ports
            memoryModelData.scopes.forEach((scope) => {
                scope.variables.forEach((variable) => {
                    if (variable.type === "reference" && variable.target) {
                        graph.edges.push({
                            id: `${variable.id}_to_${variable.target}`,
                            sources: [`${variable.id}-port`], // Source is the variable's port on the scope
                            targets: [`${variable.target}-target-port`], // Target is the object's main target port
                        })
                    }
                })
            })

            // Add edges between heap objects using ports
            memoryModelData.heap.forEach((object) => {
                if (object.properties) {
                    object.properties.forEach((prop) => {
                        if (prop.target) {
                            graph.edges.push({
                                id: `${object.id}_${prop.name}_to_${prop.target}`,
                                sources: [`${object.id}_${prop.name}-source-port`], // Source is property's port on object
                                targets: [`${prop.target}-target-port`], // Target is the other object's target port
                            })
                        }
                    })
                }
            })

            return graph
        }

        const elkGraph = createElkGraph()
        const elk = new ELK()

        // Create maps to store node positions and data (will be populated after layout)
        const nodePositions = new Map<string, { x: number; y: number }>()
        const nodeDimensions = new Map<string, { width: number; height: number }>()
        const portPositions = new Map<string, { x: number; y: number }>() // Store port absolute positions
        const nodeData = new Map<string, any>() // Store original data if needed
        const edgeData: Array<{
            id: string
            sourceNodeId: string // ID of the source node (scope or object)
            targetNodeId: string // ID of the target node (object)
            sourcePortId: string // ID of the source port
            targetPortId: string // ID of the target port
            type: "var-ref" | "prop-ref"
        }> = []

        // Function to calculate edge path using port positions
        const calculatePathFromPorts = (
            sourcePortPos: { x: number; y: number },
            targetPortPos: { x: number; y: number }
        ): string => {
            const path = d3.path()
            path.moveTo(sourcePortPos.x, sourcePortPos.y)

            // Calculate control points for a bezier curve
            const dx = targetPortPos.x - sourcePortPos.x
            const dy = targetPortPos.y - sourcePortPos.y

            // Simple horizontal curve for RIGHT direction layout
            const cp1x = sourcePortPos.x + dx * 0.4
            const cp1y = sourcePortPos.y
            const cp2x = sourcePortPos.x + dx * 0.6
            const cp2y = targetPortPos.y

            path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, targetPortPos.x, targetPortPos.y)
            return path.toString()
        }


        // Define drag behavior (no constraints initially)
        const nodeDrag = d3
            .drag<SVGGElement, ElkNode>() // Datum is the ElkNode from layout
            .on("start", function () {
                d3.select(this).raise().classed("active", true).attr("cursor", "grabbing")
                svg.on(".zoom", null) // Disable zoom during drag
            })
            .on("drag", function (event, d) {
                const transform = d3.zoomTransform(svg.node()!)
                const currentX = d.x! + event.dx / transform.k
                const currentY = d.y! + event.dy / transform.k

                // Update the node's position in the layout data (optional, ELK recalculates anyway)
                d.x = currentX
                d.y = currentY

                // Update visual position
                d3.select(this).attr("transform", `translate(${currentX}, ${currentY})`)

                // Update positions map (center for node, specific for ports)
                nodePositions.set(d.id, { x: currentX + (d.width ?? 0) / 2, y: currentY + (d.height ?? 0) / 2 })
                d.ports?.forEach(port => {
                    portPositions.set(port.id, { x: currentX + (port.x ?? 0), y: currentY + (port.y ?? 0) })
                })

                updateConnections() // Update connections during drag
            })
            .on("end", function () {
                d3.select(this).classed("active", false).attr("cursor", "grab")
                svg.call(zoom) // Re-enable zoom
                // Note: Without re-running layout, drag is purely visual.
                // Re-running layout on drag end can be complex.
            })

        // Function to update connections based on port positions
        const updateConnections = () => {
            const graphContainer = d3.select("#graph-content-container") // Select the container
            graphContainer.selectAll(".connection").remove() // Clear existing paths

            edgeData.forEach((edge) => {
                const sourcePortPos = portPositions.get(edge.sourcePortId)
                const targetPortPos = portPositions.get(edge.targetPortId)

                if (!sourcePortPos || !targetPortPos) {
                    console.warn(`Missing port position for edge: ${edge.id}`, { sourcePortPos, targetPortPos })
                    return
                }

                const pathType = edge.type === "var-ref" ? "var-ref" : "prop-ref"
                const arrowType = edge.type === "var-ref" ? "arrow-var-ref" : "arrow-prop-ref"
                const strokeColor = edge.type === "var-ref" ? "#4299e1" : "#ed8936"

                graphContainer
                    .append("path")
                    .attr("class", `connection connection-${pathType}`)
                    .attr("id", edge.id)
                    .attr("d", calculatePathFromPorts(sourcePortPos, targetPortPos))
                    .attr("stroke", strokeColor)
                    .attr("stroke-width", 1.5)
                    .attr("fill", "none")
                    .attr("marker-end", `url(#${arrowType})`)
                    .on("mouseover", function () {
                        d3.select(this).attr("stroke", "#e53e3e").attr("stroke-width", 2.5).attr("marker-end", "url(#arrow-highlight)")
                    })
                    .on("mouseout", function () {
                        d3.select(this)
                            .attr("stroke", strokeColor)
                            .attr("stroke-width", 1.5)
                            .attr("marker-end", `url(#${arrowType})`)
                    })
            })
        }

        // Define zoom behavior (needs access to calculated dimensions, defined inside .then)
        let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>

        // --- Run Layout and Render ---
        elk
            .layout(elkGraph)
            .then((layoutedGraph) => {
                // --- Calculate Bounding Box and Dimensions ---
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                layoutedGraph.children?.forEach(node => {
                    if (node.x !== undefined && node.y !== undefined && node.width !== undefined && node.height !== undefined) {
                        minX = Math.min(minX, node.x);
                        minY = Math.min(minY, node.y);
                        maxX = Math.max(maxX, node.x + node.width);
                        maxY = Math.max(maxY, node.y + node.height);

                        // Store node positions and dimensions
                        nodePositions.set(node.id, { x: node.x + node.width / 2, y: node.y + node.height / 2 })
                        nodeDimensions.set(node.id, { width: node.width, height: node.height })
                        nodeData.set(node.id, memoryModelData.scopes.find(s => s.id === node.id) || memoryModelData.heap.find(h => h.id === node.id))

                        // Store absolute port positions
                        node.ports?.forEach(port => {
                            if (port.x !== undefined && port.y !== undefined) {
                                portPositions.set(port.id, { x: node.x! + port.x, y: node.y! + port.y })
                            }
                        })
                    }
                })

                // Populate edgeData for connection drawing
                layoutedGraph.edges?.forEach(edge => {
                    const sourceNodeId = memoryModelData.scopes.find(s => s.variables.some(v => `${v.id}-port` === edge.sources[0]))?.id ||
                        memoryModelData.heap.find(h => h.properties?.some(p => `${h.id}_${p.name}-source-port` === edge.sources[0]))?.id
                    const targetNodeId = layoutedGraph.children?.find(n => n.ports?.some(p => p.id === edge.targets[0]))?.id

                    if (sourceNodeId && targetNodeId) {
                        const isVarRef = edge.sources[0].startsWith('var-')
                        edgeData.push({
                            id: edge.id,
                            sourceNodeId: sourceNodeId,
                            targetNodeId: targetNodeId,
                            sourcePortId: edge.sources[0],
                            targetPortId: edge.targets[0],
                            type: isVarRef ? "var-ref" : "prop-ref",
                        })
                    }
                })

                // Handle case with no nodes
                if (minX === Infinity) {
                    minX = 0; minY = 0; maxX = 600; maxY = 400; // Default fallback size
                }

                const contentWidth = maxX - minX;
                const contentHeight = maxY - minY;

                const finalWidth = contentWidth + margin.left + margin.right;
                const finalHeight = contentHeight + margin.top + margin.bottom;

                // Adjust viewBox to focus on the content area including margins, starting from 0,0
                const viewBox = `${minX - margin.left} ${minY - margin.top} ${finalWidth} ${finalHeight}`

                // Update state to trigger re-render with correct dimensions
                setSvgDimensions({ width: finalWidth, height: finalHeight, viewBox: viewBox })

                // --- Setup SVG and Zoom --- (Now that dimensions are known)
                svg
                    .attr("width", finalWidth)
                    .attr("height", finalHeight)
                    .attr("viewBox", viewBox)
                    .attr("style", "max-width: 100%; height: auto; border: 1px solid #eee;"); // Add border for visibility

                // Add definitions for markers
                const defs = svg.append("defs");
                // Variable reference arrow (blue)
                defs.append("marker")
                    .attr("id", "arrow-var-ref")
                    .attr("viewBox", "0 -5 10 10").attr("refX", 8).attr("refY", 0)
                    .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
                    .append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", "#4299e1");
                // Object property reference arrow (orange)
                defs.append("marker")
                    .attr("id", "arrow-prop-ref")
                    .attr("viewBox", "0 -5 10 10").attr("refX", 8).attr("refY", 0)
                    .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
                    .append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", "#ed8936");
                // Highlighted arrow (red)
                defs.append("marker")
                    .attr("id", "arrow-highlight")
                    .attr("viewBox", "0 -5 10 10").attr("refX", 8).attr("refY", 0)
                    .attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto")
                    .append("path").attr("d", "M0,-4.5L9,0L0,4.5").attr("fill", "#e53e3e");


                // Create the main group for zooming and panning
                const zoomGroup = svg.append("g").attr("id", "zoom-group");
                zoomGroupRef.current = zoomGroup.node();

                // Create container for graph elements *inside* the zoom group
                const graphContainer = zoomGroup.append("g").attr("id", "graph-content-container");

                // Define zoom behavior
                zoom = d3.zoom<SVGSVGElement, unknown>()
                    .scaleExtent([0.1, 4]) // Adjusted scale extent
                    .on("zoom", (event) => {
                        zoomGroup.attr("transform", event.transform);
                    });

                // Apply initial zoom/pan to center the content
                const initialScale = Math.min(1, (finalWidth - margin.left - margin.right) / contentWidth, (finalHeight - margin.top - margin.bottom) / contentHeight);
                const initialTranslateX = (finalWidth - contentWidth * initialScale) / 2 - (minX * initialScale);
                const initialTranslateY = (finalHeight - contentHeight * initialScale) / 2 - (minY * initialScale);
                const initialTransform = d3.zoomIdentity.translate(initialTranslateX, initialTranslateY).scale(initialScale);

                svg.call(zoom).call(zoom.transform, initialTransform); // Apply initial transform


                // --- Draw Nodes ---
                layoutedGraph.children?.forEach((node: ElkNode) => {
                    if (node.x === undefined || node.y === undefined) return;
                    const nodeInfo = nodeData.get(node.id)
                    const isScope = node.id.startsWith('scope-')

                    const nodeGroup = graphContainer
                        .append("g")
                        .datum(node) // Attach layout node data for dragging
                        .attr("class", `node ${isScope ? 'scope' : 'heap-object'} draggable`)
                        .attr("id", node.id)
                        .attr("transform", `translate(${node.x}, ${node.y})`)
                        .attr("cursor", "grab")
                        .call(nodeDrag)

                    // Draw rectangle
                    nodeGroup.append("rect")
                        .attr("width", node.width!)
                        .attr("height", node.height!)
                        .attr("rx", isScope ? 10 : 5)
                        .attr("ry", isScope ? 10 : 5)
                        .attr("fill", nodeInfo.color)
                        .attr("stroke", nodeInfo.borderColor)
                        .attr("stroke-width", 1.5)

                    // Draw Header
                    nodeGroup.append("rect")
                        .attr("width", node.width!)
                        .attr("height", isScope ? scopeHeaderHeight : objectHeaderHeight)
                        .attr("rx", isScope ? 10 : 5)
                        .attr("ry", isScope ? 10 : 5)
                        .attr("fill", nodeInfo.borderColor)
                        .style("pointer-events", "none") // Prevent header from blocking drag

                    nodeGroup.append("text")
                        .attr("class", "node-label")
                        .attr("x", isScope ? scopePadding : objectPadding)
                        .attr("y", (isScope ? scopeHeaderHeight : objectHeaderHeight) / 2)
                        .attr("dy", "0.35em") // Vertical alignment
                        .attr("fill", "white")
                        .attr("font-weight", "bold")
                        .attr("font-size", "13px")
                        .text(nodeInfo.name || nodeInfo.type) // Use scope name or object type
                        .style("pointer-events", "none")

                    // Draw variables or properties
                    if (isScope) {
                        nodeInfo.variables.forEach((variable: any, i: number) => {
                            const varY = scopeHeaderHeight + i * (variableHeight + scopeVariableSpacing) + scopePadding / 2;
                            const varGroup = nodeGroup.append("g")
                                .attr("transform", `translate(${scopePadding}, ${varY})`)

                            varGroup.append("text")
                                .attr("x", 0).attr("y", variableHeight / 2).attr("dy", "0.35em")
                                .attr("font-size", "12px").text(`${variable.name}: ${variable.value}`)
                                .attr("fill", "#1f2937")
                        })
                    } else { // Heap Object
                        nodeInfo.properties?.forEach((prop: any, i: number) => {
                            const propY = objectHeaderHeight + i * (propertyHeight + objectPropertySpacing) + objectPadding / 2;
                            const propGroup = nodeGroup.append("g")
                                .attr("transform", `translate(${objectPadding}, ${propY})`)

                            propGroup.append("text")
                                .attr("x", 0).attr("y", propertyHeight / 2).attr("dy", "0.35em")
                                .attr("font-size", "12px").text(`${prop.name}: ${prop.value}`)
                                .attr("fill", "#1f2937")
                        })
                    }
                })

                // --- Draw Connections ---
                updateConnections() // Initial draw

                // --- Add Zoom Controls --- (Position relative to finalWidth)
                const zoomControlsGroup = svg.append("g")
                    .attr("transform", `translate(${finalWidth - 50}, ${margin.top - 10})`) // Position top right
                    .attr("class", "zoom-controls")

                const createZoomButton = (parent: d3.Selection<SVGGElement, unknown, null, undefined>, yOffset: number, text: string, clickHandler: () => void) => {
                    const button = parent.append("g")
                        .attr("transform", `translate(0, ${yOffset})`)
                        .attr("class", "zoom-button")
                        .style("cursor", "pointer")
                        .on("click", clickHandler)
                    button.append("rect")
                        .attr("width", 30).attr("height", 30).attr("rx", 5)
                        .attr("fill", "#e2e8f0").attr("stroke", "#cbd5e1")
                    button.append("text")
                        .attr("x", 15).attr("y", 15).attr("dy", "0.35em").attr("text-anchor", "middle")
                        .attr("font-size", text === "⌂" ? "16px" : "20px") // Adjust reset icon size
                        .text(text)
                        .style("pointer-events", "none") // Prevent text capturing click
                    return button
                }

                createZoomButton(zoomControlsGroup, 0, "+", () => svg.transition().duration(300).call(zoom.scaleBy, 1.3))
                createZoomButton(zoomControlsGroup, 35, "−", () => svg.transition().duration(300).call(zoom.scaleBy, 0.7))
                createZoomButton(zoomControlsGroup, 70, "⌂", () => svg.transition().duration(300).call(zoom.transform, initialTransform)) // Reset to calculated initial view


            })
            .catch((error) => {
                console.error("ELK layout error:", error)
                svg.append("text")
                    .attr("x", 10).attr("y", 30).text(`Layout Error: ${error.message}`)
                    .attr("fill", "red")
                // Set fallback dimensions on error
                setSvgDimensions({ width: 600, height: 400, viewBox: "0 0 600 400" })
            })

    }, [currentExecStep]) // Rerun effect when execution step changes

    return (
        <>
            {/* Use state for dimensions */}
            <svg ref={svgRef} width={svgDimensions.width} height={svgDimensions.height} viewBox={svgDimensions.viewBox} className="w-full"></svg>
            {/* Optional: Keep instructions or simplify */}
            <div className="mt-4 text-sm text-gray-600">
                <p>Drag nodes to rearrange them. Use controls or mouse wheel/trackpad to zoom and pan.</p>
            </div>
        </>
    )
}

export default MemoryModelVisualizer 