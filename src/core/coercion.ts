import * as ESTree from "estree"
import { JSValue, HEAP_OBJECT_TYPE, PrimitiveValue, CoerceHandlerMap, HeapObject } from "../types/simulation"

/**
 * JavaScript Type Coercion Utilities
 * Implements ECMAScript Abstract Operations for type conversion
 */

/**
 * Simplified coercion using built-in JavaScript methods
 */

export const coerceHandlers = {} as CoerceHandlerMap

coerceHandlers['toBoolean'] = function (jsValue: JSValue): boolean {
    if (jsValue.type === "primitive" && typeof jsValue.value === "boolean")
        return jsValue.value

    let booleanResult: boolean
    if (jsValue.type === "primitive") {
        booleanResult = Boolean(jsValue.value)
    } else {
        booleanResult = true // Objects are always truthy
    }

    // const coercion = {
    //     type: COERCION_TYPE.TO_BOOLEAN,
    //     from: value,
    //     to: result,
    //     operation: "to_boolean"
    // }

    return booleanResult
}

coerceHandlers['toString'] = function (jsValue: JSValue): string {
    if (jsValue.type === "primitive" && typeof jsValue.value === "string")
        return jsValue.value

    let stringResult: string
    if (jsValue.type === "primitive") {
        stringResult = String(jsValue.value)
    } else {
        const primitiveValue = this.toPrimitive(jsValue)
        stringResult = String(primitiveValue)
    }

    // const coercion = {
    //     type: COERCION_TYPE.TO_STRING,
    //     from: jsValue,
    //     to: stringResult,
    //     operation: "to_string"
    // }
    return stringResult
}

coerceHandlers['toNumber'] = function (jsValue: JSValue): number {
    if (jsValue.type === "primitive" && typeof jsValue.value === "number")
        return jsValue.value

    let numberResult: number
    if (jsValue.type === "primitive") {
        numberResult = Number(jsValue.value)
    } else {
        const primitiveValue = this.toPrimitive(jsValue)
        numberResult = Number(primitiveValue)
    }

    // const coercion = {
    //     type: COERCION_TYPE.TO_NUMBER,
    //     from: jsValue,
    //     to: numberResult,
    //     operation: "to_number"
    // }
    return numberResult
}

coerceHandlers['toInt32'] = function (jsValue: JSValue): number {
    const num = this.toNumber(jsValue)
    return num | 0 // Convert to 32-bit signed integer
}

coerceHandlers['toUint32'] = function (jsValue: JSValue): number {
    const num = this.toNumber(jsValue)
    return num >>> 0 // Convert to 32-bit unsigned integer
}

/**
 * Abstract operation: ToPrimitive
 * Converts an object to a primitive value
 */
coerceHandlers['toPrimitive'] = function (jsValue: JSValue): PrimitiveValue {
    if (jsValue.type === "primitive") {
        return jsValue.value
    }

    const heapObj = this.getHeapObject(jsValue.ref)
    let primitiveResult: PrimitiveValue

    if (heapObj.type === HEAP_OBJECT_TYPE.ARRAY) {
        // Arrays convert to their string representation
        const elements = heapObj.elements.map(el => {
            if (el.type === "primitive") {
                return String(el.value)
            } else {
                return this.toPrimitive(el)
            }
        })
        primitiveResult = elements.join(",")
    } else if (heapObj.type === HEAP_OBJECT_TYPE.FUNCTION) {
        if (heapObj.node.type === "FunctionDeclaration") {
            primitiveResult = `function ${heapObj.node.id?.name || 'anonymous'}() { [native code] }`
        } else if (heapObj.node.type === "ArrowFunctionExpression") {
            primitiveResult = `() => { [native code] }`
        } else {
            primitiveResult = "[object Function]"
        }
    } else {
        primitiveResult = "[object Object]"
    }

    // const coercion = {
    //     type: COERCION_TYPE.TO_PRIMITIVE,
    //     from: jsValue,
    //     to: primitiveResult,
    //     operation: "to_primitive"
    // }
    return primitiveResult
}

coerceHandlers['binaryOperator'] = function (
    operator: ESTree.BinaryOperator,
    left: JSValue,
    right: JSValue,
): { type: "primitive"; value: PrimitiveValue } {

    const abstractEquality = (left: JSValue, right: JSValue): boolean => {
        if (left.type === "reference" && right.type === "reference") {
            return left.ref === right.ref
        }

        if (left.type === "primitive" && right.type === "primitive") {
            if (typeof left.value === typeof right.value) {
                return left.value === right.value
            }

            if ((left.value === null && right.value === undefined) || (left.value === undefined && right.value === null)) {
                return true
            }

            const typesToConvert = ["string", "boolean"]
            if (typesToConvert.includes(typeof left.value) || typesToConvert.includes(typeof right.value)) {
                const leftNum = typeof left.value === "number" ? left.value : this.toNumber(left)
                const rightNum = typeof right.value === "number" ? right.value : this.toNumber(right)
                return leftNum === rightNum
            }
        }

        if (left.type === "reference" && right.type === "primitive") {
            const leftPrimitive = this.toPrimitive(left)
            return abstractEquality({ type: "primitive", value: leftPrimitive }, right)
        }
        if (left.type === "primitive" && right.type === "reference") {
            const rightPrimitive = this.toPrimitive(right)
            return abstractEquality(left, { type: "primitive", value: rightPrimitive })
        }

        console.warn("Abstract equality failed", left, right)
        return false
    }

    switch (operator) {
        // Equality operators
        case "===": {
            if (left.type === "reference" && right.type === "reference") {
                return { type: "primitive", value: left.ref === right.ref }
            }
            if (left.type === "primitive" && right.type === "primitive") {
                return { type: "primitive", value: left.value === right.value }
            }
            return { type: "primitive", value: false }
        }
        case "!==": {
            const result = this.binaryOperatorHandler("===", left, right)
            return { type: "primitive", value: !result.value }
        }
        case "==": {
            return { type: "primitive", value: abstractEquality(left, right) }
        }
        case "!=": {
            const result = abstractEquality(left, right)
            return { type: "primitive", value: !result }
        }

        // Relational operators
        case "<":
        case "<=":
        case ">":
        case ">=": {
            const leftPrimitive = this.toPrimitive(left)
            const rightPrimitive = this.toPrimitive(right)
            if (typeof leftPrimitive === "string" && typeof rightPrimitive === "string") {
                const result = eval(`"${leftPrimitive}" ${operator} "${rightPrimitive}"`)
                return { type: "primitive", value: result }
            } else {
                const leftNum = typeof leftPrimitive === "number" ? leftPrimitive : this.toNumber(left)
                const rightNum = typeof rightPrimitive === "number" ? rightPrimitive : this.toNumber(right)
                const result = eval(`${leftNum} ${operator} ${rightNum}`)
                return { type: "primitive", value: result }
            }
        }

        // Arithmetic operators
        case "+": {
            const leftPrimitive = this.toPrimitive(left)
            const rightPrimitive = this.toPrimitive(right)
            if (typeof leftPrimitive === "string" || typeof rightPrimitive === "string") {
                const leftString = typeof leftPrimitive === "string" ? leftPrimitive : this.toString(left)
                const rightString = typeof rightPrimitive === "string" ? rightPrimitive : this.toString(right)
                const result = eval(`"${leftString}" ${operator} "${rightString}"`)
                return { type: "primitive", value: result }
            } else {
                const leftNum = typeof leftPrimitive === "number" ? leftPrimitive : this.toNumber(left)
                const rightNum = typeof rightPrimitive === "number" ? rightPrimitive : this.toNumber(right)
                const result = eval(`${leftNum} ${operator} ${rightNum}`)
                return { type: "primitive", value: result }
            }
        }
        case "-":
        case "*":
        case "/":
        case "%":
        case "**": {
            const leftPrimitive = this.toPrimitive(left)
            const rightPrimitive = this.toPrimitive(right)
            const leftNum = typeof leftPrimitive === "number" ? leftPrimitive : this.toNumber(left)
            const rightNum = typeof rightPrimitive === "number" ? rightPrimitive : this.toNumber(right)
            const result = eval(`${leftNum} ${operator} ${rightNum}`)
            return { type: "primitive", value: result }
        }

        // Bitwise operators
        case "<<":
        case ">>": {
            const leftInt = this.toInt32(left)
            const rightInt = this.toUint32(right) & 0x1F // Only use lower 5 bits
            const result = eval(`${leftInt} ${operator} ${rightInt}`)
            return { type: "primitive", value: result }
        }
        case ">>>": {
            const leftInt = this.toUint32(left)
            const rightInt = this.toUint32(right) & 0x1F // Only use lower 5 bits
            const result = leftInt >>> rightInt
            return { type: "primitive", value: result }
        }
        case "|":
        case "^":
        case "&": {
            const leftInt = this.toInt32(left)
            const rightInt = this.toInt32(right)
            const result = eval(`${leftInt} ${operator} ${rightInt}`)
            return { type: "primitive", value: result }
        }

        // Special operators
        case "in": {
            const prop = this.toString(left)
            if (right.type === "reference") {
                const obj = this.getHeapObject(right.ref)
                const hasProperty = prop in obj.properties ||
                    (obj.type === HEAP_OBJECT_TYPE.ARRAY && !isNaN(Number(prop)) && Number(prop) < obj.elements.length) ||
                    (obj.type === HEAP_OBJECT_TYPE.ARRAY && prop === "length")
                return { type: "primitive", value: hasProperty }
            } else {
                throw new Error(`TypeError: Cannot use 'in' operator to search for '${prop}' in '${right.value}'`)
            }
        }
        case "instanceof": {
            // Simplified instanceof check
            if (left.type !== "reference" || right.type !== "reference") {
                return { type: "primitive", value: false }
            }
            // This would need more complex prototype chain checking in a full implementation
            return { type: "primitive", value: false }
        }

        default:
            throw new Error(`Unsupported binary operator: ${operator}`)
    }
}

coerceHandlers['assignmentOperator'] = function (
    operator: ESTree.AssignmentOperator,
    left: JSValue,
    right: JSValue,
): JSValue {
    // Remove the '=' from compound assignment operators
    const binaryOp = operator.slice(0, -1) as ESTree.BinaryOperator

    switch (operator) {
        case "=":
            return right // No coercion for simple assignment
        case "||=": {
            const leftBool = this.toBoolean(left)
            if (leftBool) {
                return left
            } else {
                return right
            }
        }
        case "&&=": {
            const leftBool = this.toBoolean(left)
            if (leftBool) {
                return right
            } else {
                return left
            }
        }
        case "??=": {
            if (left.type === "primitive" && (left.value === null || left.value === undefined)) {
                return right
            } else {
                return left
            }
        }
        default:
            return this.binaryOperatorHandler(binaryOp, left, right)
    }
}

coerceHandlers['updateOperator'] = function (
    operator: ESTree.UpdateOperator,
    operand: JSValue,
    isPrefix: boolean
): { newValue: JSValue, returnValue: JSValue } {
    const operandNum = this.toNumber(operand)

    switch (operator) {
        case "++": {
            const newValue = { type: "primitive", value: operandNum + 1 } as const
            const returnValue = isPrefix ? newValue : { type: "primitive", value: operandNum } as const
            return { newValue, returnValue }
        }
        case "--": {
            const newValue = { type: "primitive", value: operandNum - 1 } as const
            const returnValue = isPrefix ? newValue : { type: "primitive", value: operandNum } as const
            return { newValue, returnValue }
        }
        default:
            throw new Error(`Unsupported update operator: ${operator}`)
    }
}