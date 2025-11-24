'use client'

import { useEffect, useRef } from 'react'

export function useScrollAnimation(delay: number = 0) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (delay > 0) {
              setTimeout(() => {
                entry.target.classList.add('visible')
              }, delay)
            } else {
              entry.target.classList.add('visible')
            }
            // Unobserve after animation to improve performance
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.05,
        rootMargin: '0px 0px -50px 0px',
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [delay])

  return ref
}

// Hook for staggered animations
export function useStaggeredAnimation(itemCount: number, staggerDelay: number = 100) {
  const refs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const itemIndex = refs.current.indexOf(entry.target as HTMLDivElement)
            if (itemIndex >= 0) {
              setTimeout(() => {
                entry.target.classList.add('visible')
              }, itemIndex * staggerDelay)
              // Unobserve after animation
              observer.unobserve(entry.target)
            }
          }
        })
      },
      {
        threshold: 0.05,
        rootMargin: '0px 0px -30px 0px',
      }
    )

    refs.current.forEach((element) => {
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [itemCount, staggerDelay])

  const setRef = (index: number) => (el: HTMLDivElement | null) => {
    refs.current[index] = el
  }

  return setRef
}

