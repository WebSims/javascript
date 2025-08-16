import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer'

interface EmailReminderProps {
    isOpen: boolean
    onClose: () => void
}

const EMAIL_REMINDER_COUNT_KEY = 'emailReminderCount'
const MAX_SHOW_COUNT = 2

const EmailReminder: React.FC<EmailReminderProps> = ({ isOpen, onClose }) => {
    const [showEmailForm, setShowEmailForm] = useState(false)
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isEmailSent, setIsEmailSent] = useState(false)
    const [shouldRender, setShouldRender] = useState(false)

    // Check if drawer should be shown based on counter
    useEffect(() => {
        const getShowCount = (): number => {
            const stored = localStorage.getItem(EMAIL_REMINDER_COUNT_KEY)
            return stored ? parseInt(stored, 10) : 0
        }

        const incrementShowCount = (): void => {
            const currentCount = getShowCount()
            localStorage.setItem(EMAIL_REMINDER_COUNT_KEY, (currentCount + 1).toString())
        }

        if (isOpen) {
            const currentCount = getShowCount()
            if (currentCount < MAX_SHOW_COUNT) {
                setShouldRender(true)
                incrementShowCount()
            } else {
                setShouldRender(false)
                onClose() // Close immediately if max count reached
            }
        } else {
            setShouldRender(false)
        }
    }, [isOpen, onClose])

    const handleEmailMeClick = () => {
        setShowEmailForm(true)
    }

    const handleSendEmail = async () => {
        if (!email || !email.includes('@')) {
            return
        }

        setIsLoading(true)

        try {
            // Simulate email sending - replace with actual email service
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Get current URL
            const currentUrl = window.location.href

            // Here you would integrate with your email service
            // For now, we'll just log it and show success
            console.log('Sending email to:', email, 'with URL:', currentUrl)

            setIsEmailSent(true)
            setTimeout(() => {
                onClose()
                setShowEmailForm(false)
                setEmail('')
                setIsEmailSent(false)
            }, 2000)
        } catch (error) {
            console.error('Error sending email:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        onClose()
        setShowEmailForm(false)
        setEmail('')
        setIsEmailSent(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && showEmailForm && !isLoading) {
            handleSendEmail()
        }
    }

    // Don't render if we've exceeded the max show count
    if (!shouldRender) {
        return null
    }

    return (
        <Drawer open={isOpen} onOpenChange={handleClose} dismissible={false}>
            <DrawerContent>
                <button
                    onClick={handleClose}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10"
                    tabIndex={0}
                    aria-label="Close drawer"
                >
                    <X className="h-4 w-4" />
                </button>
                <DrawerHeader>
                    <DrawerTitle>
                        {isEmailSent ? 'Email Sent!' : showEmailForm ? 'Email Me the Link' : 'Better Experience on Desktop'}
                    </DrawerTitle>
                    <DrawerDescription>
                        {isEmailSent
                            ? 'Check your email for the link to this page.'
                            : showEmailForm
                                ? 'Enter your email address to receive the link.'
                                : 'If you want more details and explanation, open this page on a computer.'
                        }
                    </DrawerDescription>
                </DrawerHeader>

                <DrawerFooter>
                    {!showEmailForm && !isEmailSent && (
                        <Button
                            onClick={handleEmailMeClick}
                            className="w-full"
                            tabIndex={0}
                            aria-label="Email me the link to this page"
                        >
                            Email me the link
                        </Button>
                    )}

                    {showEmailForm && !isEmailSent && (
                        <div className="space-y-4">
                            <input
                                type="email"
                                placeholder="Enter your email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                tabIndex={0}
                                aria-label="Email address input"
                                disabled={isLoading}
                            />
                            <Button
                                onClick={handleSendEmail}
                                disabled={!email || !email.includes('@') || isLoading}
                                className="w-full"
                                tabIndex={0}
                                aria-label="Send email with page link"
                            >
                                {isLoading ? 'Sending...' : 'Send'}
                            </Button>
                        </div>
                    )}

                    {isEmailSent && (
                        <div className="flex items-center justify-center py-4">
                            <div className="text-center">
                                <div className="text-green-600 text-2xl mb-2">✓</div>
                                <p className="text-sm text-gray-600">Email sent successfully!</p>
                            </div>
                        </div>
                    )}
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}

export default EmailReminder
