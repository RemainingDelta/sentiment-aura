import { useState, useRef, useEffect } from 'react'
import './App.css'
import axios from 'axios'
import PerlinAura from './PerlinAura'

function App() {
  const [text] = useState('')
  const [result, setResult] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [prevKeywords, setPrevKeywords] = useState([])
  const [error, setError] = useState(null)
  
  const wsRef = useRef(null)
  const streamRef = useRef(null)
  const transcriptRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  
  const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
  const WS_BASE = BASE.replace('http', 'ws')

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript, interimTranscript])

  useEffect(() => {
    if (result?.keywords) {
      setPrevKeywords(result.keywords)
    }
  }, [result?.keywords])

  const handleAnalyze = async (textToAnalyze) => {
    const finalText = textToAnalyze || text
    
    if (!finalText || finalText.trim().length === 0) {
      return
    }
    
    setIsAnalyzing(true)
    setError(null)
    
    try {
      const { data } = await axios.post(
        `${BASE}/process_text`, 
        { text: finalText },
        { timeout: 10000 }
      )
      setResult(data)
    } catch (err) {
      console.error('Error analyzing text:', err)
      setError('Failed to analyze sentiment. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const startRecording = async () => {
    try {
      setTranscript('')
      setInterimTranscript('')
      setResult(null)
      setError(null)

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      })

      const ws = new WebSocket(`${WS_BASE}/ws/transcribe`)
      wsRef.current = ws

      ws.onopen = () => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        })
        const source = audioContext.createMediaStreamSource(stream)
        const processor = audioContext.createScriptProcessor(4096, 1, 1)
        
        source.connect(processor)
        processor.connect(audioContext.destination)
        
        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0)
            
            const int16Data = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]))
              int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
            }
            
            ws.send(int16Data.buffer)
          }
        }
        
        streamRef.current = { stream, audioContext, processor, source }
        setIsRecording(true)
      }

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data)
          
          if (response.channel && response.channel.alternatives) {
            const alternative = response.channel.alternatives[0]
            
            if (alternative && alternative.transcript) {
              const newText = alternative.transcript
              
              if (response.is_final) {
                setTranscript(prev => prev + (prev ? ' ' : '') + newText)
                setInterimTranscript('')
                handleAnalyze(newText)
              } else {
                setInterimTranscript(newText)
              }
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setError('Connection error. Retrying...')
      }

      ws.onclose = () => {
        console.log('WebSocket closed')
        if (isRecording) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...')
            startRecording()
          }, 2000)
        }
      }

    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (streamRef.current) {
      if (streamRef.current.processor) {
        streamRef.current.processor.disconnect()
        streamRef.current.source.disconnect()
        streamRef.current.audioContext.close()
        streamRef.current.stream.getTracks().forEach(track => track.stop())
      } else if (streamRef.current.getTracks) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }
    
    setIsRecording(false)
    setInterimTranscript('')
  }

  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [])

  return (
    <>
      <PerlinAura 
        sentiment={result?.sentiment ?? 0.5} 
        keywords={result?.keywords || []} 
        isRecording={isRecording}
      />      
      <div className="app-container">
        <div className="content-overlay">
          <h1 className="title">🎤 Sentiment Aura</h1>
          
          <div className="controls">
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`record-button ${isRecording ? 'recording' : ''}`}
              disabled={isAnalyzing}
            >
              {isRecording ? 'Stop' : 'Start'}
            </button>
            
            {isRecording && (
              <span className="recording-indicator">
                ● Recording...
              </span>
            )}
            
            {isAnalyzing && (
              <span className="analyzing-indicator">
                <span className="spinner"></span>
                Analyzing...
              </span>
            )}
          </div>

          {error && (
            <div className="error-banner">
              ⚠️ {error}
            </div>
          )}

          {(transcript || interimTranscript) && (
            <div className="transcript-display" ref={transcriptRef}>
              <h3>📝 Live Transcript</h3>
              <div className="transcript-content">
                <span className="final-transcript">{transcript}</span>
                {interimTranscript && (
                  <span className="interim-transcript glow-text"> {interimTranscript}</span>
                )}
              </div>
            </div>
          )}

          {result && result.keywords && result.keywords.length > 0 && (
            <div className="keywords-display">
              <h3>🔑 Key Topics</h3>
              <div className="keywords-container">
                {result.keywords.map((keyword, index) => (
                  <span 
                    key={`${keyword}-${index}`}
                    className="keyword-tag"
                    style={{
                      animationDelay: `${index * 0.15}s`,
                      animationDuration: `${0.8 + index * 0.1}s`
                    }}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className={`sentiment-display sentiment-${result.label} ${isAnalyzing ? 'updating' : ''}`}>
              <h3>💭 Sentiment Analysis</h3>
              <div className="sentiment-content">
                <div className="sentiment-label">{result.label.toUpperCase()}</div>
                <div className="sentiment-score">{(result.sentiment * 100).toFixed(0)}%</div>
              </div>
              <div className="sentiment-bar">
                <div 
                  className="sentiment-fill"
                  style={{ width: `${result.sentiment * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default App