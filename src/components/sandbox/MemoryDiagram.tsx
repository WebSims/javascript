import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

type MemoryValue = {
    type: 'number' | 'string' | 'boolean' | 'object' | 'array' | 'function' | 'undefined' | 'null'
    value: unknown
    reference?: string
}

type MemoryState = {
    variables: Record<string, MemoryValue>
    objects: Record<string, Record<string, MemoryValue>>
    arrays: Record<string, MemoryValue[]>
    functions: Record<string, { params: string[], body: string }>
}

interface MemoryModelDiagramProps {
    memoryState: MemoryState
}

interface GraphNode {
    id: string
    type: string
    valueType?: string
    value?: string
    reference?: string
    properties?: number
    length?: number
    params?: string[]
    parent?: string
    x?: number
    y?: number
    fx?: number | null
    fy?: number | null
    width?: number
    height?: number
}

interface GraphLink {
    source: string | GraphNode
    target: string | GraphNode
    type: string
}

const MemoryModelDiagram: React.FC<MemoryModelDiagramProps> = ({ memoryState }) => {
    const svgRef = useRef<SVGSVGElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [zoomLevel, setZoomLevel] = useState(1)

    // Update visualization when window resizes
    useEffect(() => {
        const updateVisualization = () => {
            if (!svgRef.current || !containerRef.current) return

            // Update SVG dimensions
            const width = containerRef.current.clientWidth
            const height = containerRef.current.clientHeight

            d3.select(svgRef.current)
                .attr('width', width)
                .attr('height', height)

            // Re-center the diagram
            if (svgRef.current) {
                const svg = d3.select(svgRef.current)
                const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4])

                // Get nodes data
                const nodes = d3.selectAll('.node').data() as GraphNode[]
                if (nodes.length === 0) return

                // Calculate the bounding box
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
                nodes.forEach(node => {
                    if (!node.x || !node.y || !node.width || !node.height) return
                    minX = Math.min(minX, node.x)
                    minY = Math.min(minY, node.y)
                    maxX = Math.max(maxX, node.x + node.width)
                    maxY = Math.max(maxY, node.y + node.height)
                })

                // Calculate scale and translation
                const svgWidth = svgRef.current.clientWidth
                const svgHeight = svgRef.current.clientHeight

                const diagramWidth = maxX - minX
                const diagramHeight = maxY - minY

                const scaleX = svgWidth / (diagramWidth + 80)
                const scaleY = svgHeight / (diagramHeight + 80)
                const scale = Math.min(1, Math.min(scaleX, scaleY))

                const centerX = (svgWidth / 2) - ((minX + diagramWidth / 2) * scale)
                const centerY = (svgHeight / 2) - ((minY + diagramHeight / 2) * scale)

                const transform = d3.zoomIdentity.translate(centerX, centerY).scale(scale)
                svg.call(zoom.transform, transform)
            }
        }

        const resizeObserver = new ResizeObserver(() => {
            updateVisualization()
        })

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current)
        }

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    // Color scheme for different types
    const typeColors = {
        variable: '#ffffff', // white background for variables
        string: '#16a34a', // green-600
        number: '#3b82f6', // blue-500
        boolean: '#9333ea', // purple-500
        null: '#6b7280', // gray-500
        undefined: '#6b7280', // gray-500
        array: '#d9f99d', // light green for arrays
        object: '#fef3c7', // light yellow for objects
        function: '#bfdbfe', // light blue for functions
    }

    useEffect(() => {
        if (!svgRef.current || Object.keys(memoryState.variables).length === 0) return

        // Clear previous visualization
        d3.select(svgRef.current).selectAll('*').remove()

        const width = svgRef.current.clientWidth
        const height = svgRef.current.parentElement?.clientHeight || 600
        const nodeWidth = 200
        const nodeHeight = 40
        const columnGap = 300

        // Create the main SVG element
        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)

        // Add zoom behavior for the entire visualization
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                mainGroup.attr('transform', event.transform)
                setZoomLevel(event.transform.k)
            })

        // Apply zoom behavior to the SVG
        svg.call(zoom)

        // Add a main group that will be transformed during zoom/pan
        const mainGroup = svg.append('g')
            .attr('class', 'main-group')

        // Create data structure for D3
        const graphData = {
            nodes: [] as GraphNode[],
            links: [] as GraphLink[]
        }

        // Add variables as nodes
        Object.entries(memoryState.variables).forEach(([name, value], index) => {
            graphData.nodes.push({
                id: name,
                type: 'variable',
                valueType: value.type,
                value: String(value.value),
                reference: value.reference,
                x: 100,
                y: 50 + index * 70,
                width: nodeWidth,
                height: nodeHeight
            })

            // If variable references an object/array/function, add a link
            if (value.reference) {
                graphData.links.push({
                    source: name,
                    target: value.reference,
                    type: value.type
                })
            }
        })

        // Calculate starting positions for objects/arrays/functions
        const referenceTypes = ['object', 'array', 'function']
        const referenceTypeCount = referenceTypes.reduce((acc, type) => {
            acc[type] = 0
            return acc
        }, {} as Record<string, number>)

        // Add objects as nodes
        Object.entries(memoryState.objects).forEach(([id, props]) => {
            const typeIndex = referenceTypeCount.object++
            graphData.nodes.push({
                id,
                type: 'object',
                properties: Object.keys(props).length,
                x: 100 + columnGap,
                y: 50 + typeIndex * 200,
                width: nodeWidth,
                height: 40 + Object.keys(props).length * 30
            })

            // Add object properties
            Object.entries(props).forEach(([propName, propValue]) => {
                const propId = `${id}.${propName}`
                graphData.nodes.push({
                    id: propId,
                    type: 'property',
                    valueType: propValue.type,
                    value: String(propValue.value),
                    parent: id,
                    // Property nodes are not directly visible, but used for data organization
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0
                })

                graphData.links.push({
                    source: id,
                    target: propId,
                    type: 'property'
                })

                // If property references another object/array/function
                if (propValue.reference) {
                    graphData.links.push({
                        source: propId,
                        target: propValue.reference,
                        type: propValue.type
                    })
                }
            })
        })

        // Add arrays as nodes
        Object.entries(memoryState.arrays).forEach(([id, elements]) => {
            const typeIndex = referenceTypeCount.array++
            graphData.nodes.push({
                id,
                type: 'array',
                length: elements.length,
                x: 100 + columnGap,
                y: 50 + Object.keys(memoryState.objects).length * 200 + typeIndex * 200,
                width: nodeWidth,
                height: 40 + elements.length * 30
            })

            // Add array elements
            elements.forEach((element, index) => {
                const elementId = `${id}[${index}]`
                graphData.nodes.push({
                    id: elementId,
                    type: 'element',
                    valueType: element.type,
                    value: String(element.value),
                    parent: id,
                    // Element nodes are not directly visible, but used for data organization
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0
                })

                graphData.links.push({
                    source: id,
                    target: elementId,
                    type: 'element'
                })

                // If element references another object/array/function
                if (element.reference) {
                    graphData.links.push({
                        source: elementId,
                        target: element.reference,
                        type: element.type
                    })
                }
            })
        })

        // Add functions as nodes
        Object.entries(memoryState.functions).forEach(([id, fn], index) => {
            graphData.nodes.push({
                id,
                type: 'function',
                params: fn.params,
                x: 100 + columnGap,
                y: 50 + (Object.keys(memoryState.objects).length + Object.keys(memoryState.arrays).length) * 200 + index * 100,
                width: nodeWidth,
                height: nodeHeight
            })
        })

        // Create links
        const link = mainGroup.append('g')
            .selectAll('path')
            .data(graphData.links)
            .enter()
            .append('path')
            .attr('d', (d) => {
                const source = graphData.nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id))
                const target = graphData.nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id))

                if (!source || !target || !source.x || !source.y || !target.x || !target.y) {
                    return ''
                }

                // Only draw links between main nodes, not properties/elements
                if (source.type === 'property' || source.type === 'element' ||
                    target.type === 'property' || target.type === 'element') {
                    return ''
                }

                // Calculate curve points
                const sourceX = source.x + (source.width || 0)
                const sourceY = source.y + (source.height || 0) / 2
                const targetX = target.x
                const targetY = target.y + (target.height || 0) / 2

                // Create a curved path
                return `M ${sourceX} ${sourceY} C ${sourceX + 100} ${sourceY}, ${targetX - 100} ${targetY}, ${targetX} ${targetY}`
            })
            .attr('fill', 'none')
            .attr('stroke', '#000')
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrowhead)')

        // Define arrow markers
        mainGroup.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#000')

        // Create nodes (variables, objects, arrays, functions)
        const containerNode = mainGroup.append('g')
            .selectAll('g')
            .data(graphData.nodes.filter(n => ['variable', 'object', 'array', 'function'].includes(n.type)))
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`)

        // Add drag behavior to nodes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dragBehavior = d3.drag<any, GraphNode>()
            .on('start', () => {/* Start drag - no action needed */ })
            .on('drag', function (event, d) {
                // Update node position
                d.x = event.x
                d.y = event.y
                d3.select(this).attr('transform', `translate(${event.x}, ${event.y})`)

                // Update links
                link.attr('d', (linkData) => {
                    const source = graphData.nodes.find(n => n.id === (typeof linkData.source === 'string' ? linkData.source : linkData.source.id))
                    const target = graphData.nodes.find(n => n.id === (typeof linkData.target === 'string' ? linkData.target : linkData.target.id))

                    if (!source || !target || !source.x || !source.y || !target.x || !target.y) {
                        return ''
                    }

                    // Only draw links between main nodes, not properties/elements
                    if (source.type === 'property' || source.type === 'element' ||
                        target.type === 'property' || target.type === 'element') {
                        return ''
                    }

                    // Calculate curve points
                    const sourceX = source.x + (source.width || 0)
                    const sourceY = source.y + (source.height || 0) / 2
                    const targetX = target.x
                    const targetY = target.y + (target.height || 0) / 2

                    // Create a curved path
                    return `M ${sourceX} ${sourceY} C ${sourceX + 100} ${sourceY}, ${targetX - 100} ${targetY}, ${targetX} ${targetY}`
                })

                // Update properties and elements
                if (d.type === 'object') {
                    const properties = graphData.nodes.filter(n => n.parent === d.id && n.type === 'property')
                    properties.forEach((prop, i) => {
                        d3.selectAll(`path[data-parent="${d.id}"][data-index="${i}"]`)
                            .attr('transform', `translate(${event.x + 30}, ${event.y + 50 + i * 30}) scale(0.6)`)

                        d3.selectAll(`text[data-parent="${d.id}"][data-index="${i}"]`)
                            .attr('x', event.x + 50)
                            .attr('y', event.y + 55 + i * 30)
                    })
                }

                if (d.type === 'array') {
                    const elements = graphData.nodes.filter(n => n.parent === d.id && n.type === 'element')
                    elements.forEach((element, i) => {
                        d3.selectAll(`path[data-parent="${d.id}"][data-index="${i}"]`)
                            .attr('transform', `translate(${event.x + 30}, ${event.y + 50 + i * 30}) scale(0.6)`)

                        d3.selectAll(`text[data-parent="${d.id}"][data-index="${i}"]`)
                            .attr('x', event.x + 50)
                            .attr('y', event.y + 55 + i * 30)
                    })
                }
            })
            .on('end', () => {/* End drag - no action needed */ })

        // Apply drag behavior to nodes
        containerNode.call(dragBehavior)

        // Add rectangles for nodes
        containerNode.append('rect')
            .attr('width', d => d.width || nodeWidth)
            .attr('height', d => d.height || nodeHeight)
            .attr('rx', 5)
            .attr('ry', 5)
            .attr('fill', d => {
                if (d.type === 'variable') return typeColors.variable
                if (d.type === 'object') return typeColors.object
                if (d.type === 'array') return typeColors.array
                if (d.type === 'function') return typeColors.function
                return '#f5f5f5'
            })
            .attr('stroke', '#000')
            .attr('stroke-width', 2)

        // Add type headers for container types
        containerNode.filter(d => ['object', 'array', 'function'].includes(d.type))
            .append('g')
            .attr('transform', 'translate(10, 25)')
            .append('text')
            .attr('class', 'header')
            .attr('font-size', 14)
            .attr('font-weight', 'bold')
            .text(d => d.type.toUpperCase())

        // Add folder icons for container nodes
        containerNode.filter(d => ['object', 'array', 'function'].includes(d.type))
            .append('path')
            .attr('d', 'M2,3 L10,3 L12,5 L22,5 L22,20 L2,20 Z')
            .attr('transform', 'translate(85, 5) scale(0.8)')
            .attr('fill', '#000')
            .attr('stroke', 'none')

        // Add document icons for variable nodes
        containerNode.filter(d => d.type === 'variable')
            .append('path')
            .attr('d', 'M4,2 L16,2 L20,6 L20,22 L4,22 Z M16,2 L16,6 L20,6')
            .attr('transform', 'translate(10, 10) scale(0.7)')
            .attr('fill', 'none')
            .attr('stroke', '#000')
            .attr('stroke-width', 1.5)

        // Add variable labels and values
        containerNode.filter(d => d.type === 'variable')
            .append('g')
            .attr('transform', 'translate(35, 25)')
            .append('text')
            .attr('font-size', 12)
            .html(d => {
                const value = d.valueType === 'string' ? `"${d.value}"` : d.value
                return `<tspan font-weight="bold">${d.id}</tspan> : <tspan fill="${getValueTypeColor(d.valueType)}">${value}</tspan>`
            })

        // Add properties to object nodes
        const objectData = graphData.nodes.filter(n => n.type === 'object')
        objectData.forEach(objNode => {
            const properties = graphData.nodes.filter(n => n.parent === objNode.id && n.type === 'property')

            properties.forEach((prop, index) => {
                // Add document icon for property
                mainGroup.append('path')
                    .attr('d', 'M4,2 L16,2 L20,6 L20,22 L4,22 Z M16,2 L16,6 L20,6')
                    .attr('transform', `translate(${(objNode.x || 0) + 30}, ${(objNode.y || 0) + 50 + index * 30}) scale(0.6)`)
                    .attr('fill', 'none')
                    .attr('stroke', '#000')
                    .attr('stroke-width', 1.5)
                    .attr('data-parent', objNode.id)
                    .attr('data-index', index)

                // Add property name and value text
                const propName = prop.id.split('.').pop() || ''
                const propValue = prop.valueType === 'string' ? `"${prop.value}"` : prop.value

                mainGroup.append('text')
                    .attr('x', (objNode.x || 0) + 50)
                    .attr('y', (objNode.y || 0) + 55 + index * 30)
                    .attr('font-size', 12)
                    .attr('data-parent', objNode.id)
                    .attr('data-index', index)
                    .html(`<tspan font-weight="bold">${propName}</tspan> : <tspan fill="${getValueTypeColor(prop.valueType)}">${propValue}</tspan>`)
            })
        })

        // Add elements to array nodes
        const arrayData = graphData.nodes.filter(n => n.type === 'array')
        arrayData.forEach(arrayNode => {
            const elements = graphData.nodes.filter(n => n.parent === arrayNode.id && n.type === 'element')

            elements.forEach((element, index) => {
                // Add document icon for element
                mainGroup.append('path')
                    .attr('d', 'M4,2 L16,2 L20,6 L20,22 L4,22 Z M16,2 L16,6 L20,6')
                    .attr('transform', `translate(${(arrayNode.x || 0) + 30}, ${(arrayNode.y || 0) + 50 + index * 30}) scale(0.6)`)
                    .attr('fill', 'none')
                    .attr('stroke', '#000')
                    .attr('stroke-width', 1.5)
                    .attr('data-parent', arrayNode.id)
                    .attr('data-index', index)

                // Add element index and value text
                const elementIndex = element.id.match(/\[(\d+)\]$/)?.[1] || ''
                const elementValue = element.valueType === 'string' ? `"${element.value}"` : element.value

                mainGroup.append('text')
                    .attr('x', (arrayNode.x || 0) + 50)
                    .attr('y', (arrayNode.y || 0) + 55 + index * 30)
                    .attr('font-size', 12)
                    .attr('data-parent', arrayNode.id)
                    .attr('data-index', index)
                    .html(`<tspan font-weight="bold">${elementIndex}</tspan> : <tspan fill="${getValueTypeColor(element.valueType)}">${elementValue}</tspan>`)
            })
        })

        // Helper function to get color based on type
        function getValueTypeColor(type: string | undefined) {
            return type ? typeColors[type as keyof typeof typeColors] || '#000' : '#000'
        }

        // Calculate the bounding box of all nodes to center the diagram
        const calculateBoundingBox = () => {
            let minX = Infinity
            let minY = Infinity
            let maxX = -Infinity
            let maxY = -Infinity

            graphData.nodes.forEach(node => {
                if (!node.x || !node.y || !node.width || !node.height) return

                // Only consider main nodes for the bounding box
                if (['variable', 'object', 'array', 'function'].includes(node.type)) {
                    minX = Math.min(minX, node.x)
                    minY = Math.min(minY, node.y)
                    maxX = Math.max(maxX, node.x + node.width)
                    maxY = Math.max(maxY, node.y + node.height)
                }
            })

            return { minX, minY, maxX, maxY }
        }

        // Center and scale the diagram to fit in the viewport
        const centerAndScaleDiagram = () => {
            const { minX, minY, maxX, maxY } = calculateBoundingBox()

            // Calculate diagram dimensions
            const diagramWidth = maxX - minX
            const diagramHeight = maxY - minY

            // Calculate scale to fit the diagram
            const scaleX = width / (diagramWidth + 80) // Add padding
            const scaleY = height / (diagramHeight + 80) // Add padding
            const scale = Math.min(1, Math.min(scaleX, scaleY)) // Don't zoom in, only out if needed

            // Calculate translation to center
            const centerX = (width / 2) - ((minX + diagramWidth / 2) * scale)
            const centerY = (height / 2) - ((minY + diagramHeight / 2) * scale)

            return d3.zoomIdentity.translate(centerX, centerY).scale(scale)
        }

        // Apply initial transform to center the diagram
        const initialTransform = centerAndScaleDiagram()
        svg.call(zoom.transform, initialTransform)

    }, [memoryState])

    // Handle zoom controls
    const handleZoomIn = () => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4])
        svg.transition().duration(300).call(zoom.scaleBy, 1.2)
    }

    const handleZoomOut = () => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4])
        svg.transition().duration(300).call(zoom.scaleBy, 0.8)
    }

    const handleResetZoom = () => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4])

        // Re-center the diagram using the same logic as initial render
        // Create temporary data structure to recompute the bounding box
        const nodes = d3.selectAll('.node').data() as GraphNode[]
        if (nodes.length === 0) {
            // If no nodes to calculate, use default transform
            svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity.translate(20, 20).scale(1))
            return
        }

        // Calculate the bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        nodes.forEach(node => {
            if (!node.x || !node.y || !node.width || !node.height) return
            minX = Math.min(minX, node.x)
            minY = Math.min(minY, node.y)
            maxX = Math.max(maxX, node.x + node.width)
            maxY = Math.max(maxY, node.y + node.height)
        })

        // Get the SVG dimensions
        const width = svgRef.current.clientWidth
        const height = svgRef.current.clientHeight

        // Calculate scale and translation
        const diagramWidth = maxX - minX
        const diagramHeight = maxY - minY

        const scaleX = width / (diagramWidth + 80)
        const scaleY = height / (diagramHeight + 80)
        const scale = Math.min(1, Math.min(scaleX, scaleY))

        const centerX = (width / 2) - ((minX + diagramWidth / 2) * scale)
        const centerY = (height / 2) - ((minY + diagramHeight / 2) * scale)

        const transform = d3.zoomIdentity.translate(centerX, centerY).scale(scale)
        svg.transition().duration(300).call(zoom.transform, transform)
    }

    return (
        <div className="w-full h-full bg-white rounded-md shadow-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center m-3">
                <h3 className="text-lg font-semibold">Memory Visualization</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleZoomOut}
                        className="p-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                        aria-label="Zoom out"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                    </button>
                    <span className="text-xs text-gray-500">{Math.round(zoomLevel * 100)}%</span>
                    <button
                        onClick={handleZoomIn}
                        className="p-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                        aria-label="Zoom in"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                    </button>
                    <button
                        onClick={handleResetZoom}
                        className="p-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                        aria-label="Reset zoom"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    </button>
                </div>
            </div>
            <div ref={containerRef} className="overflow-hidden flex-1 cursor-move" style={{ minHeight: "400px" }}>
                {Object.keys(memoryState.variables).length > 0 ? (
                    <svg
                        ref={svgRef}
                        className="w-full h-full"
                        style={{ cursor: 'move' }}
                    >
                        <defs>
                            <marker
                                id="arrowhead"
                                viewBox="0 -5 10 10"
                                refX="8"
                                refY="0"
                                markerWidth="6"
                                markerHeight="6"
                                orient="auto"
                            >
                                <path d="M0,-5L10,0L0,5" fill="#999" />
                            </marker>
                        </defs>
                    </svg>
                ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500 italic">
                        No variables to visualize
                    </div>
                )}
            </div>
            <div className="p-3 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                    Tip: Drag to move the visualization, scroll to zoom, or use the zoom controls
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: typeColors.variable, border: '1px solid black' }}></div>
                        <span className="text-xs">Variable</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: typeColors.object }}></div>
                        <span className="text-xs">Object</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: typeColors.array }}></div>
                        <span className="text-xs">Array</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: typeColors.function }}></div>
                        <span className="text-xs">Function</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MemoryModelDiagram 