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
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

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

    // Debounced timer reset function
    const debouncedTimerReset = useCallback(() => {
        // Clear existing debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        // Set new debounce timer
        debounceTimerRef.current = setTimeout(() => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                startDrawerTimer()
            }
        }, 300) // 300ms debounce delay
    }, [startDrawerTimer])

    // Handle user interaction events
    const handleUserInteraction = useCallback(() => {
        if (!hasUserInteracted && isMobile) {
            setHasUserInteracted(true)
        } else if (hasUserInteracted && isMobile && !hasShownDrawer) {
            // Use debounced timer reset to prevent excessive restarts
            debouncedTimerReset()
        }
    }, [hasUserInteracted, isMobile, hasShownDrawer, debouncedTimerReset])

    // Dismiss drawer
    const dismissDrawer = useCallback(() => {
        setShouldShowDrawer(false)
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
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
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
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
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [])

    return {
        shouldShowDrawer: shouldShowDrawer && isMobile,
        dismissDrawer
    }
}

export default useEmailReminderTrigger
