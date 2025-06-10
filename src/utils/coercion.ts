import * as ESTree from "estree"
import { JSValue, HeapObject, HEAP_OBJECT_TYPE, PrimitiveValue } from "../types/simulator"

/**
 * JavaScript Type Coercion Utilities
 * Implements ECMAScript Abstract Operations for type conversion
 */

/**
 * Simplified coercion using built-in JavaScript methods
 */

export const toBoolean = (jsValue: JSValue): PrimitiveValue => {
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

export const toNumber = (jsValue: JSValue, heap: Record<number, HeapObject>): PrimitiveValue => {
    if (jsValue.type === "primitive" && typeof jsValue.value === "number")
        return jsValue.value

    let numberResult: number
    if (jsValue.type === "primitive") {
        numberResult = Number(jsValue.value)
    } else {
        const primitiveValue = toPrimitive(jsValue, heap)
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

export const toInt32 = (jsValue: JSValue, heap: Record<number, HeapObject>): number => {
    const num = toNumber(jsValue, heap)
    return num | 0 // Convert to 32-bit signed integer
}

export const toUint32 = (jsValue: JSValue, heap: Record<number, HeapObject>): number => {
    const num = toNumber(jsValue, heap)
    return num >>> 0 // Convert to 32-bit unsigned integer
}

export const toString = (jsValue: JSValue, heap: Record<number, HeapObject>): string => {
    if (jsValue.type === "primitive" && typeof jsValue.value === "string")
        return jsValue.value

    let stringResult: string
    if (jsValue.type === "primitive") {
        stringResult = String(jsValue.value)
    } else {
        const primitiveValue = toPrimitive(jsValue, heap)
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

/**
 * Abstract operation: ToPrimitive
 * Converts an object to a primitive value
 */
export const toPrimitive = (
    jsValue: JSValue,
    heap: Record<number, HeapObject>
): PrimitiveValue => {
    if (jsValue.type === "primitive") {
        return jsValue.value
    }

    const heapObj = heap[jsValue.ref]
    let primitiveResult: PrimitiveValue

    if (heapObj.type === HEAP_OBJECT_TYPE.ARRAY) {
        // Arrays convert to their string representation
        const elements = heapObj.elements.map(el => {
            if (el.type === "primitive") {
                return String(el.value)
            } else {
                return toPrimitive(el, heap)
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

const abstractEquality = (left: JSValue, right: JSValue, heap: Record<number, HeapObject>): boolean => {
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
            const leftNum = typeof left.value === "number" ? left.value : toNumber(left, heap)
            const rightNum = typeof right.value === "number" ? right.value : toNumber(right, heap)
            return leftNum === rightNum
        }
    }

    if (left.type === "reference" && right.type === "primitive") {
        const leftPrimitive = toPrimitive(left, heap)
        return abstractEquality({ type: "primitive", value: leftPrimitive }, right, heap)
    }
    if (left.type === "primitive" && right.type === "reference") {
        const rightPrimitive = toPrimitive(right, heap)
        return abstractEquality(left, { type: "primitive", value: rightPrimitive }, heap)
    }

    console.warn("Abstract equality failed", left, right)
    return false
}

export const coerceBinaryOperator = (
    operator: ESTree.BinaryOperator,
    left: JSValue,
    right: JSValue,
    heap: Record<number, HeapObject>
): { type: "primitive"; value: PrimitiveValue } => {
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
            const result = coerceBinaryOperator("===", left, right, heap)
            return { type: "primitive", value: !result.value }
        }
        case "==": {
            return { type: "primitive", value: abstractEquality(left, right, heap) }
        }
        case "!=": {
            const result = abstractEquality(left, right, heap)
            return { type: "primitive", value: !result }
        }

        // Relational operators
        case "<":
        case "<=":
        case ">":
        case ">=": {
            const leftPrimitive = toPrimitive(left, heap)
            const rightPrimitive = toPrimitive(right, heap)
            if (typeof leftPrimitive === "string" && typeof rightPrimitive === "string") {
                const result = eval(`"${leftPrimitive}" ${operator} "${rightPrimitive}"`)
                return { type: "primitive", value: result }
            } else {
                const leftNum = typeof leftPrimitive === "number" ? leftPrimitive : toNumber(left, heap)
                const rightNum = typeof rightPrimitive === "number" ? rightPrimitive : toNumber(right, heap)
                const result = eval(`${leftNum} ${operator} ${rightNum}`)
                return { type: "primitive", value: result }
            }
        }

        // Arithmetic operators
        case "+": {
            const leftPrimitive = toPrimitive(left, heap)
            const rightPrimitive = toPrimitive(right, heap)
            if (typeof leftPrimitive === "string" || typeof rightPrimitive === "string") {
                const leftString = typeof leftPrimitive === "string" ? leftPrimitive : toString(left, heap)
                const rightString = typeof rightPrimitive === "string" ? rightPrimitive : toString(right, heap)
                const result = eval(`"${leftString}" ${operator} "${rightString}"`)
                return { type: "primitive", value: result }
            } else {
                const leftNum = typeof leftPrimitive === "number" ? leftPrimitive : toNumber(left, heap)
                const rightNum = typeof rightPrimitive === "number" ? rightPrimitive : toNumber(right, heap)
                const result = eval(`${leftNum} ${operator} ${rightNum}`)
                return { type: "primitive", value: result }
            }
        }
        case "-":
        case "*":
        case "/":
        case "%":
        case "**": {
            const leftPrimitive = toPrimitive(left, heap)
            const rightPrimitive = toPrimitive(right, heap)
            const leftNum = typeof leftPrimitive === "number" ? leftPrimitive : toNumber(left, heap)
            const rightNum = typeof rightPrimitive === "number" ? rightPrimitive : toNumber(right, heap)
            const result = eval(`${leftNum} ${operator} ${rightNum}`)
            return { type: "primitive", value: result }
        }

        // Bitwise operators
        case "<<":
        case ">>": {
            const leftInt = toInt32(left, heap)
            const rightInt = toUint32(right, heap) & 0x1F // Only use lower 5 bits
            const result = eval(`${leftInt} ${operator} ${rightInt}`)
            return { type: "primitive", value: result }
        }
        case ">>>": {
            const leftInt = toUint32(left, heap)
            const rightInt = toUint32(right, heap) & 0x1F // Only use lower 5 bits
            const result = leftInt >>> rightInt
            return { type: "primitive", value: result }
        }
        case "|":
        case "^":
        case "&": {
            const leftInt = toInt32(left, heap)
            const rightInt = toInt32(right, heap)
            const result = eval(`${leftInt} ${operator} ${rightInt}`)
            return { type: "primitive", value: result }
        }

        // Special operators
        case "in": {
            const prop = toString(left, heap)
            if (right.type === "reference") {
                const obj = heap[right.ref]
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

export const coerceAssignmentOperator = (
    operator: ESTree.AssignmentOperator,
    left: JSValue,
    right: JSValue,
    heap: Record<number, HeapObject>
): JSValue => {
    // Remove the '=' from compound assignment operators
    const binaryOp = operator.slice(0, -1) as ESTree.BinaryOperator

    switch (operator) {
        case "=":
            return right // No coercion for simple assignment
        case "||=": {
            const leftBool = toBoolean(left)
            if (leftBool) {
                return left
            } else {
                return right
            }
        }
        case "&&=": {
            const leftBool = toBoolean(left)
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
            return coerceBinaryOperator(binaryOp, left, right, heap)
    }
}