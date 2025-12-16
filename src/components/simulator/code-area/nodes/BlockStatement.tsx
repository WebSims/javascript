import React, { useRef, useEffect, RefObject } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Statement component
type StatementRenderer = React.FC<{ st: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface BlockStatementProps {
    node: ESTree.BlockStatement & ESNode
    parent: ESNode
    parens: Set<number>
    Statement: StatementRenderer
}

// ----- BlockStatement Component -----
const BlockStatement: React.FC<BlockStatementProps> = ({ node, parent, parens, Statement }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isExecuting, isExecuted, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "statement.block"

    const decoration = getNodeDecoration("BlockStatement", "default")
    const statements = node.body

    // Apply executing/executed classes to parent DOM element when condition is true
    useEffect(() => {
        const excludedParentTypes = ["BlockStatement", "Program"]
        if (!excludedParentTypes.includes(parent.type)) {
            const parentElement = ref.current?.parentElement
            if (parentElement) {
                // Remove existing classes first
                parentElement.classList.remove("executing", "executed", "error-thrown")

                // Add current classes
                if (isExecuting) parentElement.classList.add("executing")
                if (isExecuted) parentElement.classList.add("executed")
                if (isErrorThrown) parentElement.classList.add("error-thrown")
            }
        }
    }, [isExecuting, isExecuted, isErrorThrown, parent.type])

    return (
        <span ref={ref}>
            <span className="inline-block text-slate-500 font-bold">&#123;</span>
            <div className="">
                <div className="ml-4 my-1">
                    {statements && statements.length > 0 && statements.map((statement, i) => (
                        <Statement key={i} st={statement as ESNode} parent={node} parens={parens} />
                    ))}
                </div>
            </div>
            <span className="inline-block text-slate-500 font-bold mr-2">&#125;</span>
        </span>
    )
}

export default BlockStatement


