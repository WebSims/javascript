import { useState, useEffect, useRef, useCallback } from 'react'
import { useResponsive } from './useResponsive'

interface UseEmailReminderTriggerProps {
    codeEditorSelector?: string
    delayMs?: number
}

interface UseEmailReminderTriggerReturn {
    shouldShowDrawer: boolean
    dismissDrawer: () => void
}

const useEmailReminderTrigger = ({
    codeEditorSelector = '.monaco-editor',
    delayMs = 3000
}: UseEmailReminderTriggerProps = {}): UseEmailReminderTriggerReturn => {
    const [shouldShowDrawer, setShouldShowDrawer] = useState(false)
    const [hasUserInteracted, setHasUserInteracted] = useState(false)
    const [isCodeEditorFocused, setIsCodeEditorFocused] = useState(false)
    const [hasShownDrawer, setHasShownDrawer] = useState(false)

    const { isMobile } = useResponsive({
        mobileWidthBreakpoint: 768,
        includeUserAgent: true
    })
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const focusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // Check if code editor is focused
    const checkCodeEditorFocus = useCallback(() => {
        const codeEditorElement = document.querySelector(codeEditorSelector)
        const activeElement = document.activeElement

        if (codeEditorElement && activeElement) {
            const isWithinCodeEditor = codeEditorElement.contains(activeElement)
            setIsCodeEditorFocused(isWithinCodeEditor)
        } else {
            setIsCodeEditorFocused(false)
        }
    }, [codeEditorSelector])

    // Start timer when conditions are met
    const startDrawerTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }

        timerRef.current = setTimeout(() => {
            if (!isCodeEditorFocused && !hasShownDrawer && isMobile && hasUserInteracted) {
                setShouldShowDrawer(true)
                setHasShownDrawer(true)
            }
        }, delayMs)
    }, [isCodeEditorFocused, hasShownDrawer, isMobile, hasUserInteracted, delayMs])

    // Handle user interaction events
    const handleUserInteraction = useCallback(() => {
        if (!hasUserInteracted && isMobile) {
            setHasUserInteracted(true)
        } else if (hasUserInteracted && isMobile && !hasShownDrawer) {
            // Reset the timer if user interacts while countdown is active
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                // Restart the timer
                startDrawerTimer()
            }
        }
    }, [hasUserInteracted, isMobile, hasShownDrawer, startDrawerTimer])

    // Dismiss drawer
    const dismissDrawer = useCallback(() => {
        setShouldShowDrawer(false)
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }
    }, [])

    // Set up event listeners for user interaction
    useEffect(() => {
        if (!isMobile) return

        const events = ['touchstart', 'touchend', 'click', 'scroll', 'keydown']

        events.forEach(event => {
            document.addEventListener(event, handleUserInteraction, { passive: true })
        })

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, handleUserInteraction)
            })
        }
    }, [isMobile, handleUserInteraction])

    // Set up focus checking interval
    useEffect(() => {
        if (!isMobile || !hasUserInteracted) return

        checkCodeEditorFocus()
        focusCheckIntervalRef.current = setInterval(checkCodeEditorFocus, 500)

        return () => {
            if (focusCheckIntervalRef.current) {
                clearInterval(focusCheckIntervalRef.current)
            }
        }
    }, [isMobile, hasUserInteracted, checkCodeEditorFocus])

    // Start timer when user has interacted and editor is not focused
    useEffect(() => {
        if (isMobile && hasUserInteracted && !isCodeEditorFocused && !hasShownDrawer) {
            startDrawerTimer()
        } else if (timerRef.current) {
            clearTimeout(timerRef.current)
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
        }
    }, [isMobile, hasUserInteracted, isCodeEditorFocused, hasShownDrawer, startDrawerTimer])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
            if (focusCheckIntervalRef.current) {
                clearInterval(focusCheckIntervalRef.current)
            }
        }
    }, [])

    return {
        shouldShowDrawer: shouldShowDrawer && isMobile,
        dismissDrawer
    }
}

export default useEmailReminderTrigger
