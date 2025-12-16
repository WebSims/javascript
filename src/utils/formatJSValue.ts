import { JSValue, Heap, HeapObject } from "@/types/simulator"

export type FormattedValue = {
    display: string
    type: "primitive" | "reference"
    primitiveType?: "string" | "number" | "boolean" | "null" | "undefined" | "bigint" | "symbol"
    ref?: number
}

/**
 * Format a JSValue for display in the UI
 * @param value - The JSValue to format
 * @param heap - Optional heap for resolving references
 * @returns FormattedValue with display string and metadata
 */
export const formatJSValue = (value: JSValue, heap?: Heap): FormattedValue => {
    if (value.type === "primitive") {
        const primitiveValue = value.value

        if (primitiveValue === null) {
            return { display: "null", type: "primitive", primitiveType: "null" }
        }

        if (primitiveValue === undefined) {
            return { display: "undefined", type: "primitive", primitiveType: "undefined" }
        }

        if (typeof primitiveValue === "string") {
            return { display: `"${primitiveValue}"`, type: "primitive", primitiveType: "string" }
        }

        if (typeof primitiveValue === "number") {
            if (Number.isNaN(primitiveValue)) {
                return { display: "NaN", type: "primitive", primitiveType: "number" }
            }
            if (!Number.isFinite(primitiveValue)) {
                return { display: primitiveValue > 0 ? "Infinity" : "-Infinity", type: "primitive", primitiveType: "number" }
            }
            return { display: String(primitiveValue), type: "primitive", primitiveType: "number" }
        }

        if (typeof primitiveValue === "boolean") {
            return { display: String(primitiveValue), type: "primitive", primitiveType: "boolean" }
        }

        if (typeof primitiveValue === "bigint") {
            return { display: `${primitiveValue}n`, type: "primitive", primitiveType: "bigint" }
        }

        if (typeof primitiveValue === "symbol") {
            return { display: String(primitiveValue), type: "primitive", primitiveType: "symbol" }
        }

        return { display: String(primitiveValue), type: "primitive" }
    }

    // Reference type
    const ref = value.ref
    
    if (heap && heap[ref]) {
        const heapObject = heap[ref]
        return {
            display: formatHeapObjectPreview(heapObject),
            type: "reference",
            ref
        }
    }

    return { display: `Ref#${ref}`, type: "reference", ref }
}

/**
 * Format a heap object for a short preview display
 */
const formatHeapObjectPreview = (obj: HeapObject): string => {
    switch (obj.type) {
        case "array":
            const len = obj.elements.length
            return len <= 3
                ? `[${len} items]`
                : `[${len} items]`
        case "function":
            return "ƒ()"
        case "object":
            const keys = Object.keys(obj.properties)
            return keys.length <= 2
                ? `{${keys.join(", ")}}`
                : `{${keys.slice(0, 2).join(", ")}, ...}`
        default:
            return "{...}"
    }
}

/**
 * Get a short display string for a JSValue (for inline display)
 */
export const formatJSValueShort = (value: JSValue, heap?: Heap): string => {
    return formatJSValue(value, heap).display
}
