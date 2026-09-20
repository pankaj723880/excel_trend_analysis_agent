import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * AuroraDataWave
 * High-performance, canvas-based animated flowing particle waves.
 * - Deep black/navy base
 * - Flowing particle wave ribbons (purple, violet, cyan, sapphire blue)
 * - Multi-layered 3D depth with subtle luminous connecting curves
 * - Organic sinusoidal & fluid wave deformation
 * - Non-intrusive ambient background with reduced opacity on dense analytics pages
 * - Pauses on tab inactive & respects prefers-reduced-motion
 * - Pointer-events-none so it never interferes with clicks, charts or scrolling
 */
export default function AuroraDataWave() {
  const canvasRef = useRef(null)
  const location = useLocation()

  // Determine intensity based on current page
  const pathname = location.pathname
  const isHeroPage = ['/', '/upload', '/ai-analyst', '/ask-data', '/ai-reports'].includes(pathname)
  const targetOpacity = isHeroPage ? 0.95 : 0.45

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let animationFrameId
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)
    let isVisible = true

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Resize handler with devicePixelRatio support
    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Visibility change handler to pause when tab is inactive
    const handleVisibilityChange = () => {
      isVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Palette: Neon purple, violet, blue and subtle cyan
    const wavePalettes = [
      { r: 168, g: 85, b: 247, alpha: 0.55 }, // Neon Purple
      { r: 139, g: 92, b: 246, alpha: 0.45 }, // Violet
      { r: 59, g: 130, b: 246, alpha: 0.50 },  // Electric Blue
      { r: 56, g: 189, b: 248, alpha: 0.40 },  // Subtle Cyan
    ]

    // Wave layers configuration
    const layers = [
      {
        yRatio: 0.65,
        amplitude: 65,
        wavelength: 0.0018,
        speed: 0.0006,
        phase: 0,
        color: wavePalettes[0],
        numRibbons: 6,
        particleDensity: 45,
        depth: 1.0,
      },
      {
        yRatio: 0.75,
        amplitude: 85,
        wavelength: 0.0014,
        speed: 0.00045,
        phase: Math.PI / 3,
        color: wavePalettes[1],
        numRibbons: 7,
        particleDensity: 55,
        depth: 0.85,
      },
      {
        yRatio: 0.52,
        amplitude: 50,
        wavelength: 0.0022,
        speed: 0.00075,
        phase: Math.PI / 1.5,
        color: wavePalettes[2],
        numRibbons: 5,
        particleDensity: 38,
        depth: 0.65,
      },
      {
        yRatio: 0.85,
        amplitude: 70,
        wavelength: 0.0012,
        speed: 0.00035,
        phase: Math.PI / 2,
        color: wavePalettes[3],
        numRibbons: 6,
        particleDensity: 40,
        depth: 0.50,
      },
    ]

    // Floating stray particles traveling along the flow
    const freeParticlesCount = 65
    const freeParticles = []
    for (let i = 0; i < freeParticlesCount; i++) {
      freeParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() * 0.4 + 0.15),
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.6 + 0.6,
        alpha: Math.random() * 0.6 + 0.2,
        color: wavePalettes[Math.floor(Math.random() * wavePalettes.length)],
        pulse: Math.random() * Math.PI * 2,
      })
    }

    let time = 0

    const render = () => {
      if (!isVisible || prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render)
        return
      }

      time += 1

      // Dark background gradient fill
      const bgGrad = ctx.createLinearGradient(0, 0, width, height)
      bgGrad.addColorStop(0, '#060913')
      bgGrad.addColorStop(0.5, '#080D1A')
      bgGrad.addColorStop(1, '#05070F')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      // Ambient background glow orbs
      const glow1 = ctx.createRadialGradient(width * 0.75, height * 0.35, 10, width * 0.75, height * 0.35, width * 0.45)
      glow1.addColorStop(0, 'rgba(168, 85, 247, 0.055)')
      glow1.addColorStop(1, 'transparent')
      ctx.fillStyle = glow1
      ctx.fillRect(0, 0, width, height)

      const glow2 = ctx.createRadialGradient(width * 0.25, height * 0.8, 10, width * 0.25, height * 0.8, width * 0.4)
      glow2.addColorStop(0, 'rgba(56, 189, 248, 0.045)')
      glow2.addColorStop(1, 'transparent')
      ctx.fillStyle = glow2
      ctx.fillRect(0, 0, width, height)

      // Draw flowing wave layers
      layers.forEach((layer) => {
        const baseY = height * layer.yRatio
        const { color } = layer

        for (let r = 0; r < layer.numRibbons; r++) {
          const ribbonOffset = (r - layer.numRibbons / 2) * 14
          const ribbonPhase = layer.phase + r * 0.18
          const ribbonSpeed = layer.speed * (1 + r * 0.05)

          ctx.beginPath()
          const stepX = 24
          let first = true

          for (let x = 0; x <= width + stepX; x += stepX) {
            // Compound sine waves for organic fluid motion
            const sin1 = Math.sin(x * layer.wavelength + time * ribbonSpeed + ribbonPhase)
            const sin2 = Math.sin(x * layer.wavelength * 0.5 - time * ribbonSpeed * 0.6 + ribbonPhase)
            const cos1 = Math.cos(x * layer.wavelength * 1.8 + time * ribbonSpeed * 0.8)

            const y = baseY + ribbonOffset + sin1 * layer.amplitude + sin2 * (layer.amplitude * 0.4) + cos1 * 12

            if (first) {
              ctx.moveTo(x, y)
              first = false
            } else {
              ctx.lineTo(x, y)
            }

            // Draw glowing particles along the wave nodes
            if ((x / stepX) % 3 === 0) {
              const particleGlow = (Math.sin(time * 0.03 + x * 0.02 + r) + 1) * 0.5
              const pAlpha = (color.alpha * 0.8 + particleGlow * 0.3) * layer.depth
              const pRadius = (1.1 + particleGlow * 0.9) * layer.depth

              ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${pAlpha})`
              ctx.fillRect(x - pRadius, y - pRadius, pRadius * 2, pRadius * 2)
            }
          }

          // Luminous connecting stroke
          ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${(color.alpha * 0.22) * layer.depth})`
          ctx.lineWidth = 1.0 * layer.depth
          ctx.stroke()
        }
      })

      // Draw subtle drifting free particles
      freeParticles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy + Math.sin(time * 0.015 + p.pulse) * 0.25
        p.pulse += 0.02

        if (p.x > width + 10) p.x = -10
        if (p.y < -10) p.y = height + 10
        if (p.y > height + 10) p.y = -10

        const pulseAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse))
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${pulseAlpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      })

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700 ease-in-out"
      style={{ opacity: targetOpacity }}
    />
  )
}
