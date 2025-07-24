import React from 'react'

import Header from '@/layouts/components/Header'

interface MainLayoutProps {
    children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    // All header logic is now in Header
    return (
        <div className='h-lvh'>
            <Header />
            <div className='h-[calc(100dvh-56px)]'>
                {children}
            </div>
        </div>
    )
}

export default MainLayout