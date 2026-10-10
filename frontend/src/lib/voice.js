// Voice quiz helpers: speak and wait until done, a "speak now" beep, and a microphone recorder that stops by itself
// after the student stops talking. Every function is cancellable, so leaving the page never leaves the mic on.
import { api } from './api'
import { splitSentences } from './sentences'

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null

function englishVoice() {
  const voices = synth?.getVoices() || []
  const en = voices.filter((v) => /^en/i.test(v.lang))
  return en.find((v) => /natural|online/i.test(v.name)) || en.find((v) => /google/i.test(v.name)) || en[0] || null
}

// Speaks text sentence by sentence (avoids Chrome's ~15 s cut-off). Falls back to the server voice when the
// browser has no speech synthesis. Resolves when finished or cancelled; never rejects.
export function speak(text, { rate = 1 } = {}) {
  let cancelled = false
  let audio = null
  let resolveServer = null
  const cancel = () => {
    cancelled = true
    synth?.cancel()
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    resolveServer?.()
    resolveServer = null
  }
  const done = (async () => {
    const parts = splitSentences(text).filter(Boolean)
    if (!parts.length) return
    // Wait briefly for Chrome to populate voices before falling back to server TTS
    if (synth && !synth.getVoices().length && 'onvoiceschanged' in synth) {
      await new Promise((resolve) => {
        const doneVoices = () => {
          synth.removeEventListener('voiceschanged', doneVoices)
          resolve()
        }
        synth.addEventListener('voiceschanged', doneVoices)
        setTimeout(doneVoices, 400)
      })
    }
    if (synth && (synth.getVoices().length || !('onvoiceschanged' in synth))) {
      synth.cancel()
      const voice = englishVoice()
      for (const part of parts) {
        if (cancelled) return
        await new Promise((resolve) => {
          const u = new SpeechSynthesisUtterance(part)
          if (voice) u.voice = voice
          u.lang = voice?.lang || 'en-US'
          u.rate = rate
          // Chrome sometimes never fires onend: a safety timer based on length keeps the quiz moving
          const guard = setTimeout(resolve, (part.split(/\s+/).length * 600) / rate + 4000)
          const finish = () => {
            clearTimeout(guard)
            resolve()
          }
          u.onend = finish
          u.onerror = finish
          synth.speak(u)
        })
      }
      return
    }
    // no browser voice: the server reads it (edge-tts)
    await new Promise((resolve) => {
      if (cancelled) return resolve()
      resolveServer = resolve
      audio = new Audio(api.ttsUrl(text.slice(0, 1400), 'en'))
      audio.playbackRate = rate
      const finish = () => {
        resolveServer = null
        resolve()
      }
      audio.onended = finish
      audio.onerror = finish
      audio.play().catch(finish)
    })
  })()
  return { done, cancel }
}

let ctx = null
function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = AC ? new AC() : null
  }
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// A short tone. "listen" = rising (speak now), "ok" = two up, "no" = low.
export function beep(kind = 'listen') {
  const ac = audioContext()
  if (!ac) return Promise.resolve()
  const notes = { listen: [660, 880], ok: [700, 1050], no: [330, 260] }[kind] || [660]
  return new Promise((resolve) => {
    let t = ac.currentTime
    notes.forEach((f) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.frequency.value = f
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
      osc.connect(gain).connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.15)
      t += 0.16
    })
    setTimeout(resolve, notes.length * 160 + 40)
  })
}

export const micSupported = () =>
  typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined' && window.isSecureContext !== false

// Asks for the microphone once per quiz. Returns the stream, or throws an Error with a friendly .message.
export async function openMic() {
  if (!micSupported()) throw new Error('This browser can’t record from a microphone. Use the number keys 1 to 4 instead.')
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  } catch (e) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw new Error('Microphone permission was blocked. Allow it in the address bar, or use the number keys 1 to 4.')
    if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') throw new Error('No microphone was found. Plug one in, or use the number keys 1 to 4.')
    throw new Error('The microphone couldn’t be started. Use the number keys 1 to 4 instead.')
  }
}

export function closeMic(stream) {
  stream?.getTracks().forEach((t) => t.stop())
}

function pickMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']
  return types.find((t) => window.MediaRecorder.isTypeSupported?.(t)) || ''
}

// Records one spoken answer. Stops after `silenceMs` of quiet once speech started, after `maxMs`, or after
// `noSpeechMs` if nothing was said. Resolves to a Blob, or null when no speech was heard or it was cancelled.
// onLevel(0..1) drives the on-screen level meter.
export function recordAnswer(stream, { maxMs = 7000, silenceMs = 1100, noSpeechMs = 6000, onLevel } = {}) {
  let stopRecorder = () => {}
  let cancelled = false
  const done = new Promise((resolve) => {
    const ac = audioContext()
    const mime = pickMime()
    let recorder
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    } catch {
      resolve(null)
      return
    }
    const chunks = []
    let heardSpeech = false
    let lastLoud = performance.now()
    const started = performance.now()
    let raf = 0
    let analyser = null
    let source = null
    if (ac) {
      source = ac.createMediaStreamSource(stream)
      analyser = ac.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
    }
    const buf = new Float32Array(1024)
    const tick = () => {
      const now = performance.now()
      if (analyser) {
        analyser.getFloatTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
        const rms = Math.sqrt(sum / buf.length)
        onLevel?.(Math.min(1, rms * 8))
        if (rms > 0.035) {
          heardSpeech = true
          lastLoud = now
        }
      } else heardSpeech = true // no analyser: rely on the time limit
      const quietTooLong = heardSpeech && now - lastLoud > silenceMs
      const nothingSaid = !heardSpeech && now - started > noSpeechMs
      if (quietTooLong || nothingSaid || now - started > maxMs) return stopRecorder()
      raf = requestAnimationFrame(tick)
    }
    recorder.ondataavailable = (e) => e.data?.size && chunks.push(e.data)
    recorder.onstop = () => {
      cancelAnimationFrame(raf)
      source?.disconnect()
      onLevel?.(0)
      if (cancelled || !heardSpeech || !chunks.length) resolve(null)
      else resolve(new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' }))
    }
    stopRecorder = () => {
      cancelAnimationFrame(raf)
      if (recorder.state !== 'inactive') recorder.stop()
    }
    recorder.start()
    raf = requestAnimationFrame(tick)
  })
  return {
    done,
    stop: () => stopRecorder(),
    cancel: () => {
      cancelled = true
      stopRecorder()
    },
  }
}
