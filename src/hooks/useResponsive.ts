import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 1024 // Standard breakpoint for tablets
const MOBILE_WIDTH_BREAKPOINT = 1024 // Width breakpoint for mobile detection

interface DeviceDetection {
    isMobile: boolean
    isDesktop: boolean
    isMobileDevice: boolean // Based on user agent
    isMobileWidth: boolean // Based on screen width
}

interface UseResponsiveOptions {
    breakpoint?: number
    mobileWidthBreakpoint?: number
    includeUserAgent?: boolean
}

const useResponsive = (options: UseResponsiveOptions = {}): DeviceDetection => {
    const {
        breakpoint = MOBILE_BREAKPOINT,
        mobileWidthBreakpoint = MOBILE_WIDTH_BREAKPOINT,
        includeUserAgent = false
    } = options

    // Initialize state with actual screen size to prevent flash
    const getInitialState = () => {
        if (typeof window === 'undefined') return { isMobile: false, isMobileDevice: false, isMobileWidth: false }

        const windowWidth = window.innerWidth
        const isMobileByWidth = windowWidth <= mobileWidthBreakpoint

        let isMobileByUserAgent = false
        if (includeUserAgent) {
            const userAgent = navigator.userAgent || navigator.vendor || (window as Window & typeof globalThis & { opera?: string }).opera || ''
            const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
            isMobileByUserAgent = mobileRegex.test(userAgent)
        }

        const isMobile = isMobileByUserAgent || isMobileByWidth

        return {
            isMobile,
            isMobileDevice: isMobileByUserAgent,
            isMobileWidth: isMobileByWidth
        }
    }

    const initialState = getInitialState()
    const [isMobile, setIsMobile] = useState(initialState.isMobile)
    const [isMobileDevice, setIsMobileDevice] = useState(initialState.isMobileDevice)
    const [isMobileWidth, setIsMobileWidth] = useState(initialState.isMobileWidth)

    useEffect(() => {
        const checkMobileDevice = () => {
            if (!includeUserAgent) return false

            const userAgent = navigator.userAgent || navigator.vendor || (window as Window & typeof globalThis & { opera?: string }).opera || ''
            const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
            return mobileRegex.test(userAgent)
        }

        const handleResize = () => {
            const windowWidth = window.innerWidth
            const isMobileByWidth = windowWidth <= mobileWidthBreakpoint
            const isMobileByUserAgent = checkMobileDevice()

            setIsMobileWidth(isMobileByWidth)
            setIsMobileDevice(isMobileByUserAgent)

            // Set isMobile based on either user agent or width
            setIsMobile(isMobileByUserAgent || isMobileByWidth)
        }

        // Set initial state
        handleResize()

        // Add event listener for window resize
        window.addEventListener('resize', handleResize)

        // Cleanup function to remove the event listener
        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [breakpoint, mobileWidthBreakpoint, includeUserAgent])

    return {
        isMobile,
        isDesktop: !isMobile,
        isMobileDevice,
        isMobileWidth
    }
}

export { useResponsive }