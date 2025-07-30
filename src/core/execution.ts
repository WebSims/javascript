import { BUBBLE_UP_TYPE, DECLARATION_TYPE, EXEC_STEP_TYPE, HEAP_OBJECT_TYPE, JSValue, JS_VALUE_NAN, NodeHandlerMap, JS_VALUE_TDZ, JS_VALUE_UNDEFINED } from "@/types/simulator"
import { forEach } from "lodash"

export const execHandlers = {} as NodeHandlerMap

execHandlers['Program'] = function (astNode, options) {
    for (const statement of astNode.body) {
        if (statement.type === "FunctionDeclaration") continue
        this.traverseExec(statement, options)
    }
}

execHandlers["BlockStatement"] = function (astNode, options) {
    for (const statement of astNode.body) {
        if (statement.type === "FunctionDeclaration") continue
        this.traverseExec(statement, options)
    }
}

execHandlers["ExpressionStatement"] = function (astNode, options) {
    this.addExecutingStep(astNode)
    this.traverseExec(astNode.expression, options)
    this.popMemval()
    this.addExecutedStep(astNode)
}

execHandlers["Literal"] = function (astNode) {
    this.addEvaluatingStep(astNode)
    this.pushMemval({ type: "primitive", value: astNode.value })
    this.addEvaluatedStep(astNode)
}

execHandlers["VariableDeclaration"] = function (astNode, options) {
    for (const declarator of astNode.declarations) {
        this.addExecutingStep(astNode)

        if (declarator.init) {
            this.traverseExec(declarator.init, options)
        }
        const evaluatedValue = this.popMemval() || JS_VALUE_UNDEFINED

        const identifier = this.getIdentifierFromPattern(declarator.id)
        if (identifier) {
            const declarationType = astNode.kind === DECLARATION_TYPE.CONST ? DECLARATION_TYPE.CONST : astNode.kind === DECLARATION_TYPE.LET ? DECLARATION_TYPE.LET : DECLARATION_TYPE.VAR
            this.writeVariable(identifier.name, evaluatedValue, declarationType, options.parentScopeIndex)
        }
        this.addExecutedStep(astNode)
    }
}

execHandlers["CallExpression"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    this.traverseExec(astNode.callee, options)

    for (const arg of astNode.arguments) {
        this.traverseExec(arg, options)
    }
    const args: JSValue[] = []
    astNode.arguments.forEach(() => args.unshift(this.popMemval()))

    const fnRef = this.popMemval()
    if (fnRef.type === "reference") {
        const object = this.getHeapObject(fnRef.ref)
        if (object.type === HEAP_OBJECT_TYPE.FUNCTION) {
            args.forEach(arg => this.pushMemval(arg))
            this.pushMemval({ type: 'primitive', value: args.length })
            this.pushMemval(fnRef)

            this.addStep(astNode, EXEC_STEP_TYPE.FUNCTION_CALL)

            this.popMemval()

            try {
                this.traverseExec(
                    object.node.body,
                    { ...options, callee: object.node }
                )
                if (object.node.body.type === "BlockStatement") {
                    this.pushMemval(JS_VALUE_UNDEFINED)
                }
                this.addEvaluatedStep(astNode)
            } catch (bubbleUp) {
                if (bubbleUp === BUBBLE_UP_TYPE.RETURN) {
                    this.addEvaluatedStep(astNode, bubbleUp)
                } else if (bubbleUp === BUBBLE_UP_TYPE.THROW) {
                    this.addThrownStep(astNode)
                } else {
                    throw bubbleUp
                }
            }
        } else {
            this.createErrorObject('TypeError', `${astNode.callee.name} is not a function`)
            this.addThrownStep(astNode)
            throw BUBBLE_UP_TYPE.THROW
        }
    } else {
        this.createErrorObject('ReferenceError', `${astNode.callee.name} is not a function`)
        this.addThrownStep(astNode)
    }
}

execHandlers["Identifier"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    if (astNode.name === 'undefined') {
        this.pushMemval(JS_VALUE_UNDEFINED)
        this.addEvaluatedStep(astNode)
    } else if (astNode.name === 'NaN') {
        this.pushMemval(JS_VALUE_NAN)
        this.addEvaluatedStep(astNode)
    } else {
        const lookupResult = this.lookupVariable(astNode.name)
        if (lookupResult) {
            const evaluatedValue = lookupResult.variable.value
            if (evaluatedValue === JS_VALUE_TDZ) {
                this.createErrorObject('ReferenceError', `Cannot access '${astNode.name}' before initialization`)
                this.addThrownStep(astNode)
            } else {
                this.pushMemval(evaluatedValue)
                this.addEvaluatedStep(astNode)
            }
        } else {
            if (options.typeof) {
                this.pushMemval(JS_VALUE_UNDEFINED)
                this.addEvaluatedStep(astNode)
            } else {
                this.createErrorObject('ReferenceError', `${astNode.name} is not defined`)
                this.addThrownStep(astNode)
            }
        }
    }
}

execHandlers["BinaryExpression"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    this.traverseExec(astNode.left, options)
    this.traverseExec(astNode.right, options)

    const evaluatedRight = this.popMemval()
    const evaluatedLeft = this.popMemval()

    try {
        const evaluatedValue = this.binaryOperatorHandler(astNode.operator, evaluatedLeft, evaluatedRight)
        this.pushMemval(evaluatedValue)
        this.addEvaluatedStep(astNode)

    } catch (error: unknown) {
        this.createErrorObject('TypeError', error instanceof Error ? error.message : 'Unknown error')
        this.addThrownStep(astNode)
    }
}


execHandlers["LogicalExpression"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    this.traverseExec(astNode.left, options)
    const evaluatedLeft = this.readMemval()
    const result = this.logicalOperatorHandler(
        astNode.operator,
        evaluatedLeft,
        () => {
            this.traverseExec(astNode.right, options)
            return this.popMemval()
        }
    )
    this.popMemval()
    this.pushMemval(result)
    this.addEvaluatedStep(astNode)
}

execHandlers["ReturnStatement"] = function (astNode, options) {
    this.addExecutingStep(astNode)
    if (astNode.argument) {
        this.traverseExec(astNode.argument, options)
    } else {
        this.pushMemval(JS_VALUE_UNDEFINED)
    }
    this.addExecutedStep(astNode, BUBBLE_UP_TYPE.RETURN)
    throw BUBBLE_UP_TYPE.RETURN
}

execHandlers["ThrowStatement"] = function (astNode, options) {
    this.addExecutingStep(astNode)
    this.traverseExec(astNode.argument, options)
    this.addThrownStep(astNode)
}

execHandlers["TryStatement"] = function (astNode, options) {
    this.addExecutingStep(astNode)

    const finalizerHandler = () => {
        if (astNode.finalizer) {
            try {
                this.traverseExec(astNode.finalizer, options)
            } catch (finalizerBubbleUp) {
                if (finalizerBubbleUp === BUBBLE_UP_TYPE.THROW) {
                    this.addThrownStep(astNode)
                }
                this.addExecutedStep(astNode)
                throw finalizerBubbleUp
            }
        }
    }

    const catchHandler = () => {
        if (astNode.handler) {
            try {
                this.traverseExec(astNode.handler.body, { ...options, catch: astNode.handler })
            } catch (catchBubbleUp) {
                if (astNode.finalizer) {
                    const catchValue = this.popMemval()
                    finalizerHandler()
                    this.pushMemval(catchValue)
                }

                if (catchBubbleUp === BUBBLE_UP_TYPE.THROW) {
                    this.addThrownStep(astNode)
                }
                this.addExecutedStep(astNode)
                throw catchBubbleUp
            }
        }
    }

    try {
        this.traverseExec(astNode.block, options)
        finalizerHandler()
        this.addExecutedStep(astNode)
    } catch (tryBubbleUp) {
        if (tryBubbleUp === BUBBLE_UP_TYPE.THROW) {
            if (astNode.handler) {
                catchHandler()
                finalizerHandler()
                this.addExecutedStep(astNode)
            } else {
                if (astNode.finalizer) {
                    finalizerHandler()
                }
                this.addThrownStep(astNode)
            }
        }

        if (tryBubbleUp === BUBBLE_UP_TYPE.RETURN) {
            if (astNode.finalizer) {
                const tryValue = this.popMemval()
                finalizerHandler()
                this.pushMemval(tryValue)
            }
            this.addExecutedStep(astNode)
            throw tryBubbleUp
        }
    }
}

execHandlers["AssignmentExpression"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    if (astNode.operator === "=") {
        // Assignment
        if (astNode.left.type === "MemberExpression") {
            const memberExpression = astNode.left
            this.traverseExec(memberExpression.object, options)

            if (memberExpression.computed) {
                this.traverseExec(memberExpression.property, options)
            } else {
                const propertyNode = memberExpression.property
                if (propertyNode.type === 'Identifier' || propertyNode.type === 'PrivateIdentifier') {
                    this.pushMemval({ type: "primitive", value: propertyNode.name })
                }
            }

            if (this.readMemval(1) === JS_VALUE_UNDEFINED) {
                const evaluatedProperty = this.popMemval()
                this.popMemval()
                const propName = evaluatedProperty.type === 'primitive' ? `'${evaluatedProperty.value}'` : '(unknown property)'
                this.createErrorObject('TypeError', `Cannot set properties of undefined (setting ${propName})`)
                this.addThrownStep(astNode)
            }

            this.traverseExec(astNode.right, options)
            const evaluatedValue = this.popMemval()
            const evaluatedProperty = this.popMemval()
            const evaluatedObject = this.popMemval()

            if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
                const stringProperty = String(evaluatedProperty.value)
                this.writeProperty(evaluatedObject.ref, stringProperty, evaluatedValue)
                this.pushMemval(evaluatedValue)
                this.addEvaluatedStep(astNode)
            } else {
                this.pushMemval(evaluatedValue)
                this.addEvaluatedStep(astNode)
            }
        } else {
            const identifier = this.getIdentifierFromPattern(astNode.left)
            if (identifier) {
                this.traverseExec(astNode.right, options)
                const evaluatedValue = this.popMemval()

                const lookupResult = this.lookupVariable(identifier.name)
                if (lookupResult) {
                    if (lookupResult.variable.value === JS_VALUE_TDZ) {
                        this.createErrorObject('ReferenceError', `Cannot access '${identifier.name}' before initialization`)
                        this.addThrownStep(astNode)
                    } else {
                        this.writeVariable(
                            identifier.name,
                            evaluatedValue,
                            lookupResult.variable.declarationType,
                            options.parentScopeIndex
                        )
                    }
                } else {
                    if (options.strict) {
                        this.createErrorObject('ReferenceError', `${identifier.name} is not defined`)
                        this.addThrownStep(astNode)
                    } else {
                        this.newDeclaration(identifier.name, evaluatedValue, DECLARATION_TYPE.GLOBAL, 0)
                    }
                }

                this.pushMemval(evaluatedValue)
                this.addEvaluatedStep(astNode)
            }
        }
    } else {
        // Update && Assignment
        if (astNode.left.type === "MemberExpression") {
            const memberExpression = astNode.left
            this.traverseExec(memberExpression.object, options)

            if (memberExpression.computed) {
                this.traverseExec(memberExpression.property, options)
            } else {
                const propertyNode = memberExpression.property
                if (propertyNode.type === 'Identifier' || propertyNode.type === 'PrivateIdentifier') {
                    this.pushMemval({ type: "primitive", value: propertyNode.name })
                }
            }

            const evaluatedProperty = this.readMemval()
            const evaluatedObject = this.readMemval(1)

            if (evaluatedObject === JS_VALUE_UNDEFINED) {
                this.popMemval()
                this.popMemval()
                this.createErrorObject('TypeError', `Cannot set properties of undefined (setting '${evaluatedProperty.value}')`)
                this.addThrownStep(astNode)
            }

            let evaluatedLeft: JSValue = JS_VALUE_UNDEFINED
            if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
                evaluatedLeft = this.readProperty(evaluatedObject.ref, String(evaluatedProperty.value))
            }

            const evaluatedValue = this.assignmentOperatorHandler(
                astNode.operator,
                evaluatedLeft,
                () => {
                    this.traverseExec(astNode.right, options)
                    return this.popMemval()
                }
            )

            // remove the evaluatedProperty and evaluatedObject from the memval
            this.popMemval()
            this.popMemval()

            if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
                const stringProperty = String(evaluatedProperty.value)
                this.writeProperty(evaluatedObject.ref, stringProperty, evaluatedValue)
                this.pushMemval(evaluatedValue)
                this.addEvaluatedStep(astNode)
            } else {
                this.pushMemval(evaluatedValue)
                this.addEvaluatedStep(astNode)
            }
        } else {
            const identifier = this.getIdentifierFromPattern(astNode.left)
            if (identifier) {
                const lookupResult = this.lookupVariable(identifier.name)
                if (lookupResult) {
                    const evaluatedLeft = lookupResult.variable.value
                    const evaluatedValue = this.assignmentOperatorHandler(
                        astNode.operator,
                        evaluatedLeft,
                        () => {
                            this.traverseExec(astNode.right, options)
                            return this.popMemval()
                        }
                    )

                    this.writeVariable(
                        identifier.name,
                        evaluatedValue,
                        lookupResult.variable.declarationType,
                        options.parentScopeIndex
                    )
                    this.pushMemval(evaluatedValue)
                    this.addEvaluatedStep(astNode)
                } else {
                    this.createErrorObject('ReferenceError', `${identifier.name} is not defined`)
                    this.addThrownStep(astNode)
                }
            }
        }
    }
}

execHandlers["ConditionalExpression"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    this.traverseExec(astNode.test, options)

    const evaluatedTest = this.popMemval()
    const testBool = this.toBoolean(evaluatedTest)
    if (testBool) {
        this.traverseExec(astNode.consequent, options)
    } else {
        this.traverseExec(astNode.alternate, options)
    }

    this.addEvaluatedStep(astNode)
}

execHandlers["ArrayExpression"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    for (const element of astNode.elements) {
        if (element) {
            this.traverseExec(element, options)
        } else {
            this.pushMemval(JS_VALUE_UNDEFINED)
        }
    }

    const elements: JSValue[] = []
    forEach(astNode.elements, () => {
        elements.unshift(this.popMemval())
    })

    this.createHeapObject({ elements })
    this.pushMemval({ type: "reference", ref: this.getLastRef() })
    this.addEvaluatedStep(astNode)
}

execHandlers["ObjectExpression"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    const properties: Record<string, JSValue> = {}
    for (const property of astNode.properties) {
        this.traverseExec(property.value, options)
    }

    for (let i = astNode.properties.length - 1; i >= 0; i--) {
        const property = astNode.properties[i]
        const keyNode = property.key
        const key = keyNode.name || keyNode.value
        properties[key] = this.popMemval()
    }

    this.createHeapObject({ properties })
    this.pushMemval({ type: "reference", ref: this.getLastRef() })
    this.addEvaluatedStep(astNode)
}


execHandlers["MemberExpression"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    this.traverseExec(astNode.object, options)

    let evaluatedValue: JSValue = JS_VALUE_UNDEFINED

    const evaluatedObject = this.readMemval()
    if (evaluatedObject.type === "reference") {
        if (astNode.computed) {
            this.traverseExec(astNode.property, options)
            const evaluatedProperty = this.popMemval()
            evaluatedValue = this.readProperty(evaluatedObject.ref, evaluatedProperty.value)
        } else {
            evaluatedValue = this.readProperty(evaluatedObject.ref, astNode.property.name)
        }
    }

    if (evaluatedObject.type === "primitive") {
        if (astNode.computed) {
            this.traverseExec(astNode.property, options)
            const evaluatedProperty = this.popMemval()

            if (evaluatedObject === JS_VALUE_UNDEFINED) {
                this.popMemval()
                this.createErrorObject('TypeError', `Cannot read properties of undefined (reading ${evaluatedProperty.value})`)
                this.addThrownStep(astNode)
            }
        } else {
            if (evaluatedObject === JS_VALUE_UNDEFINED) {
                this.popMemval()
                this.createErrorObject('TypeError', `Cannot read properties of undefined (reading ${astNode.property.name})`)
                this.addThrownStep(astNode)
            }
        }
    }

    this.popMemval()
    this.pushMemval(evaluatedValue)
    return this.addEvaluatedStep(astNode)
}


execHandlers["ArrowFunctionExpression"] = function (astNode) {
    this.addEvaluatingStep(astNode)

    this.createHeapObject({ node: astNode })
    this.pushMemval({ type: "reference", ref: this.getLastRef() })
    this.addEvaluatedStep(astNode)
}

execHandlers["IfStatement"] = function (astNode, options) {
    this.addExecutingStep(astNode)

    this.traverseExec(astNode.test, options)
    const evaluatedTest = this.popMemval()
    const testBool = this.toBoolean(evaluatedTest)
    if (testBool) {
        this.traverseExec(astNode.consequent, options)
    } if (astNode.alternate) {
        this.traverseExec(astNode.alternate, options)
    }

    this.addExecutedStep(astNode)
}


execHandlers["UpdateExpression"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    if (astNode.argument.type === "MemberExpression") {
        const memberExpression = astNode.argument
        this.traverseExec(memberExpression.object, options)

        if (memberExpression.computed) {
            this.traverseExec(memberExpression.property, options)
        } else {
            const propertyNode = memberExpression.property
            if (propertyNode.type === 'Identifier' || propertyNode.type === 'PrivateIdentifier') {
                this.pushMemval({ type: "primitive", value: propertyNode.name })
            }
        }

        if (this.readMemval(1) === JS_VALUE_UNDEFINED) {
            const evaluatedProperty = this.popMemval()
            this.popMemval()
            this.createErrorObject('TypeError', `Cannot read properties of undefined (reading '${evaluatedProperty.value}')`)
            this.addThrownStep(astNode)
        }

        const evaluatedProperty = this.popMemval()
        const evaluatedObject = this.popMemval()

        let currentValue: JSValue = JS_VALUE_UNDEFINED
        if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
            currentValue = this.readProperty(evaluatedObject.ref, String(evaluatedProperty.value))
        }

        const { newValue, returnValue } = this.updateOperatorHandler(astNode.operator, currentValue, astNode.prefix)
        if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
            const stringProperty = String(evaluatedProperty.value)
            this.writeProperty(evaluatedObject.ref, stringProperty, newValue)
            this.pushMemval(returnValue)
            this.addEvaluatedStep(astNode)
        } else {
            this.pushMemval(returnValue)
            this.addEvaluatedStep(astNode)
        }
    } else if (astNode.argument.type === 'Identifier') {
        const identifier = astNode.argument
        const lookupResult = this.lookupVariable(identifier.name)
        if (lookupResult) {
            const { newValue, returnValue } = this.updateOperatorHandler(astNode.operator, lookupResult.variable.value, astNode.prefix)
            this.writeVariable(
                identifier.name,
                newValue,
                lookupResult.variable.declarationType,
                options.parentScopeIndex
            )
            this.pushMemval(returnValue)
            this.addEvaluatedStep(astNode)
        } else {
            this.createErrorObject('ReferenceError', `${identifier.name} is not defined`)
            this.addThrownStep(astNode)
        }
    } else {
        console.warn(`UpdateExpression: Unhandled argument type - ${astNode.argument.type}`)
    }
}

/* UnaryExpression */
execHandlers["UnaryExpression"] = function (astNode, options) {
    this.addEvaluatingStep(astNode)

    if (astNode.operator === 'delete') {
        if (astNode.argument.type === 'MemberExpression') {
            const memberExpression = astNode.argument
            this.traverseExec(memberExpression.object, options)
            if (memberExpression.computed) {
                this.traverseExec(memberExpression.property, options)
            } else {
                const propertyNode = memberExpression.property
                if (propertyNode.type === 'Identifier' || propertyNode.type === 'PrivateIdentifier') {
                    this.pushMemval({ type: "primitive", value: propertyNode.name })
                }
            }

            const evaluatedProperty = this.popMemval()
            const evaluatedObject = this.popMemval()

            if (evaluatedObject === JS_VALUE_UNDEFINED) {
                this.createErrorObject('TypeError', `Cannot convert undefined or null to object`)
                this.addThrownStep(astNode)
            }

            if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
                const stringProperty = String(evaluatedProperty.value)
                this.deleteProperty(evaluatedObject.ref, stringProperty)
            }
            this.pushMemval({ type: "primitive", value: true })
            this.addEvaluatedStep(astNode)
        } else {
            if (astNode.argument.type === 'Identifier') {
                const lookupResult = this.lookupVariable(astNode.argument.name)
                if (lookupResult) {
                    if (lookupResult.variable.declarationType === 'global') {
                        this.pushMemval({ type: 'primitive', value: true })
                    } else {
                        this.pushMemval({ type: 'primitive', value: false })
                    }
                }
            } else {
                this.traverseExec(astNode.argument, options)
                this.popMemval()
                this.pushMemval({ type: "primitive", value: true })
            }
        }
    } else {
        const isTypeOf = astNode.argument.type === 'Identifier' && astNode.operator === 'typeof'
        this.traverseExec(astNode.argument, { ...options, typeof: isTypeOf })
        const evaluatedValue = this.popMemval()
        const result = this.unaryOperatorHandler(astNode.operator, evaluatedValue)
        this.pushMemval(result)
    }
    this.addEvaluatedStep(astNode)
}

execHandlers["EmptyStatement"] = function (astNode) {
    this.addExecutingStep(astNode)
    this.addExecutedStep(astNode)
}

execHandlers["ForStatement"] = function (astNode, options) {
    this.addExecutingStep(astNode)

    if (astNode.init && !options.for) {
        this.traverseExec(astNode.init, { ...options, for: astNode })
    }

    let evaluatedTest: JSValue = { type: "primitive", value: true }
    do {
        if (astNode.test) {
            this.traverseExec(astNode.test, options)
            evaluatedTest = this.popMemval()
        }

        if (evaluatedTest.value) {
            this.traverseExec(astNode.body, options)

            if (astNode.update) {
                this.traverseExec(astNode.update, options)
                this.popMemval()
            }
        }
    } while (evaluatedTest.value)

    this.addPopScopeStep(astNode, 'loop')
    this.addExecutedStep(astNode)
}