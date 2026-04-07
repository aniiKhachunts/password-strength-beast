import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, ShieldCheck, Skull, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import zxcvbn from 'zxcvbn'

type Tier = 'empty' | 'weak' | 'medium' | 'strong'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function meetsRequirements(password: string) {
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const length8 = password.length >= 8
  const length12 = password.length >= 12
  return { hasLower, hasUpper, hasNumber, hasSymbol, length8, length12 }
}

function evaluateStrength(password: string) {
  if (!password) {
    return {
      score: 0,
      tier: 'empty' as const,
      warning: '',
      suggestions: [] as string[],
    }
  }

  const req = meetsRequirements(password)
  const zx = zxcvbn(password)
  let score: number = zx.score // 0..4

  // Nudge obviously-weak strings down even if zxcvbn is generous.
  if (password.length < 6) score = Math.min(score, 1)
  if (!req.length8) score = Math.min(score, 2)

  const tier: Tier = score <= 1 ? 'weak' : score <= 3 ? 'medium' : 'strong'

  const feedback = zx.feedback ?? { warning: '', suggestions: [] }
  return {
    score,
    tier,
    warning: feedback.warning ?? '',
    suggestions: (feedback.suggestions ?? []).slice(0, 2),
  }
}

function useRumble() {
  const ctxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  useEffect(() => {
    return () => {
      try {
        ctxRef.current?.close()
      } catch {
        // noop
      }
      ctxRef.current = null
      gainRef.current = null
    }
  }, [])

  return {
    play: (ms = 160) => {
      // Create lazily; most browsers require user gesture anyway (typing counts).
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctx) return

      if (!ctxRef.current) {
        ctxRef.current = new Ctx()
        const gain = ctxRef.current.createGain()
        gain.gain.value = 0
        gain.connect(ctxRef.current.destination)
        gainRef.current = gain
      }

      const ctx = ctxRef.current
      const gain = gainRef.current
      if (!ctx || !gain) return

      // Resume if suspended.
      if (ctx.state === 'suspended') void ctx.resume()

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(44, now)

      // Quick tremolo for "rumble"
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.setValueAtTime(10, now)
      const lfoGain = ctx.createGain()
      lfoGain.gain.setValueAtTime(0.012, now)
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)

      osc.connect(gain)

      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.06, now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, now + ms / 1000)

      osc.start(now)
      lfo.start(now)
      osc.stop(now + ms / 1000 + 0.02)
      lfo.stop(now + ms / 1000 + 0.02)
    },
  }
}

function tierColors(tier: Tier) {
  switch (tier) {
    case 'empty':
      return {
        aura: 'rgba(113,113,122,0.18)',
        glow: 'shadow-[0_0_0px_rgba(0,0,0,0)]',
        bar: 'bg-zinc-600/60',
        ring: 'ring-zinc-700/60',
        label: 'text-zinc-300',
      }
    case 'weak':
      return {
        aura: 'rgba(239,68,68,0.22)',
        glow: 'shadow-[0_0_18px_rgba(239,68,68,0.35)]',
        bar: 'bg-red-500',
        ring: 'ring-red-500/30',
        label: 'text-red-300',
      }
    case 'medium':
      return {
        aura: 'rgba(245,158,11,0.22)',
        glow: 'shadow-[0_0_22px_rgba(245,158,11,0.35)]',
        bar: 'bg-yellow-400',
        ring: 'ring-yellow-400/25',
        label: 'text-yellow-200',
      }
    case 'strong':
      return {
        aura: 'rgba(34,211,238,0.18)',
        glow: 'shadow-[0_0_28px_rgba(0,255,255,0.45)]',
        bar: 'bg-cyan-300',
        ring: 'ring-cyan-300/30',
        label: 'text-cyan-200',
      }
  }
}

function strengthLabel(score: number, tier: Tier) {
  if (tier === 'empty') return 'Dormant'
  if (score <= 1) return 'Weak'
  if (score === 2) return 'Fair'
  if (score === 3) return 'Good'
  return 'Strong'
}

function Beast({ tier }: { tier: Tier }) {
  const c = tierColors(tier)

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] blur-3xl"
        style={{
          background: `radial-gradient(closest-side, ${c.aura}, rgba(0,0,0,0))`,
        }}
      />

      <AnimatePresence mode="popLayout" initial={false}>
        {tier === 'empty' && (
          <motion.div
            key="empty"
            layout
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="relative mx-auto grid h-44 w-44 place-items-center rounded-full bg-zinc-900/70 ring-1 ring-zinc-800/70"
          >
            <motion.div
              className="h-24 w-24 rounded-full bg-zinc-700/20 ring-1 ring-zinc-700/30"
              animate={{ scale: [1, 0.985, 1], opacity: [0.9, 0.7, 0.9] }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <div className="absolute bottom-4 text-xs text-zinc-400">
              Dormant egg
            </div>
          </motion.div>
        )}

        {tier === 'weak' && (
          <motion.div
            key="weak"
            layout
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className={`relative mx-auto grid h-52 w-52 place-items-center rounded-[30px] bg-gradient-to-b from-zinc-900/90 to-zinc-950 ring-1 ring-red-500/20 ${c.glow}`}
          >
            <motion.div
              className="relative h-28 w-28 rounded-[40px] bg-red-500/25 ring-1 ring-red-500/35"
              animate={{
                rotate: [-3, 4, -2, 3, 0],
                x: [-2, 2, -1, 1, 0],
                y: [0, -1, 1, -1, 0],
                borderRadius: [
                  '44% 56% 45% 55%',
                  '54% 46% 58% 42%',
                  '50% 50% 44% 56%',
                ],
              }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <div className="absolute inset-0 rounded-[40px] bg-gradient-to-br from-red-500/35 via-red-500/10 to-transparent" />
              <div className="absolute left-7 top-9 h-3 w-3 rounded-full bg-red-200/80" />
              <div className="absolute right-8 top-11 h-2.5 w-2.5 rounded-full bg-red-200/70" />
            </motion.div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-red-200/90">
              <Skull className="h-4 w-4" />
              It hungers for entropy
            </div>
          </motion.div>
        )}

        {tier === 'medium' && (
          <motion.div
            key="medium"
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
            className={`relative mx-auto grid h-60 w-60 place-items-center rounded-[34px] bg-gradient-to-b from-zinc-900/85 to-zinc-950 ring-1 ring-yellow-300/20 ${c.glow}`}
          >
            <motion.div
              className="relative h-36 w-36 rounded-[46px] bg-yellow-400/20 ring-1 ring-yellow-300/35"
              animate={{
                borderRadius: [
                  '44% 56% 52% 48%',
                  '54% 46% 45% 55%',
                  '48% 52% 58% 42%',
                ],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <div className="absolute inset-0 rounded-[46px] bg-gradient-to-tr from-orange-500/20 via-yellow-200/10 to-transparent" />
              <div className="absolute left-10 top-12 h-3.5 w-3.5 rounded-full bg-yellow-100/90" />
              <div className="absolute right-10 top-12 h-3.5 w-3.5 rounded-full bg-yellow-100/90" />

              <motion.div
                className="absolute -left-1 top-3 h-10 w-10 rotate-[-25deg] rounded-[10px] bg-orange-500/20 ring-1 ring-orange-300/25"
                animate={{ y: [0, -2, 0], rotate: [-25, -18, -25] }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.div
                className="absolute -right-1 top-3 h-10 w-10 rotate-[25deg] rounded-[10px] bg-orange-500/20 ring-1 ring-orange-300/25"
                animate={{ y: [0, -2, 0], rotate: [25, 18, 25] }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </motion.div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-yellow-100/90">
              <ShieldCheck className="h-4 w-4" />
              Growing… keep feeding it
            </div>
          </motion.div>
        )}

        {tier === 'strong' && (
          <motion.div
            key="strong"
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className={`relative mx-auto grid h-72 w-72 place-items-center rounded-[38px] bg-gradient-to-b from-zinc-900/75 to-zinc-950 ring-1 ring-cyan-300/25 ${c.glow}`}
          >
            <motion.div
              className="relative h-44 w-44 rounded-[56px] bg-gradient-to-br from-purple-500/25 via-cyan-400/15 to-transparent ring-1 ring-cyan-200/35"
              animate={{
                boxShadow: [
                  '0 0 0px rgba(0,255,255,0.0)',
                  '0 0 30px rgba(0,255,255,0.35)',
                  '0 0 0px rgba(0,255,255,0.0)',
                ],
                borderRadius: [
                  '52% 48% 56% 44%',
                  '48% 52% 44% 56%',
                  '50% 50% 54% 46%',
                ],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <div className="absolute inset-0 rounded-[56px] bg-[radial-gradient(circle_at_30%_25%,rgba(0,255,255,0.25),transparent_45%),radial-gradient(circle_at_70%_65%,rgba(168,85,247,0.25),transparent_50%)]" />

              <div className="absolute left-14 top-16 h-4 w-4 rounded-full bg-cyan-100/95 shadow-[0_0_18px_rgba(0,255,255,0.55)]" />
              <div className="absolute right-14 top-16 h-4 w-4 rounded-full bg-cyan-100/95 shadow-[0_0_18px_rgba(0,255,255,0.55)]" />

              <motion.div
                className="absolute -left-2 top-7 h-12 w-12 rotate-[-30deg] rounded-[12px] bg-purple-400/15 ring-1 ring-purple-300/20"
                animate={{ y: [0, -2, 0], rotate: [-30, -24, -30] }}
                transition={{
                  duration: 1.9,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.div
                className="absolute -right-2 top-7 h-12 w-12 rotate-[30deg] rounded-[12px] bg-purple-400/15 ring-1 ring-purple-300/20"
                animate={{ y: [0, -2, 0], rotate: [30, 24, 30] }}
                transition={{
                  duration: 1.9,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </motion.div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-cyan-100/90">
              <Sparkles className="h-4 w-4" />
              Epic creature awakened
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RequirementRow({
  ok,
  label,
}: {
  ok: boolean
  label: string
}) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm',
        ok
          ? 'bg-emerald-500/10 text-emerald-200 line-through decoration-emerald-400/70'
          : 'bg-zinc-900/50 text-zinc-300',
      ].join(' ')}
    >
      <span className="truncate">{label}</span>
      <span className={ok ? 'text-emerald-300' : 'text-zinc-500'}>
        {ok ? '✓' : '•'}
      </span>
    </div>
  )
}

export function PasswordStrengthBeast() {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const rumble = useRumble()

  const strength = useMemo(() => evaluateStrength(password), [password])
  const req = useMemo(() => meetsRequirements(password), [password])

  const barPct = useMemo(() => {
    if (strength.tier === 'empty') return 0
    return clamp(((strength.score + 1) / 5) * 100, 8, 100)
  }, [strength.score, strength.tier])

  const c = tierColors(strength.tier)
  const label = strengthLabel(strength.score, strength.tier)

  const lastTypedAt = useRef(0)
  useEffect(() => {
    if (strength.tier !== 'weak') return
    if (!password) return
    const now = Date.now()
    if (now - lastTypedAt.current < 130) return
    lastTypedAt.current = now
    rumble.play(160)
  }, [password, strength.tier, rumble])

  const inputShake =
    strength.tier === 'weak' && password
      ? {
          x: [0, -6, 6, -4, 4, -2, 2, 0],
        }
      : { x: 0 }

  return (
    <motion.div
      className="relative min-h-dvh overflow-hidden px-4 py-10"
      animate={{
        background: `radial-gradient(900px circle at 50% 12%, ${
          c.aura
        }, rgba(9,9,11,0) 55%), radial-gradient(700px circle at 20% 85%, rgba(168,85,247,0.10), rgba(9,9,11,0) 55%), radial-gradient(700px circle at 80% 85%, rgba(0,255,255,0.08), rgba(9,9,11,0) 55%)`,
      }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300 ring-1 ring-zinc-800/70">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/70" />
            Password Strength Beast
          </div>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-50">
            Feed the beast a better password
          </h1>
          <p className="mt-2 text-pretty text-sm text-zinc-300/90">
            Watch it evolve with complexity. Weak passwords make it rumble.
          </p>
        </div>

        <Beast tier={strength.tier} />

        <div className="w-full rounded-2xl bg-zinc-950/40 p-5 ring-1 ring-zinc-800/70 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-200">Strength</div>
            <div className={`text-xs font-semibold ${c.label}`}>{label}</div>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-900 ring-1 ring-zinc-800/70">
            <motion.div
              className={`h-full ${c.bar}`}
              initial={false}
              animate={{ width: `${barPct}%` }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
            />
          </div>

          <div className="mt-5">
            <motion.div
              className={[
                'rounded-xl bg-zinc-950/60 p-3 ring-1',
                c.ring,
                strength.tier === 'strong'
                  ? 'shadow-[0_0_20px_rgba(0,255,255,0.25)]'
                  : '',
              ].join(' ')}
              animate={inputShake}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <label className="sr-only" htmlFor="password">
                Password
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Type a password…"
                  className="h-12 w-full bg-transparent px-1 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900/60 text-zinc-300 ring-1 ring-zinc-800/70 transition hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? (
                    <EyeOff className="h-4.5 w-4.5" />
                  ) : (
                    <Eye className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            </motion.div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <RequirementRow ok={req.length8} label="At least 8 characters" />
              <RequirementRow ok={req.hasNumber} label="Contains a number" />
              <RequirementRow
                ok={req.hasUpper}
                label="Has an uppercase letter"
              />
              <RequirementRow
                ok={req.hasSymbol}
                label="Includes a symbol"
              />
              <RequirementRow
                ok={req.hasLower}
                label="Has a lowercase letter"
              />
              <RequirementRow
                ok={req.length12}
                label="12+ characters (bonus)"
              />
            </div>

            <AnimatePresence initial={false}>
              {(strength.warning || strength.suggestions.length > 0) &&
                strength.tier !== 'strong' && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 rounded-xl bg-zinc-900/40 p-3 text-sm text-zinc-300 ring-1 ring-zinc-800/70"
                  >
                    {strength.warning && (
                      <div className="font-medium text-zinc-200">
                        {strength.warning}
                      </div>
                    )}
                    {strength.suggestions.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-300/90">
                        {strength.suggestions.map((s: string) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
            </AnimatePresence>
          </div>
        </div>

        <div className="text-center text-xs text-zinc-500">
          Tip: avoid common words, reuse, and predictable patterns.
        </div>
      </div>
    </motion.div>
  )
}

