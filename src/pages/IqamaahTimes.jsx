import { useEffect, useMemo, useState } from 'react'
import {
  createIqamaahRange,
  deleteIqamaahRange,
  fetchIqamaahTimesMonth,
  updateIqamaahRange,
} from '../services/api'
import './IqamaahTimes.css'

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'isha', 'jumuah']

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function isoDate(year, month1to12, day) {
  const m = String(month1to12).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function parseISO(dateStr) {
  // Safe parse for YYYY-MM-DD (local date)
  const [y, m, d] = (dateStr || '').split('-').map(n => Number.parseInt(n, 10))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function isPlaceholderTime(v) {
  const s = String(v || '').trim()
  return !s || s === '--:--' || s === '00:00'
}

function normalizeDateValue(v) {
  const s = String(v || '').trim()
  // Accept YYYY-MM-DD or ISO datetime; date input needs YYYY-MM-DD
  if (s.length >= 10) return s.slice(0, 10)
  return s
}

function normalizeTimeValue(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  // Common backend formats: HH:MM:SS -> HH:MM, H:MM -> 0H:MM
  const hhmmss = s.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)
  if (hhmmss) {
    const hh = String(hhmmss[1]).padStart(2, '0')
    const mm = hhmmss[2]
    return `${hh}:${mm}`
  }
  return s
}

function addDays(dateStr, days) {
  const dt = parseISO(dateStr)
  if (!dt) return null
  dt.setDate(dt.getDate() + days)
  return isoDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function buildRangesFromDaily(daily, prayer) {
  // daily: [{ date: 'YYYY-MM-DD', fajr: '05:40', ... }, ...]
  const records = Array.isArray(daily) ? [...daily] : []
  records.sort((a, b) => normalizeDateValue(a?.date).localeCompare(normalizeDateValue(b?.date)))

  const ranges = []

  if (prayer === 'jumuah') {
    // Support multi-time jumuah (e.g., ["13:30", "14:15"]) by grouping per index.
    const runs = new Map() // key: index -> { startDate, endDate, time }

    for (const row of records) {
      const date = normalizeDateValue(row?.date)
      const raw = row?.jumuah
      const times = Array.isArray(raw) ? raw : (raw ? [raw] : [])

      // Close runs that no longer exist today
      const activeIndexes = new Set(times.map((_, idx) => idx))
      for (const [idx, run] of runs.entries()) {
        if (!activeIndexes.has(idx)) {
          ranges.push(run)
          runs.delete(idx)
        }
      }

      times.forEach((t, idx) => {
        const normalized = normalizeTimeValue(t)
        if (isPlaceholderTime(normalized)) {
          const existing = runs.get(idx)
          if (existing) {
            ranges.push(existing)
            runs.delete(idx)
          }
          return
        }

        const time = normalized
        const run = runs.get(idx)
        if (!run) {
          runs.set(idx, { startDate: date, endDate: date, time })
          return
        }

        const expectedNext = addDays(run.endDate, 1)
        if (expectedNext === date && run.time === time) {
          run.endDate = date
        } else {
          ranges.push(run)
          runs.set(idx, { startDate: date, endDate: date, time })
        }
      })
    }

    for (const run of runs.values()) ranges.push(run)
    ranges.sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
    return ranges
  }

  let current = null
  for (const row of records) {
    const date = normalizeDateValue(row?.date)
    const t = normalizeTimeValue(row?.[prayer])
    if (isPlaceholderTime(t)) {
      if (current) {
        ranges.push(current)
        current = null
      }
      continue
    }

    const time = t
    if (!current) {
      current = { startDate: date, endDate: date, time }
      continue
    }

    const expectedNext = addDays(current.endDate, 1)
    if (expectedNext === date && current.time === time) {
      current.endDate = date
    } else {
      ranges.push(current)
      current = { startDate: date, endDate: date, time }
    }
  }

  if (current) ranges.push(current)
  ranges.sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
  return ranges
}

function clampPayload(raw) {
  const base = {}
  for (const p of PRAYERS) base[p] = []
  if (!raw) return base

  // If backend returns day-by-day entries for the month, compress into ranges.
  if (Array.isArray(raw)) {
    for (const p of PRAYERS) {
      base[p] = buildRangesFromDaily(raw, p)
    }
    return base
  }

  if (typeof raw !== 'object') return base

  // Sometimes unwrap() returns an object that still contains the daily array.
  const dailyMaybe =
    (Array.isArray(raw.days) && raw.days) ||
    (Array.isArray(raw.items) && raw.items) ||
    (Array.isArray(raw.rows) && raw.rows) ||
    (Array.isArray(raw.entries) && raw.entries) ||
    null

  if (dailyMaybe) {
    for (const p of PRAYERS) base[p] = buildRangesFromDaily(dailyMaybe, p)
    return base
  }

  // Some backends wrap the payload
  const container =
    raw.iqamaahTimes ||
    raw.iqamaah_times ||
    raw.iqamaah ||
    raw.timings ||
    raw.prayers ||
    raw.times ||
    raw.ranges ||
    raw.payload ||
    raw

  // Allow alternative spellings
  const aliases = {
    fajr: ['fajr', 'fajar'],
    dhuhr: ['dhuhr', 'zuhr', 'zohar', 'zohr'],
    maghrib: ['maghrib', 'magrib', 'magreb'],
    isha: ['isha', 'ishaa'],
    jumuah: ['jumuah', 'jummah', 'jumuahTimes'],
  }

  for (const p of PRAYERS) {
    const keys = aliases[p] || [p]
    let v
    for (const k of keys) {
      v = container?.[k] ?? container?.[String(k).toLowerCase()] ?? container?.[String(k).toUpperCase()]
      if (v !== undefined) break
    }

    // Accept either [] or { ranges: [] }
    if (Array.isArray(v)) base[p] = v
    else if (v && typeof v === 'object' && Array.isArray(v.ranges)) base[p] = v.ranges
    else base[p] = []
  }

  // Normalize dates/times so inputs always render values.
  for (const p of PRAYERS) {
    base[p] = (base[p] || []).map(r => ({
      ...r,
      startDate: normalizeDateValue(r?.startDate),
      endDate: normalizeDateValue(r?.endDate),
      time: normalizeTimeValue(r?.time),
    }))
  }

  // Keep a stable, user-friendly order so index-based edits are correct
  for (const p of PRAYERS) {
    base[p] = [...base[p]].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
  }

  return base
}

function isValidTime(t) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''))
}

export default function IqamaahTimes() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-12

  const [data, setData] = useState(() => clampPayload(null))
  const [originalData, setOriginalData] = useState(() => clampPayload(null))
  const [activePrayer, setActivePrayer] = useState('fajr')

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [monthHasData, setMonthHasData] = useState(false)
  const [actionLoading, setActionLoading] = useState('')

  const [newRange, setNewRange] = useState(() => ({
    startDate: isoDate(year, month, 1),
    endDate: isoDate(year, month, 1),
    time: '05:30',
  }))

  // Keep new-range defaults aligned to month/year
  useEffect(() => {
    setNewRange(prev => ({
      ...prev,
      startDate: isoDate(year, month, 1),
      endDate: isoDate(year, month, 1),
    }))
  }, [year, month])

  const loadMonth = async () => {
    setLoading(true)
    setMessage('')
    setMessageType('')
    try {
      const res = await fetchIqamaahTimesMonth(year, month)
      setMonthHasData(res !== null)
      const normalized = clampPayload(res)
      setData(normalized)
      setOriginalData(normalized)
    } catch (e) {
      setData(clampPayload(null))
      setOriginalData(clampPayload(null))
      setMonthHasData(false)
      setMessage(e.message || 'Failed to load iqamaah times')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMonth()
  }, [year, month])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => {
      setMessage('')
      setMessageType('')
    }, 4500)
    return () => clearTimeout(t)
  }, [message])

  const monthBounds = useMemo(() => {
    const last = new Date(year, month, 0)
    return {
      start: isoDate(year, month, 1),
      end: isoDate(year, month, last.getDate()),
      daysInMonth: last.getDate(),
      monthLabel: `${monthNames[month - 1]} ${year}`,
    }
  }, [year, month])

  const ranges = data[activePrayer] || []

  const updateRangeAt = (index, patch) => {
    setData(prev => {
      const next = { ...prev }
      const ranges = [...(next[activePrayer] || [])]
      ranges[index] = { ...ranges[index], ...patch }
      next[activePrayer] = ranges
      return next
    })
  }

  const addRange = async () => {
    const start = parseISO(newRange.startDate)
    const end = parseISO(newRange.endDate)
    if (!start || !end) {
      setMessage('Please select start and end dates')
      setMessageType('error')
      return
    }
    if (start.getTime() > end.getTime()) {
      setMessage('Start date must be before end date')
      setMessageType('error')
      return
    }
    if (!isValidTime(newRange.time)) {
      setMessage('Time must be in HH:MM (24h) format')
      setMessageType('error')
      return
    }

    setActionLoading('add')
    setMessage('')
    setMessageType('')
    try {
      await createIqamaahRange({
        prayer: activePrayer,
        startDate: newRange.startDate,
        endDate: newRange.endDate,
        time: newRange.time,
      })
      setMessage('Range saved')
      setMessageType('success')
      await loadMonth()
    } catch (e) {
      setMessage(e.message || 'Failed to add range')
      setMessageType('error')
    } finally {
      setActionLoading('')
    }
  }

  const setFullMonth = () => {
    setNewRange(r => ({
      ...r,
      startDate: monthBounds.start,
      endDate: monthBounds.end,
    }))
  }

  const updateRange = async (range, index) => {
    if (!range.startDate || !range.endDate || !isValidTime(range.time)) {
      setMessage('Please provide valid dates and time')
      setMessageType('error')
      return
    }

    const original = (originalData[activePrayer] || [])[index] || range

    setActionLoading('update')
    setMessage('')
    setMessageType('')
    try {
      await updateIqamaahRange({
        prayer: activePrayer,
        oldStartDate: original.startDate,
        oldEndDate: original.endDate,
        oldTime: original.time,
        startDate: range.startDate,
        endDate: range.endDate,
        time: range.time,
      })
      setMessage('Range updated')
      setMessageType('success')
      await loadMonth()
    } catch (e) {
      setMessage(e.message || 'Failed to update range')
      setMessageType('error')
    } finally {
      setActionLoading('')
    }
  }

  const removeRange = async (range) => {
    if (!range.startDate || !range.endDate) {
      setMessage('Please provide valid dates')
      setMessageType('error')
      return
    }

    setActionLoading('delete')
    setMessage('')
    setMessageType('')
    try {
      const payload = {
        prayer: activePrayer,
        startDate: range.startDate,
        endDate: range.endDate,
      }
      if (activePrayer === 'jumuah' && range.time) payload.time = range.time
      await deleteIqamaahRange(payload)
      setMessage('Range deleted')
      setMessageType('success')
      await loadMonth()
    } catch (e) {
      setMessage(e.message || 'Failed to delete range')
      setMessageType('error')
    } finally {
      setActionLoading('')
    }
  }

  const prevMonth = () => {
    setMonth(m => {
      if (m === 1) {
        setYear(y => y - 1)
        return 12
      }
      return m - 1
    })
  }

  const nextMonth = () => {
    setMonth(m => {
      if (m === 12) {
        setYear(y => y + 1)
        return 1
      }
      return m + 1
    })
  }

  return (
    <div className="page">
      <div className="card">
        <div className="page-head">
          <div>
            <h1 className="page-title">Iqamaah Times</h1>
            <p className="muted">Add, update, or delete ranges for each prayer.</p>
          </div>
        </div>

        <div className="iq-controls">
          <div className="iq-month">
            <button type="button" className="iq-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
            <div className="iq-month-label">
              <div className="iq-month-title">{monthBounds.monthLabel}</div>
              <div className="iq-month-sub">{monthHasData ? '' : ''}</div>
            </div>
            <button type="button" className="iq-btn" onClick={nextMonth} aria-label="Next month">›</button>
          </div>

          <div className="iq-prayers">
            {PRAYERS.map(p => (
              <button
                key={p}
                type="button"
                className={p === activePrayer ? 'iq-pill iq-pill-active' : 'iq-pill'}
                onClick={() => setActivePrayer(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="iq-loading">
            <div className="skeleton-title" />
            <div className="skeleton-line" />
            <div className="skeleton-grid" />
          </div>
        ) : (
          <div className="iq-simple">
            <section className="iq-editor">
              <div className="iq-editor-head">
                <div>
                  <div className="iq-editor-title">Ranges: {activePrayer}</div>
                  <div className="iq-editor-sub muted">Changes are saved per range.</div>
                </div>
                <div className="iq-hint">Month: {monthBounds.start} → {monthBounds.end} ({monthBounds.daysInMonth} days)</div>
              </div>

              <div className="iq-add">
                <div className="iq-add-row">
                  <label>
                    <span>Start</span>
                    <input
                      type="date"
                      value={newRange.startDate}
                      onChange={(e) => setNewRange(r => ({ ...r, startDate: e.target.value }))}
                      className="iq-input"
                    />
                  </label>
                  <label>
                    <span>End</span>
                    <input
                      type="date"
                      value={newRange.endDate}
                      onChange={(e) => setNewRange(r => ({ ...r, endDate: e.target.value }))}
                      className="iq-input"
                    />
                  </label>
                  <button type="button" className="iq-btn" onClick={setFullMonth}>
                    Full month
                  </button>
                </div>
                <div className="iq-add-row">
                  <label className="iq-grow">
                    <span>Time</span>
                    <input
                      type="time"
                      value={newRange.time}
                      onChange={(e) => setNewRange(r => ({ ...r, time: e.target.value }))}
                      className="iq-input"
                    />
                  </label>
                  <button type="button" className="iq-btn iq-btn-primary" onClick={addRange} disabled={actionLoading !== ''}>
                    {actionLoading === 'add' ? 'Saving…' : 'Add range'}
                  </button>
                </div>
              </div>

              <div className="iq-range-list">
                {ranges.length === 0 ? (
                  <div className="muted">No ranges yet for this prayer.</div>
                ) : (
                  ranges.map((r, idx) => (
                    <div key={`${r.startDate}-${r.endDate}-${idx}`} className="iq-range">
                      <input
                        type="date"
                        value={r.startDate}
                        className="iq-input"
                        onChange={(e) => updateRangeAt(idx, { startDate: e.target.value })}
                      />
                      <input
                        type="date"
                        value={r.endDate}
                        className="iq-input"
                        onChange={(e) => updateRangeAt(idx, { endDate: e.target.value })}
                      />
                      <input
                        type="time"
                        value={r.time}
                        className="iq-input"
                        onChange={(e) => updateRangeAt(idx, { time: e.target.value })}
                      />
                      <button
                        type="button"
                        className="iq-btn"
                        onClick={() => updateRange(r, idx)}
                        disabled={actionLoading !== ''}
                      >
                        {actionLoading === 'update' ? 'Updating…' : 'Update'}
                      </button>
                      <button
                        type="button"
                        className="iq-btn iq-btn-danger"
                        onClick={() => removeRange(r)}
                        disabled={actionLoading !== ''}
                      >
                        {actionLoading === 'delete' ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {message && (
          <div className={messageType === 'success' ? 'message success' : 'message error'}>
            <span className="message-icon">{messageType === 'success' ? '✓' : '✕'}</span>
            <span className="message-text">{message}</span>
            <button type="button" className="message-close" onClick={() => { setMessage(''); setMessageType('') }}>
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
