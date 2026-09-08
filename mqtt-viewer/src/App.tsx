import { useState, useEffect, useRef } from 'react'
import mqtt from 'mqtt'
import { SUBTOPICS, deviceTopic } from 'mqtt-contract'

function getPlaceholderPayload(subtopic: string) {
  switch (subtopic) {
    case SUBTOPICS.scan:
      return '{\n  "uid": "12345678",\n  "allowed": true,\n  "machine_active": false\n}'
    case SUBTOPICS.status:
      return '{\n  "online": true,\n  "uptime_s": 120\n}'
    case SUBTOPICS.logs:
      return '{\n  "log_version": "1.0",\n  "type": "event",\n  "level": "INFO",\n  "msg": "Device started",\n  "device_id": "test-device",\n  "uptime_s": 120,\n  "timestamp_ms": 1700000000000\n}'
    case SUBTOPICS.cmd_add_key:
      return '{\n  "uid": "12345678"\n}'
    case SUBTOPICS.cmd_remove_key:
      return '{\n  "uid": "12345678"\n}'
    case SUBTOPICS.cmd_trigger:
      return '{\n  "action": "success"\n}'
    case SUBTOPICS.cmd_sync:
      return '{\n  "keys": [\n    { "uid": "12345678", "username": "Alice" }\n  ]\n}'
    default:
      return '{\n  \n}'
  }
}

function App() {
  const [messages, setMessages] = useState<{ id: number; topic: string; message: string; timestamp: string }[]>([])
  const [status, setStatus] = useState('Disconnected')
  
  // Custom Topic State
  const [publishTopic, setPublishTopic] = useState('prismo/test')
  const [publishPayload, setPublishPayload] = useState('{}')
  
  // Contract Builder State
  const [useContract, setUseContract] = useState(true)
  const [deviceSlug, setDeviceSlug] = useState('test-device')
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>(SUBTOPICS.cmd_trigger)
  
  const [publishStatus, setPublishStatus] = useState('')
  const clientRef = useRef<mqtt.MqttClient | null>(null)
  const nextId = useRef(0)

  useEffect(() => {
    const url = import.meta.env.VITE_MQTT_URL || 'ws://localhost:9001'
    const username = import.meta.env.VITE_MQTT_USER || 'admin'
    const password = import.meta.env.VITE_MQTT_PASSWORD || 'admin'
    
    setStatus('Connecting to ' + url + '...')
    
    const client = mqtt.connect(url, {
      username,
      password,
    })
    clientRef.current = client

    client.on('connect', () => {
      setStatus('Connected')
      client.subscribe('#')
    })

    client.on('error', (err: Error) => {
      setStatus('Error: ' + err.message)
    })

    client.on('message', (topic: string, payload: Buffer) => {
      setMessages(prev => {
        const newMsg = {
          id: nextId.current++,
          topic,
          message: payload.toString(),
          timestamp: new Date().toLocaleTimeString()
        }
        return [newMsg, ...prev].slice(0, 100)
      })
    })

    return () => {
      client.end()
    }
  }, [])

  // Update payload when subtopic changes
  useEffect(() => {
    if (useContract) {
      setPublishPayload(getPlaceholderPayload(selectedSubtopic))
    }
  }, [selectedSubtopic, useContract])

  const handlePublish = () => {
    if (!clientRef.current || !clientRef.current.connected) {
      setPublishStatus('Error: Not connected')
      return
    }
    
    const finalTopic = useContract ? deviceTopic(deviceSlug, selectedSubtopic) : publishTopic

    if (!finalTopic) {
      setPublishStatus('Error: Topic required')
      return
    }

    setPublishStatus('Sending...')
    clientRef.current.publish(finalTopic, publishPayload, (err?: Error) => {
      if (err) {
        setPublishStatus('Error: ' + err.message)
      } else {
        setPublishStatus('Published successfully!')
        setTimeout(() => setPublishStatus(''), 3000)
      }
    })
  }

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">MQTT Debug Viewer</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4 p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Publish Message</h2>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="useContract" 
                checked={useContract} 
                onChange={e => setUseContract(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="useContract" className="text-sm font-medium text-zinc-400">Use Contract Builder</label>
            </div>
          </div>
          
          {useContract ? (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-400">Device Slug</label>
                <input 
                  value={deviceSlug}
                  onChange={(e) => setDeviceSlug(e.target.value)}
                  placeholder="test-device"
                  className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-400">Subtopic</label>
                <select 
                  value={selectedSubtopic}
                  onChange={(e) => setSelectedSubtopic(e.target.value)}
                  className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 outline-none focus:border-emerald-500"
                >
                  {Object.entries(SUBTOPICS).map(([key, value]) => (
                    <option key={key} value={value}>{value}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-400">Topic</label>
              <input 
                value={publishTopic}
                onChange={(e) => setPublishTopic(e.target.value)}
                placeholder="prismo/test"
                className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 outline-none focus:border-emerald-500"
              />
            </div>
          )}
          
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-medium text-zinc-400">Payload (JSON)</label>
            <textarea 
              value={publishPayload}
              onChange={(e) => setPublishPayload(e.target.value)}
              rows={8}
              className="px-4 py-2 font-mono rounded-xl bg-zinc-950 border border-zinc-800 outline-none focus:border-emerald-500"
            />
          </div>
          
          <div className="flex items-center gap-4 mt-2">
            <button 
              onClick={handlePublish}
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold transition-colors"
            >
              Publish
            </button>
            {publishStatus && <span className="text-sm text-zinc-400">{publishStatus}</span>}
          </div>
        </div>
        
        <div className="flex flex-col h-[600px] p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Live Messages (#)</h2>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {status === 'Connected' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                )}
              </span>
              <span className="text-sm text-zinc-400">{status}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            {messages.length === 0 ? (
              <p className="text-center text-zinc-500 pt-10">Listening for messages on all topics...</p>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map(msg => (
                  <div key={msg.id} className="border-b border-zinc-800 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center mb-1 gap-4">
                      <span className="font-mono text-xs font-bold text-emerald-400 break-all">{msg.topic}</span>
                      <span className="text-xs text-zinc-500 shrink-0">{msg.timestamp}</span>
                    </div>
                    <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap">{msg.message}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
