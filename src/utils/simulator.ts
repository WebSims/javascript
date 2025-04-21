import { ESNode, Program, VariableDeclarator, Identifier, Literal, VariableDeclaration, ArrayExpression, ObjectExpression, Property, ArrowFunctionExpression, ExpressionStatement } from "hermes-parser"
import { ExecStep, JSValue, Scope, Heap, MemoryChange, HeapObject, HeapRef, Declaration, TDZ, ScopeType } from "../types/simulation"
import { cloneDeep } from "lodash" // Import cloneDeep from lodash
import { CallExpression } from "typescript"

/**
 * Simulates the execution of JavaScript code represented by an AST.
 * Performs a two-pass process: hoisting followed by execution.
 *
 * @param programNode The root Program node of the AST.
 * @returns An array of execution steps representing the simulation.
 */
export const simulateExecution = (astNode: ESNode | null): ExecStep[] => {
    console.log({ astNode })
    // Ensure we have a valid Program node
    if (!astNode) {
        console.error("Invalid AST provided to simulateExecution.")
        return []
    }

    const steps: ExecStep[] = []
    const scopes: Scope[] = [{ type: "global", variables: {} }] // Start with global scope
    const heap: Heap = {} // Use const
    let nextRef: HeapRef = 0
    let stepCounter: number = 0

    // --- Helper Functions ---

    const getNextRef = (): HeapRef => nextRef++

    const createMemorySnapshot = (): ExecStep["memorySnapshot"] => {
        // Crucial: Use a reliable deep copy mechanism here!
        // Use lodash cloneDeep
        return cloneDeep({ scopes, heap })
    }

    const addStep = (stepData: Omit<ExecStep, "index" | "memorySnapshot">): void => {
        const snapshot = createMemorySnapshot()
        steps.push({
            ...stepData,
            index: stepCounter++,
            memorySnapshot: snapshot,
        })
    }

    // --- Memory Manipulation Helpers (Simplified placeholders) ---
    const newScope = (type: ScopeType): number => {
        const newScopeIndex = scopes.length
        scopes.push({ type, variables: {} })
        return newScopeIndex
    }

    const allocateHeapObject = (obj: HeapObject): HeapRef => {
        const ref = getNextRef()
        heap[ref] = obj
        // TODO: Consider a step for heap allocation?
        return ref
    }

    const lookupVariable = (name: string, startingScopeIndex: number): { value: JSValue | undefined, scopeIndex: number } => {
        for (let i = startingScopeIndex; i >= 0; i--) {
            if (Object.prototype.hasOwnProperty.call(scopes[i].variables, name)) {
                return { value: scopes[i].variables[name], scopeIndex: i }
            }
        }
        return { value: undefined, scopeIndex: -1 } // Not found
    }

    const newDeclaration = (name: string, kind: Extract<MemoryChange, { type: 'declaration' }>['declarations'][number]['kind'], scopeIndex: number, initialValue: JSValue): (Declaration | undefined) => {
        if (scopeIndex < 0 || scopeIndex >= scopes.length) {
            console.error(`Invalid scopeIndex ${scopeIndex} for declaring ${name}`)
            return
        }
        scopes[scopeIndex].variables[name] = initialValue
        return { kind, variableName: name, initialValue }
        // Step generation happens in the passes
    }

    const writeVariable = (name: string, value: JSValue, scopeIndex: number): number => {
        const lookup = lookupVariable(name, scopeIndex)
        if (lookup.scopeIndex !== -1) {
            scopes[lookup.scopeIndex].variables[name] = value
            return lookup.scopeIndex
        }
        // Handle potential ReferenceError or global assignment (if intended)
        console.warn(`Attempted to write to undeclared variable ${name}`)
        // For simplicity, let's assign to global if not found (like non-strict mode)
        scopes[0].variables[name] = value // Or throw error
        return 0 // Indicate it wasn't found in declared scopes
    }

    // ... more helpers for get/set property, value resolution, etc. ...

    // --- Creation Pass --- 
    const creationPhase = (nodes: ESNode[], currentScopeIndex: number): void => {
        console.log("Starting Creation Pass for scope:", currentScopeIndex)

        const declarations: Declaration[] = []

        for (const node of nodes) {
            if (!node) continue

            switch (node.type) {
                case "FunctionDeclaration":
                    {
                        // Check type string, id exists, and then CAST id to Identifier to access properties
                        if (node.id) {
                            // Cast node.id to Identifier AFTER checking it exists
                            const idNode = node.id as Identifier
                            if (idNode.type === 'Identifier') { // Check type on the casted object
                                const functionName = idNode.name // Access name from casted object
                                // 1. Allocate Function Object on Heap
                                const functionObject: HeapObject = {
                                    type: "function",
                                    node: node
                                }
                                const ref = allocateHeapObject(functionObject)

                                const declaration = newDeclaration(functionName, "function", currentScopeIndex, { type: "reference", ref })
                                if (declaration) {
                                    declarations.push(declaration)
                                }

                            } else {
                                console.warn("FunctionDeclaration id is not an Identifier?", idNode)
                            }
                        } else {
                            console.warn("Hoisting unnamed FunctionDeclaration?", node)
                        }
                    }
                    break;

                case "VariableDeclaration":
                    {
                        if (node.kind === "var") {
                            console.log(node.declarations)
                            for (const declarator of (node.declarations as VariableDeclarator[])) {
                                if (declarator.id?.type === "Identifier") {
                                    const idNode = declarator.id as Identifier
                                    const varName = idNode.name
                                    const initialValue: JSValue = { type: "primitive", value: undefined }
                                    const declaration = newDeclaration(varName, "var", currentScopeIndex, initialValue)
                                    if (declaration) {
                                        declarations.push(declaration)
                                    }
                                } else {
                                    console.warn("Unhandled var declaration pattern in creation:", declarator.id?.type)
                                }
                            }
                        }
                        if (node.kind === "let" || node.kind === "const") {
                            console.log(node.declarations)
                            for (const declarator of (node.declarations as VariableDeclarator[])) {
                                if (declarator.id?.type === "Identifier") {
                                    const idNode = declarator.id as Identifier
                                    const varName = idNode.name
                                    const initialValue: JSValue = TDZ
                                    const declaration = newDeclaration(varName, node.kind, currentScopeIndex, initialValue)
                                    if (declaration) {
                                        declarations.push(declaration)
                                    }
                                } else {
                                    console.warn("Unhandled let/const declaration pattern in creation:", declarator.id?.type)
                                }
                            }
                        }
                    }
                    break;
            }
        }

        addStep({
            phase: "creation",
            scopeIndex: currentScopeIndex,
            memoryChange: { type: "declaration", declarations, scopeIndex: currentScopeIndex },
            nodes: nodes,
        })

        console.log("Finished Creation Pass for scope:", currentScopeIndex)
    }

    // --- Execution Pass --- 
    const executionPhase = (node: ESNode | null, currentScopeIndex: number): JSValue => {
        if (!node) return { type: "primitive", value: undefined }

        console.log("Executing node:", node.type, "in scope:", currentScopeIndex)

        switch (node.type) {
            case "Program":
                {
                    const programBody = (node as Program).body as ESNode[] | undefined // Explicit cast
                    let lastValue: JSValue = { type: "primitive", value: undefined };
                    if (Array.isArray(programBody)) {
                        for (const statement of programBody) {
                            lastValue = executionPhase(statement as ESNode, currentScopeIndex) // Keep cast
                        }
                    }
                    return lastValue
                }

            case "ExpressionStatement":
                {
                    const expressionNode = (node as ExpressionStatement).expression
                    executionPhase(expressionNode, currentScopeIndex)
                }
                break;

            case "BlockStatement":
                {
                    const blockNode = node as BlockStatement;
                    const statements = blockNode.body as ESNode[];
                    for (const statement of statements) {
                        executionPhase(statement, currentScopeIndex)
                    }
                }
                break;

            case "Literal":
                {
                    const literalNode = node as Literal
                    let value: JSValue;
                    const literalValue = literalNode.value

                    if (literalValue === null) {
                        value = { type: "primitive", value: null };
                    } else if (typeof literalValue === 'string' || typeof literalValue === 'number' || typeof literalValue === 'boolean') {
                        value = { type: "primitive", value: literalValue };
                        // Last resort: cast to any to bypass instanceof type check issue
                    } else if (typeof literalValue === 'object' && literalValue !== null && (literalValue as any) instanceof RegExp) {
                        console.warn("RegExp Literal evaluation not fully implemented")
                        value = { type: "primitive", value: literalNode.raw };
                    } else {
                        console.warn("Unhandled Literal type:", typeof literalValue)
                        value = { type: "primitive", value: undefined };
                    }

                    addStep({
                        nodes: [node],
                        phase: "execution",
                        scopeIndex: currentScopeIndex,
                        memoryChange: { type: "none" },
                        evaluatedValue: value,
                    })

                    return value
                }

            case "VariableDeclaration":
                {
                    // node is VariableDeclaration here
                    const varDeclNode = node as VariableDeclaration; // Use imported type

                    if (varDeclNode.kind === "const" && varDeclNode.declarations.length === 0) {
                        console.warn("Unhandled const declaration pattern in execution:", varDeclNode.kind)
                    }

                    if (Array.isArray(varDeclNode.declarations)) {
                        // Handle initialization (declaration happened in hoisting pass)
                        for (const declarator of (varDeclNode.declarations as VariableDeclarator[])) {
                            // Only process declarators that have an initializer
                            if (declarator.id?.type === 'Identifier' && declarator.init) {
                                const idNode = declarator.id as Identifier;
                                const varName = idNode.name;

                                // Evaluate the initializer
                                const evaluatedValue = executionPhase(declarator.init, currentScopeIndex)

                                const targetScopeIndex = writeVariable(varName, evaluatedValue, currentScopeIndex)

                                addStep({
                                    nodes: [declarator.init], // Step associated with the initializer execution
                                    phase: "execution",
                                    scopeIndex: currentScopeIndex, // Execution happens in current scope...
                                    memoryChange: {
                                        type: "write_variable",
                                        scopeIndex: targetScopeIndex, // ...but write happens in the var's scope
                                        variableName: varName,
                                        value: evaluatedValue,
                                    },
                                    evaluatedValue: evaluatedValue // The result of the initializer
                                });
                            }
                        }
                    }
                }
                break; // End of VariableDeclaration case

            case "FunctionDeclaration":
                // Generally skip in execution pass (already hoisted)
                break;

            case "CallExpression":
                {
                    const fnName = (node.callee as Identifier).name;
                    const fnRef = lookupVariable(fnName, currentScopeIndex).value;
                    if (fnRef?.type === "reference") {
                        const fnObject = heap[fnRef.ref];
                        if (fnObject?.type === "function") {
                            const scopeIndex = newScope("function")

                            addStep({
                                nodes: [node],
                                phase: "creation",
                                scopeIndex: currentScopeIndex,
                                memoryChange: { type: "function_call", functionRef: fnRef.ref, scopeIndex },
                            })

                            traverseAST(fnObject.node.body as ESNode, scopeIndex)
                        }
                    }
                }
                break;

            case "AssignmentExpression":
                console.warn("Execution Pass TODO: AssignmentExpression")
                break;

            case "BinaryExpression":
                {
                    const binNode = node as any; // Cast to access left, right, operator
                    const leftValue = executionPhase(binNode.left, currentScopeIndex);
                    const rightValue = executionPhase(binNode.right, currentScopeIndex);

                    let resultValue: JSValue = { type: "primitive", value: undefined };
                    let errorMsg: string | undefined = undefined;

                    // Helper to extract primitive value
                    const getPrimitiveValue = (jsVal: JSValue): number | string | boolean | null | undefined | bigint | symbol => {
                        if (jsVal.type === 'primitive') {
                            return jsVal.value;
                        }
                        console.warn("Binary operation on non-primitive reference not fully handled", jsVal);
                        return NaN;
                    };

                    const leftPrim = getPrimitiveValue(leftValue);
                    const rightPrim = getPrimitiveValue(rightValue);

                    try {
                        switch (binNode.operator) {
                            case '+':
                                if (typeof leftPrim === 'string' || typeof rightPrim === 'string') {
                                    resultValue = { type: "primitive", value: String(leftPrim ?? '') + String(rightPrim ?? '') };
                                } else {
                                    resultValue = { type: "primitive", value: Number(leftPrim) + Number(rightPrim) };
                                }
                                break;
                            case '-': resultValue = { type: "primitive", value: Number(leftPrim) - Number(rightPrim) }; break;
                            case '*': resultValue = { type: "primitive", value: Number(leftPrim) * Number(rightPrim) }; break;
                            case '/': resultValue = { type: "primitive", value: Number(leftPrim) / Number(rightPrim) }; break;
                            case '%': resultValue = { type: "primitive", value: Number(leftPrim) % Number(rightPrim) }; break;
                            case '===': resultValue = { type: "primitive", value: leftPrim === rightPrim }; break;
                            case '!==': resultValue = { type: "primitive", value: leftPrim !== rightPrim }; break;
                            case '<': resultValue = { type: "primitive", value: Number(leftPrim) < Number(rightPrim) }; break;
                            case '<=': resultValue = { type: "primitive", value: Number(leftPrim) <= Number(rightPrim) }; break;
                            case '>': resultValue = { type: "primitive", value: Number(leftPrim) > Number(rightPrim) }; break;
                            case '>=': resultValue = { type: "primitive", value: Number(leftPrim) >= Number(rightPrim) }; break;
                            default:
                                errorMsg = `Operator ${binNode.operator} not implemented`;
                                console.warn(errorMsg);
                                resultValue = { type: "primitive", value: undefined };
                        }
                    } catch (e) {
                        errorMsg = e instanceof Error ? e.message : String(e);
                        console.error(`Error during binary operation ${binNode.operator}:`, errorMsg);
                        resultValue = { type: "primitive", value: undefined };
                    }

                    addStep({
                        node: node,
                        pass: "normal",
                        scopeIndex: currentScopeIndex,
                        memoryChange: { type: "none" },
                        evaluatedValue: errorMsg ? undefined : resultValue,
                        error: errorMsg
                    })
                    return resultValue;
                }


            case "MemberExpression":
                {
                    const memberNode = node as any; // Keep cast
                    const objectValue = executionPhase(memberNode.object, currentScopeIndex); // Use const
                    // Allow null and boolean as potential primitive property keys
                    let propertyKey: string | number | boolean | null | undefined | symbol | bigint = undefined;
                    let propertyKeyValue: JSValue | undefined = undefined;
                    let errorMsg: string | undefined = undefined;
                    let resultValue: JSValue = { type: "primitive", value: undefined };

                    // 1. Determine the property key
                    if (memberNode.computed) {
                        propertyKeyValue = executionPhase(memberNode.property, currentScopeIndex);
                        if (propertyKeyValue.type === 'primitive') {
                            propertyKey = propertyKeyValue.value; // Assign the primitive value directly
                        } else {
                            errorMsg = "TypeError: Computed property key must be primitive";
                            console.error(errorMsg);
                            propertyKey = undefined; // Error state
                        }
                    } else {
                        // Non-computed: property should be an Identifier (or PrivateIdentifier)
                        if (memberNode.property?.type === 'Identifier') {
                            propertyKey = (memberNode.property as Identifier).name;
                        } else if (memberNode.property?.type === 'PrivateIdentifier') {
                            // Basic simulation might not handle private fields correctly
                            errorMsg = "SyntaxError: Private fields not fully supported in simulation";
                            console.warn(errorMsg);
                            propertyKey = `#${(memberNode.property as any).name}` // Represent symbolically
                        }
                        else {
                            errorMsg = "TypeError: Invalid property identifier";
                            console.error(errorMsg);
                        }
                    }

                    // 2. Perform Property Lookup (only if no error determining key)
                    if (!errorMsg && propertyKey !== undefined) {
                        if (objectValue.type === 'reference') {
                            const heapObject = heap[objectValue.ref];
                            if (heapObject) {
                                if (heapObject.type === 'object') {
                                    // Check own properties first
                                    if (Object.prototype.hasOwnProperty.call(heapObject.properties, String(propertyKey))) {
                                        resultValue = heapObject.properties[String(propertyKey)];
                                    } else {
                                        // TODO: Implement prototype chain lookup
                                        console.warn("Prototype chain lookup not implemented");
                                        resultValue = { type: "primitive", value: undefined };
                                    }
                                } else if (heapObject.type === 'array') {
                                    const index = Number(propertyKey); // Attempt conversion
                                    if (Number.isInteger(index) && index >= 0 && index < heapObject.elements.length) {
                                        resultValue = heapObject.elements[index];
                                    } else if (propertyKey === 'length') {
                                        // Handle array.length property
                                        resultValue = { type: "primitive", value: heapObject.elements.length };
                                    } else {
                                        // TODO: Handle array prototype methods/properties
                                        console.warn(`Array property/method '${String(propertyKey)}' access not fully implemented`);
                                        resultValue = { type: "primitive", value: undefined };
                                    }
                                } else if (heapObject.type === 'function') {
                                    // TODO: Handle function properties (length, name, prototype, etc.)
                                    console.warn(`Function property '${String(propertyKey)}' access not implemented`);
                                    resultValue = { type: "primitive", value: undefined };
                                }
                                // else: Other heap types?
                            } else {
                                // Reference points to non-existent heap object (shouldn't usually happen)
                                errorMsg = `Internal Error: Reference ${objectValue.ref} not found in heap`;
                                console.error(errorMsg);
                                resultValue = { type: "primitive", value: undefined };
                            }
                        } else if (objectValue.type === 'primitive' && objectValue.value !== null && objectValue.value !== undefined) {
                            // Property access on primitives (boxing)
                            // TODO: Implement primitive wrapper object behavior (e.g., "hello".length)
                            console.warn(`Property access on primitive type '${typeof objectValue.value}' not fully implemented`);
                            resultValue = { type: "primitive", value: undefined };
                        }
                        else {
                            // Accessing property on null or undefined
                            errorMsg = `TypeError: Cannot read properties of ${objectValue.value === null ? 'null' : 'undefined'} (reading '${String(propertyKey)}')`;
                            console.error(errorMsg);
                            resultValue = { type: "primitive", value: undefined }; // Error state
                        }
                    }
                    // If error occurred determining key, result remains undefined
                    else if (!errorMsg) { // Handle case where propertyKey is undefined but no errorMsg yet
                        errorMsg = "Internal Error: Could not determine property key";
                        console.error(errorMsg);
                    }

                    addStep({
                        node: node,
                        pass: "normal",
                        scopeIndex: currentScopeIndex,
                        memoryChange: { type: "none" }, // Assuming no getters for now
                        evaluatedValue: errorMsg ? undefined : resultValue,
                        error: errorMsg
                    })
                    return resultValue; // Return found value or undefined
                }
            // break; // Not needed after return

            case "ArrayExpression":
                {
                    const arrayNode = node as ArrayExpression;
                    const elements: JSValue[] = [];
                    let errorMsg: string | undefined = undefined;

                    if (Array.isArray(arrayNode.elements)) {
                        for (const elementNode of arrayNode.elements) {
                            if (elementNode === null) {
                                // Handle sparse arrays (empty slot)
                                elements.push({ type: "primitive", value: undefined });
                            } else if ((elementNode as ESNode).type === 'SpreadElement') {
                                errorMsg = "Spread elements in arrays not implemented";
                                console.warn(errorMsg);
                                break;
                            } else {
                                elements.push(executionPhase(elementNode, currentScopeIndex));
                            }
                        }
                    }

                    let resultValue: JSValue = { type: "primitive", value: undefined };
                    if (!errorMsg) {
                        const arrayObject: HeapObject = { type: "array", elements };
                        const ref = allocateHeapObject(arrayObject);
                        resultValue = { type: "reference", ref };

                        addStep({
                            node: node,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: {
                                type: "create_heap_object",
                                ref: ref,
                                value: arrayObject,
                            },
                            evaluatedValue: resultValue,
                        });
                    } else {
                        addStep({
                            node: node,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: { type: "none" },
                            evaluatedValue: undefined,
                            error: errorMsg
                        })
                    }
                    return resultValue;
                }

            case "ObjectExpression":
                {
                    const objectNode = node as ObjectExpression;
                    const properties: Record<string, JSValue> = {};
                    let errorMsg: string | undefined = undefined;

                    if (Array.isArray(objectNode.properties)) {
                        for (const propNodeUntyped of objectNode.properties) {
                            const propNode = propNodeUntyped as ESNode;
                            if (propNode.type === 'Property') {
                                const property = propNode as Property;
                                let key: string | undefined = undefined;

                                if (!property.computed) {
                                    if (property.key.type === 'Identifier') {
                                        key = (property.key as Identifier).name;
                                    } else if (property.key.type === 'Literal') {
                                        key = String((property.key as Literal).value);
                                    } else {
                                        errorMsg = `Unsupported property key type: ${property.key.type}`;
                                        break;
                                    }
                                } else {
                                    errorMsg = "Computed property keys not implemented";
                                    break;
                                }

                                if (property.kind === 'init') {
                                    let value: JSValue;
                                    if (property.shorthand) {
                                        if (key) {
                                            const lookup = lookupVariable(key, currentScopeIndex);
                                            if (lookup.value !== undefined) {
                                                value = lookup.value;
                                            } else {
                                                errorMsg = `ReferenceError: ${key} is not defined (shorthand property)`;
                                                break;
                                            }
                                        } else { continue; }
                                    } else {
                                        value = executionPhase(property.value, currentScopeIndex);
                                    }
                                    if (key !== undefined) {
                                        properties[key] = value;
                                    }
                                } else {
                                    errorMsg = `Property kind ${property.kind} not implemented`;
                                    break;
                                }
                            } else if (propNode.type === 'SpreadElement') {
                                errorMsg = "Spread elements in objects not implemented";
                                break;
                            } else {
                                errorMsg = `Unknown property type in ObjectExpression: ${propNode.type}`;
                                break;
                            }
                        }
                    }

                    let resultValue: JSValue = { type: "primitive", value: undefined };
                    if (!errorMsg) {
                        const objectHeapObject: HeapObject = { type: "object", properties };
                        const ref = allocateHeapObject(objectHeapObject);
                        resultValue = { type: "reference", ref };

                        addStep({
                            node: node,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: {
                                type: "create_heap_object",
                                ref: ref,
                                value: objectHeapObject,
                            },
                            evaluatedValue: resultValue,
                        });
                    } else {
                        addStep({
                            node: node,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: { type: "none" },
                            evaluatedValue: undefined,
                            error: errorMsg
                        })
                    }
                    return resultValue;
                }

            case "ArrowFunctionExpression":
                {
                    const arrowFuncNode = node as ArrowFunctionExpression;

                    // 1. Allocate Function Object on Heap
                    const functionObject: HeapObject = {
                        type: "function",
                        definitionNode: arrowFuncNode, // Store the node itself
                        // CRUCIAL: Arrow functions capture scope lexically
                        closureScopeIndex: currentScopeIndex,
                        // name: undefined // Arrow functions are anonymous unless inferred
                    };
                    const ref = allocateHeapObject(functionObject);
                    const resultValue: JSValue = { type: "reference", ref };

                    // 2. Create Step for the expression evaluation
                    addStep({
                        node: node,
                        pass: "normal",
                        scopeIndex: currentScopeIndex,
                        memoryChange: {
                            type: "create_heap_object",
                            ref: ref,
                            value: functionObject,
                        },
                        evaluatedValue: resultValue, // The reference to the new function
                    });

                    return resultValue;
                }
            // No break needed after return

            case "ConditionalExpression":
                {
                    const condNode = node as any; // Cast to access test, consequent, alternate
                    let resultValue: JSValue = { type: "primitive", value: undefined };
                    let errorMsg: string | undefined = undefined;

                    // 1. Evaluate the test condition
                    const testValue = executionPhase(condNode.test, currentScopeIndex);

                    // 2. Determine truthiness (simplified)
                    let isTestTruthy = false;
                    if (testValue.type === 'primitive') {
                        // Standard JS truthiness check
                        isTestTruthy = Boolean(testValue.value);
                    } else if (testValue.type === 'reference') {
                        // Objects/Arrays/Functions are always truthy
                        isTestTruthy = true;
                    }
                    // If testValue is undefined (e.g., due to an error), it remains falsey

                    // 3. Evaluate the appropriate branch
                    try {
                        if (isTestTruthy) {
                            resultValue = executionPhase(condNode.consequent, currentScopeIndex);
                        } else {
                            resultValue = executionPhase(condNode.alternate, currentScopeIndex);
                        }
                    } catch (e) {
                        errorMsg = `Error during conditional expression execution: ${e instanceof Error ? e.message : String(e)}`;
                        console.error(errorMsg);
                        resultValue = { type: "primitive", value: undefined }; // Indicate error
                    }

                    // 4. Add step for the overall conditional expression result
                    addStep({
                        node: node,
                        pass: "normal",
                        scopeIndex: currentScopeIndex,
                        memoryChange: { type: "none" },
                        // The evaluated value is the result of the chosen branch
                        evaluatedValue: errorMsg ? undefined : resultValue,
                        error: errorMsg
                    })
                    return resultValue;
                }
            // No break needed after return

            default:
                console.warn(`Execution Pass: Unhandled node type - ${node.type}`)
                break;
        }

        // Default return value if no specific value evaluated
        return { type: "primitive", value: undefined }
    }

    // --- Simulation Execution --- 
    function traverseAST(astNode: ESNode, scopeIndex: number) {
        try {
            // Phase 1: Creation
            // Ensure ast.body is treated as an array of ESNodes
            // FunctionDeclaration - Function declarations are completely hoisted with their bodies
            // VariableDeclaration - With var keyword (not let or const)
            // ClassDeclaration - Class declarations are hoisted but remain uninitialized until the class expression is evaluated
            creationPhase(Array.isArray(astNode.body) ? astNode.body : [], scopeIndex)

            // Phase 2: Execution
            executionPhase(astNode, scopeIndex) // Start execution from the Program node in global scope

        } catch (error) {
            console.error("Error during simulation:", error)
            // Potentially add a final error step to the steps array
            // addStep({
            //     node: astNode, // Or find a better node association
            //     pass: "normal",
            //     scopeIndex: scopes.length - 1, // Last known scope
            //     memoryChange: { type: "none" },
            //     error: error instanceof Error ? error.message : String(error)
            // })
        }
    }

    traverseAST(astNode, 0)

    console.log("Simulation finished. Steps:", steps.length)
    return steps
}
