import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 1024 // Standard breakpoint for tablets
const MOBILE_WIDTH_BREAKPOINT = 768 // Width breakpoint for mobile detection

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
        includeUserAgent = true
    } = options

    const [isMobile, setIsMobile] = useState(false)
    const [isMobileDevice, setIsMobileDevice] = useState(false)
    const [isMobileWidth, setIsMobileWidth] = useState(false)

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