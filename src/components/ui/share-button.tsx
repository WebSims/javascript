import React from 'react'
import { Button } from '@/components/ui/button'
import { Share2, Copy } from 'lucide-react'

interface ShareButtonProps {
    url?: string
    title?: string
    text?: string
    className?: string
    variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    showText?: boolean
}

const ShareButton: React.FC<ShareButtonProps> = ({
    url = window.location.href,
    title = document.title,
    text = '',
    className = '',
    variant = 'outline',
    size = 'default',
    showText = false
}) => {
    const canShare = typeof navigator !== 'undefined' && 'share' in navigator

    const handleShare = async () => {
        if (canShare) {
            try {
                await navigator.share({
                    title,
                    text,
                    url
                })
            } catch (error) {
                // User cancelled or error occurred, fall back to clipboard
                if (error instanceof Error && error.name !== 'AbortError') {
                    handleFallbackShare()
                }
            }
        } else {
            handleFallbackShare()
        }
    }

    const handleFallbackShare = async () => {
        try {
            await navigator.clipboard.writeText(url)
            // You could show a toast notification here
            console.log('Link copied to clipboard!')
        } catch (error) {
            console.error('Failed to copy to clipboard:', error)
            // Fallback to manual copy
            const textArea = document.createElement('textarea')
            textArea.value = url
            document.body.appendChild(textArea)
            textArea.select()
            document.execCommand('copy')
            document.body.removeChild(textArea)
            console.log('Link copied to clipboard (fallback)!')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleShare()
        }
    }

    return (
        <Button
            onClick={handleShare}
            onKeyDown={handleKeyDown}
            variant={variant}
            size={size}
            className={className}
            tabIndex={0}
            aria-label={canShare ? 'Share this page' : 'Copy link to clipboard'}
        >
            {canShare ? (
                <>
                    <Share2 className={`h-4 w-4${showText ? ' mr-2' : ''}`} />
                    {showText && 'Share'}
                </>
            ) : (
                <>
                    <Copy className={`h-4 w-4${showText ? ' mr-2' : ''}`} />
                    {showText && 'Copy Link'}
                </>
            )}
        </Button>
    )
}

export default ShareButton
