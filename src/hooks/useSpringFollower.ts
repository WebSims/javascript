import { useEffect, useRef, useState } from 'react'

interface UseSpringFollowerOptions {
    lagMs?: number // desired settling time in milliseconds
    snapEps?: number // px – allow small springy wiggle but stop tiny overshoot
    debug?: boolean
}

export const useSpringFollower = (
    target: number,
    { lagMs = 200, snapEps = 10 }: UseSpringFollowerOptions = {}
) => {
    // Spring state (mutable refs avoid rerenders)
    const x = useRef(target) // position
    const v = useRef(0) // velocity
    const targetRef = useRef(target) // desired x
    const [currentX, setCurrentX] = useState(target) // reactive state for UI updates

    // Spring constants (ζ = 1 → critical damping)
    const tau = lagMs / 1000 // seconds
    const w0 = 4.6 / tau // rad s⁻¹ (1 % settling ≈ 4.6/ω₀)
    const stiffness = w0 * w0 // ω₀²
    const damping = 2 * w0 // 2ζω₀

    // Update target when it changes
    useEffect(() => {
        targetRef.current = target
    }, [target])

    // Animation loop – integrates the spring each frame
    useEffect(() => {
        let last = performance.now()
        let raf: number

        const step = () => {
            const now = performance.now()
            let dt = (now - last) / 1000 // seconds
            if (dt > 0.05) dt = 0.05 // clamp huge gaps (tab switch)
            last = now

            // Critically‑damped spring integration (explicit Euler)
            const a = stiffness * (targetRef.current - x.current) - damping * v.current
            v.current += a * dt
            x.current += v.current * dt

            /**
             * Overshoot guard — if we crossed past the target *this frame* and the
             * remaining gap is tiny (< SNAP_EPS px), snap to target & stop.
             */
            const dirAfter = Math.sign(targetRef.current - x.current)
            if (dirAfter !== Math.sign(v.current) && Math.abs(targetRef.current - x.current) <= snapEps) {
                x.current = targetRef.current
                v.current = 0
            }

            // Update reactive state for UI
            setCurrentX(x.current)

            raf = requestAnimationFrame(step)
        }

        raf = requestAnimationFrame(step)
        return () => cancelAnimationFrame(raf)
    }, [stiffness, damping, snapEps])

    // Return current position
    return currentX
} 