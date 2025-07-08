import { useState, useCallback, useLayoutEffect } from 'react';

interface Size {
    width: number;
    height: number;
}

function useElementSize<T extends HTMLElement>(): [(node: T | null) => void, Size] {
    const [node, setNode] = useState<T | null>(null);
    const [size, setSize] = useState<Size>({
        width: 0,
        height: 0
    });

    const ref = useCallback((node: T | null) => {
        setNode(node);
    }, []);

    useLayoutEffect(() => {
        if (node) {
            const observer = new ResizeObserver(entries => {
                if (entries[0]) {
                    const { width, height } = entries[0].contentRect;
                    setSize({ width, height });
                }
            });

            observer.observe(node);

            return () => observer.disconnect();
        }
    }, [node]);

    return [ref, size];
}

export default useElementSize; 