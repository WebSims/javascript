import React, { useRef } from "react"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import {
    buildNodeDecorationResult,
    NodeExecutionState,
    NodeDecorationResult,
} from "@/configs/ast-render.config"

// ----- Shared Types -----
export interface BaseNodeProps {
    node: ESNode
    parent: ESNode
    parens: Set<number>
}

export interface RenderContext {
    parens: Set<number>
    parent: ESNode
}

// Re-export types from config
export type { NodeExecutionState, NodeDecorationResult }

// ----- Render State Hook -----

/**
 * Hook to get rendering state for a node
 */
export const useNodeRenderState = (
    node?: ESNode,
    ref?: React.RefObject<HTMLElement | null>
): NodeExecutionState => {
    const { isExecuting, isExecuted, isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)
    return { isExecuting, isExecuted, isEvaluating, isEvaluated, isErrorThrown }
}

// ----- Utility Component: Node Wrapper -----

interface NodeWrapperProps {
    node: ESNode
    parent: ESNode
    children: React.ReactNode
    asSpan?: boolean
    extraClassName?: string
    parentKey?: string
}

/**
 * Wrapper component that applies decorations and execution state to a node
 */
export const NodeWrapper: React.FC<NodeWrapperProps> = ({
    node,
    parent,
    children,
    asSpan = true,
    extraClassName = "",
    parentKey,
}) => {
    const ref = useRef<HTMLElement>(null)
    const state = useNodeRenderState(node, ref)
    const { decoration, className, cheatSheetId } = buildNodeDecorationResult(
        node,
        parent,
        state,
        parentKey
    )
    
    const fullClassName = [className, extraClassName].filter(Boolean).join(" ")
    
    const commonProps = {
        ref: ref as React.RefObject<HTMLElement>,
        "data-cheat-sheet-id": cheatSheetId,
        className: fullClassName,
        title: decoration.tooltip,
        style: decoration.color ? { color: decoration.color } : undefined,
    }
    
    if (asSpan) {
        return (
            <span {...commonProps} ref={ref as React.RefObject<HTMLSpanElement>}>
                {children}
            </span>
        )
    }
    
    return (
        <div {...commonProps} ref={ref as React.RefObject<HTMLDivElement>}>
            {children}
        </div>
    )
}

export default NodeWrapper
