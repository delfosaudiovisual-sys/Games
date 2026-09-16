type Sfx =
  | 'shot'
  | 'boom'
  | 'zap'
  | 'freeze'
  | 'build'
  | 'upgrade'
  | 'sell'
  | 'leak'
  | 'wave'
  | 'win'
  | 'lose'
  | 'pick'
  | 'coin'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
let lastAt: Record<string, number> = {}

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.16
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setMuted(value: boolean): void {
  muted = value
  if (master) master.gain.value = value ? 0 : 0.16
}

export function isMuted(): boolean {
  return muted
}

export function unlockAudio(): void {
  ensure()
}

interface ToneOpts {
  freq: number
  to?: number
  dur: number
  type?: OscillatorType
  gain?: number
  delay?: number
}

function tone({ freq, to, dur, type = 'sine', gain = 1, delay = 0 }: ToneOpts): void {
  const ac = ensure()
  if (!ac || !master || muted) return
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function noise(dur: number, gain: number, filterFreq: number): void {
  const ac = ensure()
  if (!ac || !master || muted) return
  const frames = Math.floor(ac.sampleRate * dur)
  const buffer = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = filterFreq
  const g = ac.createGain()
  g.gain.value = gain
  src.connect(filter)
  filter.connect(g)
  g.connect(master)
  src.start()
}

export function play(sfx: Sfx): void {
  if (muted) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const throttle: Record<string, number> = { shot: 55, zap: 70, boom: 60, freeze: 90, coin: 120 }
  const limit = throttle[sfx]
  if (limit) {
    if (lastAt[sfx] && now - lastAt[sfx] < limit) return
    lastAt[sfx] = now
  }

  switch (sfx) {
    case 'shot':
      tone({ freq: 880, to: 420, dur: 0.06, type: 'square', gain: 0.1 })
      break
    case 'boom':
      noise(0.34, 0.5, 900)
      tone({ freq: 130, to: 40, dur: 0.3, type: 'sine', gain: 0.5 })
      break
    case 'zap':
      tone({ freq: 1500, to: 300, dur: 0.1, type: 'sawtooth', gain: 0.14 })
      break
    case 'freeze':
      tone({ freq: 500, to: 1600, dur: 0.22, type: 'triangle', gain: 0.16 })
      break
    case 'build':
      tone({ freq: 320, to: 660, dur: 0.14, type: 'triangle', gain: 0.35 })
      tone({ freq: 660, dur: 0.12, type: 'sine', gain: 0.2, delay: 0.09 })
      break
    case 'upgrade':
      tone({ freq: 520, dur: 0.1, type: 'triangle', gain: 0.3 })
      tone({ freq: 780, dur: 0.1, type: 'triangle', gain: 0.3, delay: 0.08 })
      tone({ freq: 1040, dur: 0.16, type: 'triangle', gain: 0.3, delay: 0.16 })
      break
    case 'sell':
      tone({ freq: 620, to: 200, dur: 0.18, type: 'triangle', gain: 0.28 })
      break
    case 'leak':
      tone({ freq: 220, to: 90, dur: 0.4, type: 'sawtooth', gain: 0.35 })
      noise(0.25, 0.28, 500)
      break
    case 'wave':
      tone({ freq: 300, to: 600, dur: 0.28, type: 'sawtooth', gain: 0.22 })
      break
    case 'coin':
      tone({ freq: 1100, dur: 0.06, type: 'square', gain: 0.09 })
      tone({ freq: 1600, dur: 0.07, type: 'square', gain: 0.07, delay: 0.05 })
      break
    case 'pick':
      tone({ freq: 700, to: 1300, dur: 0.18, type: 'sine', gain: 0.3 })
      break
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) =>
        tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.32, delay: i * 0.13 }),
      )
      break
    case 'lose':
      [440, 350, 262, 180].forEach((f, i) =>
        tone({ freq: f, dur: 0.36, type: 'sawtooth', gain: 0.3, delay: i * 0.16 }),
      )
      break
  }
}
