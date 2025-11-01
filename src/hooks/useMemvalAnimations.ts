import { useCallback, useRef } from "react"
import type { MemvalChange } from "@/types/simulator"

interface MemValItem {
    id: string
    value: string
    type: string
    targetRef?: string
    x?: number
    y?: number
    animation?: 'slide-in' | 'fade-out' | 'none' | 'fade-in'
    showConnection?: boolean
}

const ensureMemvalShape = (item: MemValItem): MemValItem => ({
    ...item,
    animation: item.animation ?? 'none',
    showConnection: item.showConnection ?? true
})

interface MemvalAnimationCallbacks {
    onUpdate: (memval: MemValItem[]) => void
    onComplete: () => void
}

/**
 * Hook for handling sequential memval animations
 * 
 * Processes memval changes (push/pop) one at a time with animations:
 * - Push operations: slide-in (forward) or fade-in (backward) animation (500ms)
 * - Pop operations: fade-out animation (500ms)
 * 
 * Each animation completes before the next one starts, maintaining order.
 * 
 * This hook handles both forward and backward navigation:
 * - Forward: Push → slide-in (left to right), Pop → fade-out
 * - Backward: Reversed changes are passed in, so push becomes pop (fade-out), pop becomes push (fade-in)
 * 
 * @example
 * const { processSequentially, clearAnimations } = useMemvalAnimations()
 * 
 * // Forward step
 * processSequentially(changes, baseMemval, {
 *   onUpdate: (updated) => setMemval(updated),
 *   onComplete: () => console.log('Done!')
 * }, 'forward')
 * 
 * // Backward step (with reversed changes)
 * const reversed = [...changes].reverse().map(c => ({
 *   type: c.type === 'push' ? 'pop' : 'push',
 *   value: c.value
 * }))
 * processSequentially(reversed, baseMemval, callbacks, 'backward')
 */
export const useMemvalAnimations = () => {
    const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const timeoutRefsRef = useRef<NodeJS.Timeout[]>([])
    const isCancelledRef = useRef(false)

    const clearAnimations = useCallback(() => {
        // Set cancellation flag to stop any ongoing animation chains
        isCancelledRef.current = true

        // Clear all pending timeouts
        timeoutRefsRef.current.forEach(timeout => clearTimeout(timeout))
        timeoutRefsRef.current = []

        if (animationTimeoutRef.current) {
            clearTimeout(animationTimeoutRef.current)
            animationTimeoutRef.current = null
        }
    }, [])

    const processSequentially = useCallback((
        changes: MemvalChange[],
        baseMemval: MemValItem[],
        callbacks: MemvalAnimationCallbacks,
        direction: 'forward' | 'backward' = 'forward'
    ) => {
        // Reset cancellation flag when starting new animation sequence
        isCancelledRef.current = false

        if (changes.length === 0) {
            callbacks.onComplete()
            return
        }

        // Track the current state of memval items during animation
        let workingMemval = baseMemval.map(ensureMemvalShape)

        const processChange = (index: number) => {
            // Check if animation was cancelled
            if (isCancelledRef.current) {
                return
            }

            if (index >= changes.length) {
                // All changes processed, clean up any remaining fade-out items
                const timeoutId = setTimeout(() => {
                    // Check again before final update
                    if (isCancelledRef.current) {
                        return
                    }
                    const settledMemval = workingMemval
                        .filter(item => item.animation !== 'fade-out')
                        .map(ensureMemvalShape)
                    callbacks.onUpdate(settledMemval)
                    callbacks.onComplete()
                }, 500)
                timeoutRefsRef.current.push(timeoutId)
                return
            }

            const change = changes[index]
            const animationDuration = 500

            if (change.type === 'pop') {
                // Remove the last item with fade-out animation
                const itemToRemove = workingMemval[workingMemval.length - 1]
                if (itemToRemove) {
                    // Mark the item for fade-out
                    const updatedMemval = workingMemval.map((item, idx) => {
                        if (idx === workingMemval.length - 1) {
                            return {
                                ...item,
                                animation: 'fade-out' as const,
                                showConnection: false
                            }
                        }
                        return item
                    })

                    callbacks.onUpdate(updatedMemval.map(ensureMemvalShape))

                    // After animation, remove the item and process next change
                    const timeoutId = setTimeout(() => {
                        if (isCancelledRef.current) {
                            return
                        }
                        workingMemval = workingMemval.slice(0, -1)
                        const filteredMemval = workingMemval
                            .filter(item => item.animation !== 'fade-out')
                            .map(ensureMemvalShape)
                        callbacks.onUpdate(filteredMemval)
                        processChange(index + 1)
                    }, animationDuration)
                    timeoutRefsRef.current.push(timeoutId)
                } else {
                    processChange(index + 1)
                }
            } else if (change.type === 'push') {
                // Add new item with animation (slide-in for forward, fade-in for backward)
                let displayValue: string
                let targetRef: string | undefined
                if (change.value.type === 'primitive') {
                    displayValue = String(change.value.value)
                    targetRef = undefined
                } else {
                    displayValue = `<Reference to ${change.value.ref}>`
                    targetRef = `obj-${change.value.ref}`
                }

                // Use slide-in for forward, fade-in for backward
                const animationType: 'slide-in' | 'fade-in' = direction === 'forward' ? 'slide-in' : 'fade-in'

                const newItem: MemValItem = {
                    id: `memval-${workingMemval.length}`,
                    value: displayValue,
                    type: change.value.type,
                    targetRef,
                    animation: animationType,
                    showConnection: false
                }

                workingMemval = [...workingMemval, newItem]
                callbacks.onUpdate(workingMemval.map(ensureMemvalShape))

                // After animation completes, remove animation class and process next change
                const timeoutId = setTimeout(() => {
                    if (isCancelledRef.current) {
                        return
                    }
                    workingMemval = workingMemval.map(item => {
                        // Remove both slide-in and fade-in animations
                        if (item.animation === 'slide-in' || item.animation === 'fade-in') {
                            return {
                                ...item,
                                animation: 'none' as const,
                                showConnection: true
                            }
                        }
                        if (item.showConnection === undefined) {
                            return { ...item, showConnection: true }
                        }
                        return item
                    })
                    callbacks.onUpdate(workingMemval.map(ensureMemvalShape))
                    processChange(index + 1)
                }, animationDuration)
                timeoutRefsRef.current.push(timeoutId)
            } else {
                processChange(index + 1)
            }
        }

        // Start processing from the first change
        processChange(0)
    }, [])

    return {
        processSequentially,
        clearAnimations,
        animationTimeoutRef
    }
}

