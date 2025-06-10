import { DECLARATION_TYPE, NodeHandlerMap, TDZ, UNDEFINED } from "@/types/simulation";

export const hoistingHandlers = {} as NodeHandlerMap

hoistingHandlers["Program"] = function (astNode, options) {
    for (const node of astNode.body) {
        if (this.isBlock(node) || !options.isRoot) {
            this.traverseHoisting(node, options, false)
        } else {
            this.traverseHoisting(node, options, true)
        }
    }
}

hoistingHandlers["BlockStatement"] = function (astNode, options) {
    for (const node of astNode.body) {
        if (this.isBlock(node) || !options.isRoot) {
            this.traverseHoisting(node, options, false)
        } else {
            this.traverseHoisting(node, options, true)
        }
    }
}

hoistingHandlers["FunctionDeclaration"] = function (astNode, options) {
    const lookupResult = this.lookupVariable(astNode.id.name)
    if (lookupResult) {
        if (options.isRoot && lookupResult.scopeIndex !== this.getLastScopeIndex()) {
            if (lookupResult.variable.declarationType === DECLARATION_TYPE.VAR || lookupResult.variable.declarationType === DECLARATION_TYPE.FUNCTION) {
                this.createHeapObject({ node: astNode })
                this.writeVariable(
                    astNode.id.name,
                    { type: "reference", ref: this.getLastRef() },
                    DECLARATION_TYPE.FUNCTION,
                    options.parentScopeIndex
                )
            } else {
                this.createHeapObject({ node: astNode })
                const initialValue = { type: "reference", ref: this.getLastRef() } as const
                this.newDeclaration(
                    astNode.id.name,
                    initialValue,
                    DECLARATION_TYPE.FUNCTION,
                    this.getLastScopeIndex()
                )
            }
        }
    } else {
        if (options.parentScopeIndex === this.getLastScopeIndex()) {
            this.createHeapObject({ node: astNode })
            const initialValue = { type: "reference", ref: this.getLastRef() } as const
            this.newDeclaration(
                astNode.id.name,
                initialValue,
                DECLARATION_TYPE.FUNCTION,
                options.parentScopeIndex
            )
        } else {
            const initialValue = UNDEFINED
            this.newDeclaration(
                astNode.id.name,
                initialValue,
                DECLARATION_TYPE.FUNCTION,
                options.parentScopeIndex
            )
        }
    }
}

hoistingHandlers["VariableDeclaration"] = function (astNode, options) {
    for (const declarator of astNode.declarations) {
        const identifier = this.getIdentifierFromPattern(declarator.id)
        if (identifier) {
            const declarationType = astNode.kind === DECLARATION_TYPE.CONST ? DECLARATION_TYPE.CONST : astNode.kind === DECLARATION_TYPE.LET ? DECLARATION_TYPE.LET : DECLARATION_TYPE.VAR
            const initialValue = astNode.kind === DECLARATION_TYPE.VAR ? UNDEFINED : TDZ
            const scopeIndex = astNode.kind === DECLARATION_TYPE.VAR ? options.parentScopeIndex : this.getLastScopeIndex()
            const lookupResult = this.lookupVariable(identifier.name)
            if (lookupResult) {
                if (options.parentScopeIndex === this.getLastScopeIndex() && lookupResult.variable.declarationType !== DECLARATION_TYPE.FUNCTION) {
                    this.newDeclaration(
                        identifier.name,
                        initialValue,
                        declarationType,
                        scopeIndex
                    )
                }
                if (declarationType === DECLARATION_TYPE.LET || declarationType === DECLARATION_TYPE.CONST) {
                    this.newDeclaration(
                        identifier.name,
                        initialValue,
                        declarationType,
                        scopeIndex
                    )
                }
            } else {
                if (declarationType === DECLARATION_TYPE.VAR) {
                    this.newDeclaration(
                        identifier.name,
                        initialValue,
                        declarationType,
                        scopeIndex
                    )
                }
            }
        }
    }

}

hoistingHandlers["IfStatement"] = function (astNode, options) {
    if (astNode.consequent) {
        this.traverseHoisting(astNode.consequent, options, false)
    }
    if (astNode.alternate) {
        this.traverseHoisting(astNode.alternate, options, false)
    }
}