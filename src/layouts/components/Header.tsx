import { Button } from '@/components/ui/button'
import React, { useState } from 'react'
import { Link } from 'react-router'

import { useResponsive } from '@/hooks/useResponsive'
import { useModeToggle } from '@/hooks/useModeToggle'
import { MenuIcon, PlayIcon, CodeIcon } from 'lucide-react'
import DesktopMenu from '@/layouts/components/DesktopMenu'
import MobileMenu from '@/layouts/components/MobileMenu'
import { getAppVersion } from '@/lib/utils'

const Header: React.FC = () => {
    const { isDesktop } = useResponsive()
    const { currentMode, toggleMode } = useModeToggle()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const appVersion = getAppVersion()

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

            <div className='flex w-full items-center gap-6'>
                <div
                    className='font-bold lg:text-lg cursor-pointer hover:text-blue-600 transition-colors'
                    tabIndex={0}
                    aria-label="Go to home page"
                    role="button"
                >
                    <Link to="/">
                        <div className="flex flex-col items-start">
                            <span>WebSims.org/js</span>
                            <span className="text-xs text-gray-500 font-normal">v{appVersion}</span>
                        </div>
                    </Link>
                </div>
                {isDesktop && <DesktopMenu />}
            </div>

            <div className='flex items-center gap-2'>
                <div className="flex items-center space-x-2">
                    <Button
                        variant='default'
                        size="sm"
                        onClick={toggleMode}
                        className={`w-20 text-white ${currentMode === 'RUN'
                            ? 'bg-blue-500 hover:bg-blue-600 border-blue-500'
                            : 'bg-green-500 hover:bg-green-600 border-green-500'
                            }`}
                    >
                        {currentMode === 'RUN' ? (
                            <CodeIcon className="w-4 h-4 mr-1" />
                        ) : (
                            <PlayIcon className="w-4 h-4 mr-1" fill="currentColor" />
                        )}
                        <span>
                            {currentMode === 'RUN' ? 'Code' : 'Run'}
                        </span>
                    </Button>
                </div>
            </div>
            <MobileMenu
                isOpen={isMobileMenuOpen}
                onClose={handleMobileMenuClose}
            />
        </header>
    )
}

export default Header