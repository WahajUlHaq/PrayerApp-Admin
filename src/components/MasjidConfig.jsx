import { useEffect, useMemo, useState } from 'react'
import Cropper from 'react-easy-crop'
import {
  deleteBanner,
  fetchBanners,
  fetchMasjidConfig,
  saveMasjidConfig,
  updateBannerOrder,
  uploadBanners,
} from '../services/api'
import { useSocketReload } from '../hooks/useSocketReload'
import './MasjidConfig.css'

const NUMERIC_FIELDS = new Set([
  'method',
  'school',
  'midnightMode',
  'latitudeAdjustmentMethod',
])

const TICKER_DELIM = '|||' // unique delimiter for storing multiple tickers
const ANNOUNCEMENT_DELIM = '|||' // unique delimiter for storing multiple announcements

export default function MasjidConfig() {
  const { isReloading, reloadMessage, reloadMessageType, notifyReload } = useSocketReload()
  
  const [formData, setFormData] = useState({
    address: '',
    method: 0,
    shafaq: 'general',
    tune: '',
    school: 0,
    midnightMode: 0,
    latitudeAdjustmentMethod: 1,
    calendarMethod: 'HJCoSA',
    qrLink: '',
    timeZone: '',
    tickerText: '',
    announcements: '',
    maghribSunsetAdditionMinutes: '',
    shuffleImages: false,
    sequenceImages: false,
    alwaysDisplayIqamaahTime: false,
    displayTimerDuration: '',
    useMobileTTS: false,
  })

  const [tickers, setTickers] = useState([''])
  const [announcements, setAnnouncements] = useState([''])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('') // 'success', 'error'
  const [configExists, setConfigExists] = useState(false)

  const [banners, setBanners] = useState([])
  const [bannerLoading, setBannerLoading] = useState(true)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [bannerDeleting, setBannerDeleting] = useState(null) // Tracks filename being deleted
  const [bannerUpdating, setBannerUpdating] = useState(null) // Tracks filename being updated
  const [bannerReordering, setBannerReordering] = useState(false)
  const [bannerMessage, setBannerMessage] = useState('')
  const [bannerMessageType, setBannerMessageType] = useState('')
  const [bannerInputKey, setBannerInputKey] = useState(0)
  const [selectedBanners, setSelectedBanners] = useState([])
  const [cropIndex, setCropIndex] = useState(-1)
  const [cropTarget, setCropTarget] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [cropping, setCropping] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [pendingDurations, setPendingDurations] = useState({})

  const cropItem = useMemo(() => {
    if (cropTarget?.type === 'selected') return selectedBanners[cropTarget.index] || null
    if (cropTarget?.type === 'existing') return cropTarget
    return null
  }, [cropTarget, selectedBanners])

  // Prayer method options
  const methodOptions = [
    { value: 0, label: 'Jafari / Shia Ithna-Ashari' },
    { value: 1, label: 'University of Islamic Sciences, Karachi' },
    { value: 2, label: 'Islamic Society of North America' },
    { value: 3, label: 'Muslim World League' },
    { value: 4, label: 'Umm Al-Qura University, Makkah' },
    { value: 5, label: 'Egyptian General Authority of Survey' },
    { value: 7, label: 'Institute of Geophysics, University of Tehran' },
    { value: 8, label: 'Gulf Region' },
    { value: 9, label: 'Kuwait' },
    { value: 10, label: 'Qatar' },
    { value: 11, label: 'Majlis Ugama Islam Singapura, Singapore' },
    { value: 12, label: 'Union Organization islamic de France' },
    { value: 13, label: 'Diyanet İşleri Başkanlığı, Turkey' },
    { value: 14, label: 'Spiritual Administration of Muslims of Russia' },
    { value: 15, label: 'Moonsighting Committee Worldwide' },
    { value: 16, label: 'Dubai (experimental)' },
    { value: 17, label: 'Jabatan Kemajuan Islam Malaysia (JAKIM)' },
    { value: 18, label: 'Tunisia' },
    { value: 19, label: 'Algeria' },
    { value: 20, label: 'KEMENAG - Kementerian Agama Republik Indonesia' },
    { value: 21, label: 'Morocco' },
    { value: 22, label: 'Comunidade Islamica de Lisboa' },
    { value: 23, label: 'Ministry of Awqaf, Islamic Affairs and Holy Places, Jordan' },
  ]

  const timeZoneOptions = [
    'Asia/Karachi',
    'Asia/Riyadh',
    'Asia/Kolkata',
    'Asia/Tehran',
    'Europe/London',
    'Europe/Paris',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
  ]

  // Load existing config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await fetchMasjidConfig()
        const looksLikeConfig =
          config && typeof config === 'object' && Object.keys(config).length > 0

        if (looksLikeConfig) {
          setFormData(prev => ({ ...prev, ...config }))
          const rawTicker = String(config.tickerText || '')
          const parts = rawTicker.includes(TICKER_DELIM)
            ? rawTicker.split(TICKER_DELIM)
            : rawTicker
              ? [rawTicker]
              : ['']
          setTickers(parts.length ? parts : [''])
          
          const rawAnnouncements = String(config.announcements || '')
          const announcementParts = rawAnnouncements.includes(ANNOUNCEMENT_DELIM)
            ? rawAnnouncements.split(ANNOUNCEMENT_DELIM)
            : rawAnnouncements
              ? [rawAnnouncements]
              : ['']
          setAnnouncements(announcementParts.length ? announcementParts : [''])
          
          setConfigExists(true)
          return
        }

        setConfigExists(false)
      } catch (error) {
        console.error('Error loading config:', error)
        setMessage('Failed to load configuration. Please refresh the page.')
        setMessageType('error')
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [])

  const loadBanners = async () => {
    setBannerLoading(true)
    try {
      const res = await fetchBanners()
      setBanners(Array.isArray(res) ? res : res?.data || [])
    } catch (error) {
      setBannerMessage(error.message || 'Failed to load banners')
      setBannerMessageType('error')
    } finally {
      setBannerLoading(false)
    }
  }

  useEffect(() => {
    loadBanners()
  }, [])

  // Auto-dismiss messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('')
        setMessageType('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  useEffect(() => {
    if (!bannerMessage) return
    const timer = setTimeout(() => {
      setBannerMessage('')
      setBannerMessageType('')
    }, 5000)
    return () => clearTimeout(timer)
  }, [bannerMessage])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (NUMERIC_FIELDS.has(name) ? Number.parseInt(value, 10) : value)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.address.trim()) {
      setMessage('Address is required!')
      setMessageType('error')
      return
    }

    if (!formData.qrLink.trim()) {
      setMessage('QR Link is required!')
      setMessageType('error')
      return
    }

    if (!formData.timeZone.trim()) {
      setMessage('Time Zone is required!')
      setMessageType('error')
      return
    }

    // Validate displayTimerDuration based on alwaysDisplayIqamaahTime
    if (formData.alwaysDisplayIqamaahTime) {
      // displayTimerDuration is optional when alwaysDisplayIqamaahTime is true
    } else {
      // displayTimerDuration is required when alwaysDisplayIqamaahTime is false
      if (!formData.displayTimerDuration || formData.displayTimerDuration <= 0) {
        setMessage('Display Timer Duration is required when "Always Display Iqamaah Time" is disabled!')
        setMessageType('error')
        return
      }
    }

    setSaving(true)
    setMessage('')
    setMessageType('')

    try {
      // Always send the full config payload
        const tickerText = tickers
          .map(item => String(item || '').trim())
          .filter(Boolean)
          .join(TICKER_DELIM)

        const announcementsText = announcements
          .map(item => String(item || '').trim())
          .filter(Boolean)
          .join(ANNOUNCEMENT_DELIM)

        const payload = {
        ...formData,
        tune: typeof formData.tune === 'string' ? formData.tune.replace(/\s+/g, '') : formData.tune,
        address: formData.address.trim(),
        qrLink: formData.qrLink.trim(),
        timeZone: formData.timeZone.trim(),
          tickerText,
          announcements: announcementsText,
      }

      await saveMasjidConfig(payload, { exists: configExists })
      setConfigExists(true)
      
      // Notify clients to reload (this will show the success message)
      // await notifyReload(configExists ? 'Masjid configuration updated' : 'Masjid configuration saved')
    } catch (error) {
      const errorMsg = error.message || 'An error occurred while saving configuration'
      setMessage(errorMsg)
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  const handleBannerSelect = (e) => {
    const files = Array.from(e.target.files || [])
    const items = files.map((file, idx) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${idx}`,
      file,
      previewUrl: URL.createObjectURL(file),
      croppedFile: null,
      croppedUrl: null,
      duration: 5,
    }))
    setSelectedBanners(items)
  }

  const handleUploadBanners = async () => {
    if (!selectedBanners.length) {
      setBannerMessage('Please select at least one image')
      setBannerMessageType('error')
      return
    }

    setBannerUploading(true)
    setBannerMessage('')
    setBannerMessageType('')
    try {
      const filesToUpload = selectedBanners.map(item => item.croppedFile || item.file)
      const durations = selectedBanners.map(item => item.duration || 5)
      await uploadBanners(filesToUpload, durations)
      selectedBanners.forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
        if (item.croppedUrl) URL.revokeObjectURL(item.croppedUrl)
      })
      setSelectedBanners([])
      setBannerInputKey(k => k + 1)
      await loadBanners()
      
      // Notify clients to reload (this will show the success message)
      await notifyReload('Banners uploaded successfully')
    } catch (error) {
      setBannerMessage(error.message || 'Failed to upload banners')
      setBannerMessageType('error')
    } finally {
      setBannerUploading(false)
    }
  }

  const handleRemoveSelected = (index) => {
    setSelectedBanners(prev => {
      const next = [...prev]
      const item = next[index]
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      if (item?.croppedUrl) URL.revokeObjectURL(item.croppedUrl)
      next.splice(index, 1)
      return next
    })
  }

  const updateSelectedBannerDuration = (index, duration) => {
    setSelectedBanners(prev => {
      const next = [...prev]
      next[index] = { ...next[index], duration: duration === '' ? '' : Number(duration) }
      return next
    })
  }

  const updateBannerDuration = async (filename, duration) => {
    const numValue = duration === '' ? '' : Number(duration)
    
    // Update the banner locally first
    const updatedBanners = banners.map(b => b.filename === filename ? { ...b, duration: numValue } : b)
    setBanners(updatedBanners)
    
    // Store the pending duration change
    setPendingDurations(prev => ({
      ...prev,
      [filename]: numValue
    }))
  }

  const saveBannerDuration = async (filename) => {
    try {
      const duration = pendingDurations[filename]
      if (duration === undefined || duration === '' || duration < 1) {
        setBannerMessage('Duration must be at least 1 second')
        setBannerMessageType('error')
        return
      }
      
      setBannerUpdating(filename)
      // Send all banners with updated duration to maintain order
      const orderData = { 
        banners: banners.map(b => ({ 
          filename: b.filename,
          duration: b.duration || 5
        })) 
      }
      await updateBannerOrder(orderData)
      
      // Clear pending duration
      setPendingDurations(prev => {
        const next = { ...prev }
        delete next[filename]
        return next
      })
      
      // Notify clients to reload (this will show the success message)
      // await notifyReload('Banner duration updated successfully')
    } catch (error) {
      setBannerMessage(error.message || 'Failed to update duration')
      setBannerMessageType('error')
      // Reload banners on error to restore correct state
      await loadBanners()
    } finally {
      setBannerUpdating(null)
    }
  }

  const startCrop = (index) => {
    setCropTarget({ type: 'selected', index })
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const startCropExisting = (banner) => {
    setCropTarget({ type: 'existing', url: banner.url, filename: banner.filename })
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const onCropComplete = (_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels)
  }

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', error => reject(error))
      image.setAttribute('crossOrigin', 'anonymous')
      image.src = url
    })

  const getCroppedImageBlob = async (imageSrc, cropPixels) => {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    canvas.width = cropPixels.width
    canvas.height = cropPixels.height

    ctx.drawImage(
      image,
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height,
      0,
      0,
      cropPixels.width,
      cropPixels.height
    )

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to crop image'))
          return
        }
        resolve(blob)
      }, 'image/jpeg')
    })
  }

  const applyCrop = async () => {
    if (!cropItem || !croppedAreaPixels) return
    setCropping(true)
    try {
      const sourceUrl = cropItem.type === 'existing' ? cropItem.url : cropItem.previewUrl
      const filename = cropItem.type === 'existing' ? cropItem.filename : cropItem.file.name

      const blob = await getCroppedImageBlob(sourceUrl, croppedAreaPixels)
      const croppedFile = new File([blob], filename, { type: 'image/jpeg' })

      if (cropItem.type === 'existing') {
        await uploadBanners([croppedFile])
        await deleteBanner(cropItem.filename)
        await loadBanners()
      } else {
        const croppedUrl = URL.createObjectURL(croppedFile)
        setSelectedBanners(prev => {
          const next = [...prev]
          const item = next[cropTarget.index]
          if (item?.croppedUrl) URL.revokeObjectURL(item.croppedUrl)
          next[cropTarget.index] = {
            ...item,
            croppedFile,
            croppedUrl,
          }
          return next
        })
      }

      setCropIndex(-1)
      setCropTarget(null)
    } catch (error) {
      setBannerMessage(error.message || 'Failed to crop image')
      setBannerMessageType('error')
    } finally {
      setCropping(false)
    }
  }

  const handleDeleteBanner = async (filename) => {
    if (!filename) return

    setBannerDeleting(filename)
    setBannerMessage('')
    setBannerMessageType('')
    try {
      await deleteBanner(filename)
      await loadBanners()
      
      // Notify clients to reload (this will show the success message)
      // await notifyReload('Banner deleted successfully')
    } catch (error) {
      setBannerMessage(error.message || 'Failed to delete banner')
      setBannerMessageType('error')
    } finally {
      setBannerDeleting(null)
    }
  }

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newBanners = [...banners]
    const [draggedBanner] = newBanners.splice(draggedIndex, 1)
    newBanners.splice(dropIndex, 0, draggedBanner)

    setBanners(newBanners)
    setDraggedIndex(null)
    setDragOverIndex(null)
    setBannerReordering(true)

    try {
      const orderData = { 
        banners: newBanners.map(b => ({ 
          filename: b.filename,
          duration: b.duration || 5
        })) 
      }
      await updateBannerOrder(orderData)
      
      // Notify clients to reload (this will show the success message)
      // await notifyReload('Banner order updated successfully')
    } catch (error) {
      setBannerMessage(error.message || 'Failed to update banner order')
      setBannerMessageType('error')
      await loadBanners()
    } finally {
      setBannerReordering(false)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <div className="skeleton-title" />
          <div className="skeleton-line" />
          <div className="skeleton-grid" />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="card">
        <div className="page-head">
          <div>
            <h1 className="page-title">Masjid Configuration</h1>
            <p className="muted">Set the masjid details and calculation settings.</p>
          </div>
          <div className={configExists ? 'pill pill-success' : 'pill pill-muted'}>
            {configExists ? 'Config Found' : 'No Config Yet'}
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="config-form">
          {/* Address Field */}
          <div className="form-group">
            <label htmlFor="address">
              Address <span className="required">*</span>
            </label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter masjid address"
              required
              className="form-input"
            />
          </div>

          {/* QR Link */}
          <div className="form-group">
            <label htmlFor="qrLink">
              QR Link <span className="required">*</span>
            </label>
            <input
              type="url"
              id="qrLink"
              name="qrLink"
              value={formData.qrLink}
              onChange={handleInputChange}
              placeholder="https://..."
              required
              className="form-input"
            />
          </div>

          {/* Always Display Iqamaah Time */}
          <div className="form-group">
            <label htmlFor="alwaysDisplayIqamaahTime">
              Always Display Iqamaah Time <span className="required">*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="alwaysDisplayIqamaahTime"
                name="alwaysDisplayIqamaahTime"
                checked={formData.alwaysDisplayIqamaahTime}
                onChange={handleInputChange}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <span className="muted">Keep Iqamaah time visible at all times</span>
            </div>
          </div>

          {/* Use Mobile TTS (Robotic Voice Over) */}
          <div className="form-group">
            <label htmlFor="useMobileTTS">
              Robotic Voice Over
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="useMobileTTS"
                name="useMobileTTS"
                checked={formData.useMobileTTS}
                onChange={handleInputChange}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <span className="muted">Use mobile's built-in TTS instead of ElevenLabs</span>
            </div>
          </div>

          {/* Display Timer Duration */}
          <div className="form-group">
            <label htmlFor="displayTimerDuration">
              Display iqamah time days before {!formData.alwaysDisplayIqamaahTime && <span className="required">*</span>}
            </label>
            <input
              type="number"
              id="displayTimerDuration"
              name="displayTimerDuration"
              value={formData.displayTimerDuration}
              onChange={handleInputChange}
              placeholder="e.g., 30"
              required={!formData.alwaysDisplayIqamaahTime}
              className="form-input"
              min="1"
              disabled={formData.alwaysDisplayIqamaahTime}
            />
            <span className="muted">
              {formData.alwaysDisplayIqamaahTime 
                ? 'Not required when \"Always Display Iqamaah Time\" is enabled' 
                : 'Duration to display timer before hiding (required)'}
            </span>
          </div>

          {/* Ticker Text */}
          <div className="form-group">
            <label>Ticker Text</label>
            <div className="ticker-list">
              {tickers.map((value, index) => (
                <div key={`ticker-${index}`} className="ticker-row">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const next = [...tickers]
                      next[index] = e.target.value
                      setTickers(next)
                    }}
                    placeholder="Enter ticker text"
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="inline-button"
                    onClick={() => {
                      if (tickers.length === 1) {
                        setTickers([''])
                        return
                      }
                      setTickers(prev => prev.filter((_, i) => i !== index))
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="inline-button"
                onClick={() => setTickers(prev => [...prev, ''])}
              >
                Add ticker
              </button>
            </div>
          </div>

          {/* Announcements */}
          <div className="form-group">
            <label>Announcements</label>
            <div className="ticker-list">
              {announcements.map((value, index) => (
                <div key={`announcement-${index}`} className="ticker-row">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const next = [...announcements]
                      next[index] = e.target.value
                      setAnnouncements(next)
                    }}
                    placeholder="Enter announcement"
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="inline-button"
                    onClick={() => {
                      if (announcements.length === 1) {
                        setAnnouncements([''])
                        return
                      }
                      setAnnouncements(prev => prev.filter((_, i) => i !== index))
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="inline-button"
                onClick={() => setAnnouncements(prev => [...prev, ''])}
              >
                Add announcement
              </button>
            </div>
          </div>

          {/* Maghrib Sunset Addition */}
          <div className="form-group">
            <label htmlFor="maghribSunsetAdditionMinutes">Maghrib Sunset Addition (minutes)</label>
            <input
              type="number"
              id="maghribSunsetAdditionMinutes"
              name="maghribSunsetAdditionMinutes"
              value={formData.maghribSunsetAdditionMinutes}
              onChange={handleInputChange}
              placeholder="e.g., 2"
              className="form-input"
              min="0"
            />
          </div>

          {/* Shuffle Images */}
          {/* <div className="form-group">
            <label htmlFor="shuffleImages">Shuffle Images</label>
            <select
              id="shuffleImages"
              name="shuffleImages"
              value={formData.shuffleImages ? 'yes' : 'no'}
              onChange={(e) => {
                const value = e.target.value === 'yes'
                setFormData(prev => ({ ...prev, shuffleImages: value }))
              }}
              className="form-select"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div> */}

          {/* Sequence Images */}
          {/* <div className="form-group">
            <label htmlFor="sequenceImages">Sequence Images</label>
            <select
              id="sequenceImages"
              name="sequenceImages"
              value={formData.sequenceImages ? 'yes' : 'no'}
              onChange={(e) => {
                const value = e.target.value === 'yes'
                setFormData(prev => ({ ...prev, sequenceImages: value }))
              }}
              className="form-select"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div> */}

          {/* Time Zone */}
          <div className="form-group">
            <label htmlFor="timeZone">
              Time Zone (IANA) <span className="required">*</span>
            </label>
            <select
              id="timeZone"
              name="timeZone"
              value={formData.timeZone}
              onChange={handleInputChange}
              required
              className="form-select"
            >
              <option value="" disabled>
                Select a time zone
              </option>
              {timeZoneOptions.map(tz => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {/* Prayer Method */}
          <div className="form-group">
            <label htmlFor="method">Prayer Method</label>
            <select
              id="method"
              name="method"
              value={formData.method}
              onChange={handleInputChange}
              className="form-select"
            >
              {methodOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Shafaq */}
          <div className="form-group">
            <label htmlFor="shafaq">Shafaq</label>
            <select
              id="shafaq"
              name="shafaq"
              value={formData.shafaq}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="general">General</option>
              <option value="ahmer">Ahmer</option>
              <option value="abyad">Abyad</option>
            </select>
          </div>

          {/* Tune */}
          <div className="form-group">
            <label htmlFor="tune">Tune (Comma-separated integers)</label>
            <input
              type="text"
              id="tune"
              name="tune"
              value={formData.tune}
              onChange={handleInputChange}
              placeholder="e.g., 0,0,0,0,0"
              className="form-input"
            />
          </div>

          {/* School */}
          <div className="form-group">
            <label htmlFor="school">School</label>
            <select
              id="school"
              name="school"
              value={formData.school}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value={0}>Shafi</option>
              <option value={1}>Hanafi</option>
            </select>
          </div>

          {/* Midnight Mode */}
          <div className="form-group">
            <label htmlFor="midnightMode">Midnight Mode</label>
            <select
              id="midnightMode"
              name="midnightMode"
              value={formData.midnightMode}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value={0}>Standard (Mid Sunset to Sunrise)</option>
              <option value={1}>Jafari (Mid Sunset to Fajr)</option>
            </select>
          </div>

          {/* Latitude Adjustment Method */}
          <div className="form-group">
            <label htmlFor="latitudeAdjustmentMethod">Latitude Adjustment Method</label>
            <select
              id="latitudeAdjustmentMethod"
              name="latitudeAdjustmentMethod"
              value={formData.latitudeAdjustmentMethod}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value={1}>Middle of the Night</option>
              <option value={2}>One Seventh</option>
              <option value={3}>Angle Based</option>
            </select>
          </div>

          {/* Calendar Method */}
          <div className="form-group">
            <label htmlFor="calendarMethod">Calendar Method</label>
            <select
              id="calendarMethod"
              name="calendarMethod"
              value={formData.calendarMethod}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="HJCoSA">HJCoSA - High Judicial Council of Saudi Arabia</option>
              <option value="UAQ">UAQ - Umm al-Qura</option>
              <option value="DIYANET">DIYANET - Diyanet İşleri Başkanlığı</option>
              <option value="MATHEMATICAL">MATHEMATICAL</option>
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="submit-button"
          >
            {saving ? 'Saving...' : configExists ? 'Update Configuration' : 'Save Configuration'}
          </button>
        </form>

        <div className="banner-section">
          <div className="banner-head">
            <div>
              <h2 className="banner-title">Banners</h2>
              <p className="muted">Upload multiple images and manage them here.</p>
            </div>
          </div>

          <div className="banner-upload">
            <input
              key={bannerInputKey}
              type="file"
              accept="image/*"
              multiple
              onChange={handleBannerSelect}
              className="banner-input"
            />
            <button
              type="button"
              className="banner-button"
              onClick={handleUploadBanners}
              disabled={bannerUploading}
            >
              {bannerUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>

          {selectedBanners.length > 0 && (
            <div className="banner-selected">
              {selectedBanners.map((item, index) => (
                <div key={item.id} className="banner-item">
                  <img
                    src={item.croppedUrl || item.previewUrl}
                    alt={item.file.name}
                    className="banner-image"
                  />
                  <div className="banner-duration">
                    <input
                      type="number"
                      min="1"
                      value={item.duration || ''}
                      onChange={(e) => updateSelectedBannerDuration(index, e.target.value)}
                      onBlur={(e) => {
                        if (!e.target.value || Number(e.target.value) < 1) {
                          updateSelectedBannerDuration(index, 1)
                        }
                      }}
                      className="duration-input"
                      placeholder="Duration (s)"
                    />
                    <span className="duration-label">seconds</span>
                  </div>
                  <div className="banner-actions">
                    <button
                      type="button"
                      className="banner-button"
                      onClick={() => startCrop(index)}
                    >
                      Crop
                    </button>
                    <button
                      type="button"
                      className="banner-button banner-delete"
                      onClick={() => handleRemoveSelected(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {bannerLoading ? (
            <div className="muted">Loading banners...</div>
          ) : banners.length === 0 ? (
            <div className="muted">No banners uploaded yet.</div>
          ) : (
            <>
              {bannerReordering && (
                <div className="muted" style={{ marginBottom: '10px', color: '#0066cc' }}>
                  Updating banner order...
                </div>
              )}
              <div className="banner-grid">
              {banners.map((b, index) => (
                <div
                  key={b.filename}
                  className={`banner-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  {/* <div className="drag-handle">⋮⋮</div> */}
                  <img src={b.url} alt={b.filename} className="banner-image" />
                  <div className="banner-duration">
                    <input
                      type="number"
                      min="1"
                      value={b.duration || ''}
                      onChange={(e) => updateBannerDuration(b.filename, e.target.value)}
                      className="duration-input"
                      placeholder="Duration (s)"
                      disabled={bannerReordering}
                    />
                    <span className="duration-label">seconds</span>
                  </div>
                  <div className="banner-actions">
                    {pendingDurations[b.filename] !== undefined && (
                      <button
                        type="button"
                        className="banner-button banner-update"
                        onClick={() => saveBannerDuration(b.filename)}
                        disabled={bannerUpdating === b.filename || bannerReordering}
                      >
                        {bannerUpdating === b.filename ? 'Updating...' : 'Update'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="banner-button"
                      onClick={() => startCropExisting(b)}
                      disabled={bannerDeleting || bannerUpdating || bannerReordering}
                    >
                      Crop
                    </button>
                    <button
                      type="button"
                      className="banner-button banner-delete"
                      onClick={() => handleDeleteBanner(b.filename)}
                      disabled={bannerDeleting || bannerUpdating || bannerReordering}
                    >
                      {bannerDeleting === b.filename ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}

          
        </div>

        {cropItem && (
          <div className="crop-modal">
            <div className="crop-card">
              <div className="crop-title">Crop image</div>
              <div className="crop-area">
                <Cropper
                  image={cropItem.type === 'existing' ? cropItem.url : cropItem.previewUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={700 / 300}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="crop-controls">
                <label>
                  <span>Zoom</span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />
                </label>
                <div className="crop-actions">
                  <button
                    type="button"
                    className="banner-button"
                    onClick={() => {
                      setCropIndex(-1)
                      setCropTarget(null)
                    }}
                    disabled={cropping}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="banner-button"
                    onClick={applyCrop}
                    disabled={cropping}
                  >
                    {cropping ? 'Cropping...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Unified Message/Notification System */}
      {(message || bannerMessage || reloadMessage || isReloading) && (
        <div className="main-container-message">
          <div className={`message ${
            isReloading ? 'info' : 
            message ? messageType : 
            bannerMessage ? bannerMessageType : 
            reloadMessageType
          }`}>
            <span className="message-text">
              {isReloading ? 'Executing operation and notifying clients...' : (message || bannerMessage || reloadMessage)}
            </span>
            {!reloadMessage && !isReloading && (
              <button
                type="button"
                className="message-close"
                onClick={() => {
                  if (message) {
                    setMessage('')
                    setMessageType('')
                  }
                  if (bannerMessage) {
                    setBannerMessage('')
                    setBannerMessageType('')
                  }
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px'
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
