import { useState } from 'react'
import './App.css'
import axios from 'axios'

function App() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const BASE = import.meta.env.VITE_BACKEND_URL

  const handleAnalyze = async () => {
    if (!text) return
    try {
      const { data } = await axios.post(`${BASE}/process_text`, { text })
      setResult(data)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <>
      <div style={{ marginTop: 20 }}>
        <input
          style={{ padding: '6px', marginRight: '6px' }}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something…"
        />
        <button onClick={handleAnalyze}>Process Text</button>
      </div>

      {result && (
        <div style={{ marginTop: 12 }}>
          <p>Label: {result.label}</p>
          <p>Sentiment: {result.sentiment}</p>
          <p>Keywords: {result.keywords.join(', ')}</p>
        </div>
      )}
    </>
  )
}

export default App
