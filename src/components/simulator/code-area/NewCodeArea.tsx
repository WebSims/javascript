import React, { useEffect } from 'react'
import { useSimulatorContext } from '@/hooks/useSimulatorContext'
import ts from 'typescript'

interface NewCodeAreaProps {
    fromAstOf: string
}

const NewCodeArea: React.FC<NewCodeAreaProps> = ({ fromAstOf }) => {
    const { updateCodeStr, astOfCode } = useSimulatorContext()

    useEffect(() => {
        updateCodeStr(fromAstOf)
    }, [fromAstOf])

    function logTree(node: ts.Node, indent = 0) {
        console.log(`${' '.repeat(indent)}- ${ts.SyntaxKind[node.kind]}`)

        node.forEachChild(child => logTree(child, indent + 2))
    }

    logTree(astOfCode)

    return (
        <div>NewCodeArea</div>
    )
}

export default NewCodeArea