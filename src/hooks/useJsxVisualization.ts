/**
 * Main hook orchestrating JSX-based memory visualization
 * 
 * Architecture:
 * - Combines useMemvalAnimations and useVisualizationData hooks
 * - Detects step changes (forward/backward/jump)
 * - Triggers sequential animations for single forward and backward steps
 * - Handles immediate rendering for jumps and multi-step navigation
 * 
 * Flow for forward single step:
 * 1. Transform new memory snapshot
 * 2. Calculate layout for heap and scopes
 * 3. Keep previous memval state
 * 4. Process memval changes sequentially with animations
 *    - Push: slide-in animation (left to right)
 *    - Pop: fade-out animation
 * 5. Update state after each animation completes
 * 
 * Flow for backward single step:
 * 1. Get previous step's memval changes
 * 2. Reverse the changes (push → pop, pop → push)
 * 3. Process in reverse order with animations
 *    - Original push → fade-out (removing item)
 *    - Original pop → fade-in (adding item back)
 * 4. Update state after each animation completes
 * 
 * @param currentStep - Current execution step
 * @param steps - All execution steps
 * @returns Visualization data with memval, heap, scopes, and connections
 */

import { useEffect, useRef, useState } from "react"
import type { ExecStep } from "@/types/simulator"
import { useMemvalAnimations } from "./useMemvalAnimations"
import { transformMemorySnapshot, calculateLayout, type VisualizationData, type MemValItem } from "@/utils/visualizationData"

export const useJsxVisualization = (currentStep: ExecStep | null, steps: ExecStep[]) => {
    const [visualizationData, setVisualizationData] = useState<VisualizationData | null>(null)
    const previousStepRef = useRef<number | null>(null)
    const previousMemvalRef = useRef<MemValItem[]>([])

    const { processSequentially, clearAnimations, animationTimeoutRef } = useMemvalAnimations()

    useEffect(() => {
        // Clear any pending animations when step changes
        clearAnimations()

        const data = transformMemorySnapshot(currentStep, steps)
        if (data) {
            // Detect if this is a single step change
            if (previousStepRef.current !== null && currentStep) {
                const stepDiff = currentStep.index - previousStepRef.current

                // Handle single forward step with animations
                if (stepDiff === 1 && currentStep.memvalChanges && currentStep.memvalChanges.length > 0) {
                    // First, update heap and scopes immediately (no animation)
                    calculateLayout(data).then(positionedData => {
                        // Set initial state with previous memval
                        setVisualizationData({
                            ...positionedData,
                            memval: previousMemvalRef.current
                        })

                        // Then process memval changes sequentially
                        processSequentially(
                            currentStep.memvalChanges,
                            previousMemvalRef.current,
                            {
                                onUpdate: (updatedMemval) => {
                                    setVisualizationData(prev => {
                                        if (!prev) return null
                                        return { ...prev, memval: updatedMemval }
                                    })
                                },
                                onComplete: () => {
                                    console.log("Forward animations completed")
                                }
                            },
                            'forward'
                        )

                        // Store final memval state for next comparison
                        previousMemvalRef.current = positionedData.memval

                        // Set timeout to track animation completion
                        const totalAnimationTime = currentStep.memvalChanges.length * 500
                        animationTimeoutRef.current = setTimeout(() => {
                            animationTimeoutRef.current = null
                        }, totalAnimationTime)
                    })

                    // Update previous step reference
                    if (currentStep) {
                        previousStepRef.current = currentStep.index
                    }
                    return
                }

                // Handle single backward step with reversed animations
                if (stepDiff === -1) {
                    // Get the previous step (the one we were just on)
                    const previousStep = steps.find(s => s.index === previousStepRef.current)

                    if (previousStep?.memvalChanges && previousStep.memvalChanges.length > 0) {
                        // First, update heap and scopes immediately (no animation)
                        calculateLayout(data).then(positionedData => {
                            // Set initial state with previous memval
                            setVisualizationData({
                                ...positionedData,
                                memval: previousMemvalRef.current
                            })

                            // Reverse the changes: push → fade-out, pop → fade-in
                            // Process in reverse order
                            const reversedChanges = [...previousStep.memvalChanges].reverse().map(change => ({
                                type: change.type === 'push' ? 'pop' as const : 'push' as const,
                                value: change.value
                            }))

                            // Process reversed changes sequentially
                            processSequentially(
                                reversedChanges,
                                previousMemvalRef.current,
                                {
                                    onUpdate: (updatedMemval) => {
                                        setVisualizationData(prev => {
                                            if (!prev) return null
                                            return { ...prev, memval: updatedMemval }
                                        })
                                    },
                                    onComplete: () => {
                                        console.log("Backward animations completed")
                                    }
                                },
                                'backward'
                            )

                            // Store final memval state for next comparison
                            previousMemvalRef.current = positionedData.memval

                            // Set timeout to track animation completion
                            const totalAnimationTime = reversedChanges.length * 500
                            animationTimeoutRef.current = setTimeout(() => {
                                animationTimeoutRef.current = null
                            }, totalAnimationTime)
                        })

                        // Update previous step reference
                        if (currentStep) {
                            previousStepRef.current = currentStep.index
                        }
                        return
                    }
                }
            }

            // For non-sequential cases (jumps, backward, initial load), render directly without animation
            // This ensures rapid step changes don't trigger animations
            calculateLayout(data).then(positionedData => {
                // Remove any animation flags from memval items
                const memvalWithoutAnimation = positionedData.memval
                    .filter(item => item.animation !== 'fade-out')
                    .map(item => ({ ...item, animation: 'none' as const }))

                setVisualizationData({
                    ...positionedData,
                    memval: memvalWithoutAnimation
                })
                previousMemvalRef.current = memvalWithoutAnimation
            })
        }

        // Update previous step reference
        if (currentStep) {
            previousStepRef.current = currentStep.index
        }

        // Cleanup function
        return () => {
            clearAnimations()
        }
    }, [currentStep, steps, processSequentially, clearAnimations, animationTimeoutRef])

    return visualizationData
}

