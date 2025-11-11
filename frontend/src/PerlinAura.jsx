import React, { useEffect, useRef } from 'react'
import Sketch from 'react-p5'

const PerlinAura = ({ sentiment = 0.5, keywords = [], isRecording = false }) => {
  const timeRef = useRef(0)
  const particlesRef = useRef([])
  const targetSentimentRef = useRef(0.5)
  const currentSentimentRef = useRef(0.5)
  const keywordPulseRef = useRef({}) 
  
  useEffect(() => {
    targetSentimentRef.current = sentiment
  }, [sentiment, keywords])
  
  useEffect(() => {
    keywords.forEach((keyword, index) => {
      if (!keywordPulseRef.current[keyword]) {
        keywordPulseRef.current[keyword] = {
          startTime: Date.now(),
          index: index
        }
      }
    })
    
    Object.keys(keywordPulseRef.current).forEach(key => {
      if (!keywords.includes(key)) {
        delete keywordPulseRef.current[key]
      }
    })
  }, [keywords])

  const getSentimentColors = (p5, sentiment) => {
    let primary, secondary;
    
    if (sentiment < 0.25) {
      const t = sentiment / 0.25;
      primary = p5.lerpColor(
        p5.color(255, 0, 0),
        p5.color(220, 38, 38),   
        t
      );
      secondary = p5.lerpColor(
        p5.color(255, 0, 127),  
        p5.color(147, 51, 234),  
        t
      );
    } else if (sentiment < 0.5) {
      const t = (sentiment - 0.25) / 0.25;
      primary = p5.lerpColor(
        p5.color(220, 38, 38),    
        p5.color(147, 51, 234), 
        t
      );
      secondary = p5.lerpColor(
        p5.color(147, 51, 234),  
        p5.color(59, 130, 246), 
        t
      );
    } else if (sentiment < 0.75) {
      const t = (sentiment - 0.5) / 0.25;
      primary = p5.lerpColor(
        p5.color(147, 51, 234),   
        p5.color(34, 197, 94),   
        t
      );
      secondary = p5.lerpColor(
        p5.color(59, 130, 246),   
        p5.color(20, 184, 166),  
        t
      );
    } else {
      const t = (sentiment - 0.75) / 0.25;
      primary = p5.lerpColor(
        p5.color(34, 197, 94),  
        p5.color(255, 215, 0),  
        t
      );
      secondary = p5.lerpColor(
        p5.color(20, 184, 166),   
        p5.color(255, 255, 100),  
        t
      );
    }
    
    return { primary, secondary };
  }

  const setup = (p5, canvasParentRef) => {
    p5.createCanvas(p5.windowWidth, p5.windowHeight).parent(canvasParentRef)
    p5.noStroke()
    
    const numParticles = 1500
    for (let i = 0; i < numParticles; i++) {
      particlesRef.current.push({
        x: p5.random(p5.width),
        y: p5.random(p5.height),
        prevX: p5.random(p5.width),
        prevY: p5.random(p5.height),
        size: p5.random(0.5, 2),
      })
    }
  }

  const draw = (p5) => {
    currentSentimentRef.current = p5.lerp(
      currentSentimentRef.current,
      targetSentimentRef.current,
      0.05
    )
    const currentSentiment = currentSentimentRef.current
    const inv = 1 - currentSentiment

    const bgAlpha = p5.map(currentSentiment, 0, 1, 34, 30)
    p5.background(5, 5, 15, bgAlpha)
    
    timeRef.current += 0.002
    
    const baseSpeed = p5.map(currentSentiment, 0, 1, 0.08, 4.5)
    const speed = baseSpeed * (1 + inv * 0.15)

    const noiseScale = p5.map(currentSentiment, 0, 1, 0.003, 0.015) 
    const turbulence = p5.map(currentSentiment, 0, 1, 4, 2) 

    const alpha = p5.map(currentSentiment, 0, 1, 190, 220) 
    
    const colors = getSentimentColors(p5, currentSentiment)
    
    const keywordPulse = keywords.length > 0 
      ? 1 + Math.sin(timeRef.current * 3) * (0.3 + inv * 0.1)
      : 1
    
    particlesRef.current.forEach((particle, i) => {
      const angle1 = p5.noise(
        particle.x * noiseScale,
        particle.y * noiseScale,
        timeRef.current
      ) * p5.TWO_PI * turbulence
      
      const angle2 = p5.noise(
        particle.x * noiseScale * 2 + 100,
        particle.y * noiseScale * 2 + 100,
        timeRef.current * 0.5
      ) * p5.TWO_PI * 2
      
      const angle = angle1 + angle2 * 0.3
      
      particle.prevX = particle.x
      particle.prevY = particle.y
      
      particle.x += p5.cos(angle) * speed * keywordPulse
      particle.y += p5.sin(angle) * speed * keywordPulse
      
      if (particle.x < 0) particle.x = p5.width
      if (particle.x > p5.width) particle.x = 0
      if (particle.y < 0) particle.y = p5.height
      if (particle.y > p5.height) particle.y = 0
      
      const useSecondary = i % 3 === 0
      const baseColor = useSecondary ? colors.secondary : colors.primary
      
      const colorNoise = p5.noise(i * 0.01, timeRef.current * 0.3)
      const finalColor = p5.lerpColor(
        baseColor,
        useSecondary ? colors.primary : colors.secondary,
        colorNoise
      )

      const sizeBoost = 1 + inv * 0.10
      
      p5.stroke(
        p5.red(finalColor),
        p5.green(finalColor),
        p5.blue(finalColor),
        alpha
      )
      p5.strokeWeight(particle.size * sizeBoost)
      
      p5.line(particle.prevX, particle.prevY, particle.x, particle.y)
    })
    
    p5.noStroke()
    keywords.forEach((keyword, i) => {
      const angle = (i / Math.max(1, keywords.length)) * p5.TWO_PI + timeRef.current * 0.5
      const radiusBase = p5.min(p5.width, p5.height) * 0.25
      const radiusNoise = p5.noise(i, timeRef.current * 2) * 100
      const radius = radiusBase + radiusNoise
      
      const x = p5.width / 2 + p5.cos(angle) * radius
      const y = p5.height / 2 + p5.sin(angle) * radius
      
      const keywordData = keywordPulseRef.current[keyword]
      const timeSinceAppear = keywordData ? (Date.now() - keywordData.startTime) / 1000 : 0
      
      const initialPulse = timeSinceAppear < 2 
        ? 1 + (1 - timeSinceAppear / 2) * 0.8 
        : 1
      
      const continuousPulse = 1 + Math.sin(timeRef.current * 4 + i) * 0.2
      
      const pulse = initialPulse * continuousPulse
      
      for (let r = 80; r > 0; r -= 3) {
        const glowAlpha = p5.map(r, 0, 80, 0, 150) * pulse
        const glowColor = i % 2 === 0 ? colors.primary : colors.secondary
        p5.fill(
          p5.red(glowColor),
          p5.green(glowColor),
          p5.blue(glowColor),
          glowAlpha
        )
        p5.circle(x, y, r * pulse)
      }
    })
    
    if (isRecording) {
      const vortexSize = 100 + Math.sin(timeRef.current * 5) * 30
      for (let r = vortexSize; r > 0; r -= 5) {
        const vortexAlpha = p5.map(r, 0, vortexSize, 0, 60)
        p5.fill(255, 255, 255, vortexAlpha)
        p5.circle(p5.width / 2, p5.height / 2, r)
      }
    }
  }

  const windowResized = (p5) => {
    p5.resizeCanvas(p5.windowWidth, p5.windowHeight)
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%',
      zIndex: 0 
    }}>
      <Sketch setup={setup} draw={draw} windowResized={windowResized} />
    </div>
  )
}

export default PerlinAura
