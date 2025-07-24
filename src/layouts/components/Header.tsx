import { Button } from '@/components/ui/button'
import React, { useState } from 'react'
import { useNavigate } from 'react-router'

import { useResponsive } from '@/hooks/useResponsive'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { MenuIcon, PlayIcon, CodeIcon } from 'lucide-react'
import ExamplesMenu from '@/layouts/components/ExamplesMenu'
import MobileMenu from '@/layouts/components/MobileMenu'

const Header: React.FC = () => {
    const { isDesktop } = useResponsive()
    const { mode, toggleMode } = useSimulatorStore()
    const navigate = useNavigate()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const handleHomeClick = () => {
        navigate('/')
    }

    const handleHomeKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleHomeClick()
        }
    }

    const handleMobileMenuToggle = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen)
    }

    const handleMobileMenuClose = () => {
        setIsMobileMenuOpen(false)
    }

    return (
        <header className='h-14 bg-background flex justify-between items-center gap-2 px-3 border-b border-slate-200'>
            <div className='lg:hidden'>
                <Button
                    variant='ghost'
                    size='icon'
                    aria-label="Open menu"
                    onClick={handleMobileMenuToggle}
                >
                    <MenuIcon className='w-6 h-6' />
                </Button>
            </div>

            <div className='flex w-full items-center gap-4 overflow-hidden'>
                <div
                    className='font-bold lg:text-lg cursor-pointer hover:text-blue-600 transition-colors'
                    onClick={handleHomeClick}
                    onKeyDown={handleHomeKeyDown}
                    tabIndex={0}
                    aria-label="Go to home page"
                    role="button"
                >
                    WebSims.org/js
                </div>
                {isDesktop && mode === 'CODE' && (
                    <nav className='flex items-center gap-2'>
                        <ExamplesMenu />
                    </nav>
                )}
            </div>

            <div className='flex items-center gap-2'>
                <div className="flex items-center space-x-2">
                    <Button
                        variant='default'
                        size="sm"
                        onClick={toggleMode}
                        className={`w-20 text-white ${mode === 'EXECUTION'
                            ? 'bg-blue-500 hover:bg-blue-600 border-blue-500'
                            : 'bg-green-500 hover:bg-green-600 border-green-500'
                            }`}
                    >
                        {mode === 'EXECUTION' ? (
                            <CodeIcon className="w-4 h-4 mr-1" />
                        ) : (
                            <PlayIcon className="w-4 h-4 mr-1" fill="currentColor" />
                        )}
                        <span>
                            {mode === 'EXECUTION' ? 'Code' : 'Run'}
                        </span>
                    </Button>
                </div>
            </div>
            <MobileMenu
                isOpen={isMobileMenuOpen}
                onClose={handleMobileMenuClose}
                mode={mode}
            />
        </header>
    )
}

export default Header