import { Button } from '@/components/ui/button'
import React from 'react'

import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { MenuIcon, ChevronDownIcon, PlayIcon, CodeIcon } from 'lucide-react'
import ExecutionBar from '@/components/simulator/execution-bar/ExecutionBar'

interface MainLayoutProps {
    children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { isDesktop } = useDeviceDetection()
    const { mode, toggleMode } = useSimulatorStore()

    return (
        <div className='h-screen'>
            <header className='h-14 bg-background flex justify-between items-center gap-2 px-3 border-b border-slate-200'>
                <div className='lg:hidden'>
                    <Button variant='ghost' size='icon' aria-label="Open menu">
                        <MenuIcon className='w-6 h-6' />
                    </Button>
                </div>

                <div className='flex w-full items-center gap-2  overflow-hidden'>
                    <div className='font-bold lg:text-lg'>
                        WebSims.org/js
                    </div>
                    {isDesktop && (mode === 'CODE' ? (
                        <nav className='flex items-center gap-2'>
                            example drop dropdown
                            <Button variant='ghost' size='icon' aria-label="Show examples">
                                <ChevronDownIcon className='w-4 h-4' />
                            </Button>
                        </nav>
                    ) : <ExecutionBar />)}
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
                                <PlayIcon className="w-4 h-4 mr-1" />
                            )}
                            {mode === 'EXECUTION' ? 'Code' : 'RUN'}
                        </Button>
                    </div>
                </div>
            </header>
            <div className='h-[calc(100vh-56px)]'>
                {children}
            </div>
        </div>
    )
}

export default MainLayout