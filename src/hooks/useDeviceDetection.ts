import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 1024 // Standard breakpoint for tablets

interface DeviceDetection {
    isMobile: boolean
    isDesktop: boolean
}

const useDeviceDetection = (breakpoint: number = MOBILE_BREAKPOINT): DeviceDetection => {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < breakpoint)
        }

        // Set initial state
        handleResize()

        // Add event listener for window resize
        window.addEventListener('resize', handleResize)

        // Cleanup function to remove the event listener
        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, []) // Empty dependency array ensures this runs only on mount and unmount

    return { isMobile, isDesktop: !isMobile }
}

export default useDeviceDetection 