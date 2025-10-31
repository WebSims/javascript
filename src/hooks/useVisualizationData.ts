/**
 * Hook for transforming and laying out visualization data
 * 
 * Responsibilities:
 * - Transforms memory snapshots into visualization-ready data structures
 * - Calculates layout using ELK (Eclipse Layout Kernel)
 * - Manages positioning for memval, heap, and scope sections
 * 
 * Separates data transformation logic from animation and rendering concerns.
 */

import { useCallback, useMemo } from "react"
import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkNode as ElkLayoutNode, ElkEdge as ElkLayoutEdge } from "elkjs/lib/elk-api"
import { HEAP_OBJECT_TYPE, EXEC_STEP_TYPE, type ExecStep } from "@/types/simulator"
import { getStepColorByDepth } from "@/helpers/steps"

type ElkNode = Omit<ElkLayoutNode, 'labels' | 'children' | 'edges'> & {
    id: string
    width?: number
    height?: number
    x?: number
    y?: number
    layoutOptions?: Record<string, string>
    labels?: { text?: string; width?: number; height?: number }[]
    children?: ElkNode[]
}

type ElkEdge = Omit<ElkLayoutEdge, 'sources' | 'targets'> & {
    id: string
    sources: string[]
    targets: string[]
    layoutOptions?: Record<string, string>
}

type ElkGraph = ElkNode & {
    edges: ElkEdge[]
}

export interface MemValItem {
    id: string
    value: string
    type: string
    x?: number
    y?: number
    animation?: 'slide-in' | 'fade-out' | 'none'
}

interface HeapProperty {
    name: string
    value: string
    targetRef?: string
}

export interface HeapObject {
    id: string
    type: string
    properties?: HeapProperty[]
    x?: number
    y?: number
}

export interface ScopeData {
    id: string
    name: string
    variables: Array<{
        name: string
        value: string
        targetRef?: string
    }>
    isCurrent: boolean
    color: string
    borderColor: string
    x?: number
    y?: number
}

export interface VisualizationData {
    memval: MemValItem[]
    heap: HeapObject[]
    scopes: ScopeData[]
    connections: Array<{
        source: string
        target: string
        type: 'var-ref' | 'prop-ref' | 'memval-ref'
    }>
}

const MEMVAL_ITEM_WIDTH = 120
const MEMVAL_ITEM_HEIGHT = 60
const OBJECT_WIDTH = 150
const OBJECT_HEIGHT = 90
const SCOPE_WIDTH = 180
const SCOPE_HEIGHT = 100

export const useVisualizationData = (steps: ExecStep[]) => {
    const getMaxDepth = useMemo(() => {
        return Math.max(...steps.map(step => step.scopeIndex))
    }, [steps])

    const transformMemorySnapshot = useCallback((currentStep: ExecStep | null) => {
        if (!currentStep) return null

        const memvalItems: MemValItem[] = []
        const heapObjects: HeapObject[] = []
        const scopesData: ScopeData[] = []
        const connections: Array<{ source: string; target: string; type: 'var-ref' | 'prop-ref' | 'memval-ref' }> = []

        // Transform memval items
        currentStep.memorySnapshot.memval.forEach((mem, index) => {
            let displayValue: string
            if (mem.type === 'primitive') {
                displayValue = String(mem.value)
            } else {
                displayValue = `<Reference to ${mem.ref}>`
            }

            memvalItems.push({
                id: `memval-${index}`,
                value: displayValue,
                type: mem.type,
                animation: 'none'
            })

            // Add connection if it's a reference
            if (mem.type === 'reference' && mem.ref) {
                connections.push({
                    source: `memval-${index}`,
                    target: `obj-${mem.ref}`,
                    type: 'memval-ref'
                })
            }
        })

        // Transform heap objects
        Object.entries(currentStep.memorySnapshot.heap ?? {}).forEach(([ref, obj]) => {
            const objId = `obj-${ref}`
            let objType = "Object"

            if (obj.type === HEAP_OBJECT_TYPE.ARRAY) {
                objType = "Array"
            } else if (obj.type === HEAP_OBJECT_TYPE.FUNCTION) {
                objType = "Function"
            }

            const properties: HeapProperty[] = []

            if (obj.type === HEAP_OBJECT_TYPE.OBJECT) {
                Object.entries(obj.properties).forEach(([propName, propValue]) => {
                    const property: HeapProperty = {
                        name: propName,
                        value: propValue.type === 'primitive'
                            ? String(propValue.value)
                            : '<Reference>'
                    }

                    if (propValue.type === 'reference' && propValue.ref) {
                        property.targetRef = `obj-${propValue.ref}`
                        connections.push({
                            source: `${objId}-prop-${propName}`,
                            target: `obj-${propValue.ref}`,
                            type: 'prop-ref'
                        })
                    }

                    properties.push(property)
                })
            } else if (obj.type === HEAP_OBJECT_TYPE.ARRAY) {
                obj.elements.forEach((element, index) => {
                    if (element !== undefined) {
                        const property: HeapProperty = {
                            name: String(index),
                            value: element.type === 'primitive'
                                ? String(element.value)
                                : '<Reference>'
                        }

                        if (element.type === 'reference' && element.ref) {
                            property.targetRef = `obj-${element.ref}`
                            connections.push({
                                source: `${objId}-prop-${index}`,
                                target: `obj-${element.ref}`,
                                type: 'prop-ref'
                            })
                        }

                        properties.push(property)
                    }
                })
                properties.push({
                    name: "length",
                    value: String(obj.elements.length)
                })
            } else if (obj.type === HEAP_OBJECT_TYPE.FUNCTION) {
                properties.push({
                    name: "type",
                    value: "function"
                })
            }

            heapObjects.push({
                id: objId,
                type: objType,
                properties
            })
        })

        // Transform scopes (reverse order - global at bottom)
        const reversedScopes = [...(currentStep.memorySnapshot.scopes || [])].reverse()
        reversedScopes.forEach((scope, reversedIndex) => {
            const originalIndex = (currentStep.memorySnapshot.scopes.length || 0) - 1 - reversedIndex
            const scopeId = `scope-${originalIndex}`

            const stepColor = getStepColorByDepth(
                originalIndex,
                getMaxDepth,
                scope.type === "function"
            )

            const effectiveScopeIndex = currentStep.type === EXEC_STEP_TYPE.POP_SCOPE && currentStep.index < steps.length - 1
                ? steps[currentStep.index + 1].scopeIndex
                : currentStep.scopeIndex
            const isCurrent = originalIndex === effectiveScopeIndex

            const variables = Object.entries(scope.variables).map(([name, variable]) => {
                let displayValue
                if (variable.value.type === "primitive") {
                    if (variable.value.value === undefined) {
                        displayValue = "undefined"
                    } else if (variable.value.value === null) {
                        displayValue = "null"
                    } else if (variable.value.value === "not_initialized") {
                        displayValue = "<TDZ>"
                    } else {
                        displayValue = typeof variable.value.value === 'string'
                            ? `"${variable.value.value}"`
                            : String(variable.value.value)
                    }
                } else {
                    displayValue = "<Reference>"
                }

                const varData = {
                    name,
                    value: displayValue,
                    targetRef: undefined as string | undefined
                }

                // Add connection if it's a reference
                if (variable.value.type === "reference" && variable.value.ref) {
                    varData.targetRef = `obj-${variable.value.ref}`
                    connections.push({
                        source: `${scopeId}-var-${name}`,
                        target: `obj-${variable.value.ref}`,
                        type: 'var-ref'
                    })
                }

                return varData
            })

            scopesData.push({
                id: scopeId,
                name: `${scope.type.charAt(0).toUpperCase() + scope.type.slice(1)} Scope`,
                variables,
                isCurrent,
                color: stepColor.backgroundColor,
                borderColor: stepColor.borderColor
            })
        })

        return {
            memval: memvalItems,
            heap: heapObjects,
            scopes: scopesData,
            connections
        }
    }, [getMaxDepth, steps])

    const calculateLayout = useCallback(async (data: VisualizationData) => {
        const elk = new ELK()

        const elkGraph: ElkGraph = {
            id: "root",
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': 'RIGHT',
                'elk.spacing.nodeNode': '50',
                'elk.layered.spacing.nodeNodeBetweenLayers': '80'
            },
            children: [],
            edges: []
        }

        // Create memval section
        const memvalSection: ElkNode = {
            id: "memval-section",
            width: MEMVAL_ITEM_WIDTH + 40,
            height: data.memval.length * (MEMVAL_ITEM_HEIGHT + 10) + 20,
            layoutOptions: {
                'elk.algorithm': 'box',
                'elk.direction': 'UP'
            },
            children: data.memval.map((item) => ({
                id: item.id,
                width: MEMVAL_ITEM_WIDTH,
                height: MEMVAL_ITEM_HEIGHT,
                layoutOptions: {}
            }))
        }

        // Create heap section
        const heapSection: ElkNode = {
            id: "heap-section",
            layoutOptions: {
                'elk.algorithm': 'box'
            },
            children: data.heap.map(obj => ({
                id: obj.id,
                width: OBJECT_WIDTH,
                height: OBJECT_HEIGHT,
                layoutOptions: {}
            }))
        }

        // Create scopes section
        const scopesSection: ElkNode = {
            id: "scopes-section",
            layoutOptions: {
                'elk.algorithm': 'box',
                'elk.direction': 'UP'
            },
            children: data.scopes.map(scope => ({
                id: scope.id,
                width: SCOPE_WIDTH,
                height: SCOPE_HEIGHT,
                layoutOptions: {}
            }))
        }

        elkGraph.children?.push(memvalSection, heapSection, scopesSection)

        // Add edges for connections
        data.connections.forEach((conn, index) => {
            elkGraph.edges.push({
                id: `edge-${index}`,
                sources: [conn.source],
                targets: [conn.target]
            })
        })

        try {
            const layouted = await elk.layout(elkGraph)

            // Extract positions from layouted graph
            const positionMap = new Map<string, { x: number; y: number }>()

            const extractPositions = (node: ElkNode, offsetX = 0, offsetY = 0) => {
                const nodeX = (node.x || 0) + offsetX
                const nodeY = (node.y || 0) + offsetY
                positionMap.set(node.id, { x: nodeX, y: nodeY })

                node.children?.forEach(child => {
                    extractPositions(child, nodeX, nodeY)
                })
            }

            layouted.children?.forEach(section => {
                extractPositions(section)
            })

            // Apply positions to data
            const positionedData: VisualizationData = {
                memval: data.memval.map(item => {
                    const pos = positionMap.get(item.id)
                    return { ...item, x: pos?.x, y: pos?.y }
                }),
                heap: data.heap.map(obj => {
                    const pos = positionMap.get(obj.id)
                    return { ...obj, x: pos?.x, y: pos?.y }
                }),
                scopes: data.scopes.map(scope => {
                    const pos = positionMap.get(scope.id)
                    return { ...scope, x: pos?.x, y: pos?.y }
                }),
                connections: data.connections
            }

            return positionedData
        } catch (error) {
            console.error("ELK layout error:", error)
            return data
        }
    }, [])

    return {
        transformMemorySnapshot,
        calculateLayout
    }
}

