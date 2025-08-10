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



    useEffect(() => {
        if (!currentStep) return
        if (!svgRef.current) return
        if (!containerSize.width || !containerSize.height) return
        console.log("containerSize", containerSize)

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
                const memvalItems = currentStep?.memorySnapshot.memval || []



                renderMemvalSection({
                    memvalSection,
                    memvalItems,
                    rootContainer,
                    memoryModelData,
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
                    updateConnections()
                })


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
