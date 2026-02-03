import { useEffect, useState } from 'react'
import {
  createPage,
  deletePage,
  fetchActivePage,
  fetchPages,
  updatePage,
  updatePageOrder,
} from '../services/api'
import './PageManagement.css'

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function PageManagement() {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPage, setEditingPage] = useState(null)
  const [viewingPage, setViewingPage] = useState(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  
  const [formData, setFormData] = useState({
    title: '',
    pageType: 'text',
    content: '',
    isActive: true,
    image: null,
    slides: [],
    slidesMetadata: [],
    schedules: [],
    pageDuration: 5,
  })

  const [existingSlides, setExistingSlides] = useState([])
  const [removedSlides, setRemovedSlides] = useState([])
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  useEffect(() => {
    loadPages()
  }, [])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('')
        setMessageType('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const loadPages = async () => {
    setLoading(true)
    try {
      const data = await fetchPages()
      setPages(Array.isArray(data) ? data : [])
    } catch (error) {
      showMessage(error.message || 'Failed to load pages', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (msg, type) => {
    setMessage(msg)
    setMessageType(type)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      pageType: 'text',
      content: '',
      isActive: true,
      image: null,
      slides: [],
      slidesMetadata: [],
      schedules: [],
      pageDuration: 5,
    })
    setExistingSlides([])
    setRemovedSlides([])
    setEditingPage(null)
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (page) => {
    setEditingPage(page)
    setFormData({
      title: page.title || '',
      pageType: page.pageType || 'text',
      content: page.content || '',
      isActive: page.isActive !== undefined ? page.isActive : true,
      image: null,
      slides: [],
      slidesMetadata: page.slides?.map(s => ({ duration: s.duration || 5, isActive: s.isActive !== undefined ? s.isActive : true })) || [],
      schedules: page.schedules || [],
      pageDuration: page.pageDuration || page.totalDuration || 5,
    })
    setExistingSlides(page.slides ? JSON.parse(JSON.stringify(page.slides)) : [])
    setRemovedSlides([])
    setShowModal(true)
  }

  const openViewModal = (page) => {
    setViewingPage(page)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      showMessage('Title is required', 'error')
      return
    }
    
    // Validation for slider pages
    if (needsSlider) {
      const totalSlides = existingSlides.filter(s => s.isActive !== false).length + 
                          formData.slides.filter((_, idx) => formData.slidesMetadata[idx]?.isActive !== false).length
      
      if (totalSlides === 0) {
        showMessage('Slider pages must have at least one active slide', 'error')
        return
      }
      
      if (calculatedDuration === 0) {
        showMessage('Total slider duration must be greater than 0', 'error')
        return
      }
    }

    const fd = new FormData()
    fd.append('title', formData.title)
    fd.append('pageType', formData.pageType)
    fd.append('isActive', formData.isActive)
    fd.append('pageDuration', needsSlider ? calculatedDuration : formData.pageDuration)
    
    if (formData.content) {
      fd.append('content', formData.content)
    }
    
    if (formData.schedules.length > 0) {
      fd.append('schedules', JSON.stringify(formData.schedules))
    }

    // Handle image for single image pages
    if ((formData.pageType === 'image' || formData.pageType === 'image-text') && formData.image) {
      fd.append('image', formData.image)
    }

    // Handle slider pages
    if (formData.pageType === 'slider' || formData.pageType === 'text-slider') {
      // If there are new files to upload
      if (formData.slides.length > 0) {
        formData.slides.forEach(slide => {
          fd.append('slides', slide)
        })
        fd.append('slidesMetadata', JSON.stringify(formData.slidesMetadata))
      }
      
      // If editing and there are existing slides (for duration/isActive updates)
      if (editingPage && existingSlides.length > 0) {
        // Send existing slides as JSON array for metadata updates
        const existingSlidesData = existingSlides.map(s => ({
          image: s.image,
          duration: s.duration,
          isActive: s.isActive
        }))
        fd.append('existingSlides', JSON.stringify(existingSlidesData))
      }
      
      // Handle removed slides
      if (editingPage && removedSlides.length > 0) {
        fd.append('removeSlides', JSON.stringify(removedSlides))
      }
    }

    try {
      if (editingPage) {
        await updatePage(editingPage._id, fd)
        showMessage('Page updated successfully', 'success')
      } else {
        await createPage(fd)
        showMessage('Page created successfully', 'success')
      }
      setShowModal(false)
      resetForm()
      await loadPages()
    } catch (error) {
      showMessage(error.message || 'Operation failed', 'error')
    }
  }

  const handleDelete = async (pageId) => {
    if (!confirm('Are you sure you want to delete this page?')) return
    
    try {
      await deletePage(pageId)
      showMessage('Page deleted successfully', 'success')
      await loadPages()
    } catch (error) {
      showMessage(error.message || 'Failed to delete page', 'error')
    }
  }

  const addSchedule = (type) => {
    const newSchedule = type === 'recurring'
      ? { type: 'recurring', dayOfWeek: 5, startTime: '09:00', endTime: '17:00' }
      : { type: 'daterange', startDate: '', endDate: '' }
    
    setFormData(prev => ({
      ...prev,
      schedules: [...prev.schedules, newSchedule]
    }))
  }

  const updateSchedule = (index, field, value) => {
    setFormData(prev => {
      const schedules = [...prev.schedules]
      schedules[index] = { ...schedules[index], [field]: value }
      return { ...prev, schedules }
    })
  }

  const removeSchedule = (index) => {
    setFormData(prev => ({
      ...prev,
      schedules: prev.schedules.filter((_, i) => i !== index)
    }))
  }

  const handleSlideFiles = (files) => {
    const fileArray = Array.from(files)
    const metadata = fileArray.map(() => ({ duration: 5, isActive: true }))
    setFormData(prev => ({
      ...prev,
      slides: [...prev.slides, ...fileArray],
      slidesMetadata: [...prev.slidesMetadata, ...metadata]
    }))
  }

  const updateSlideMetadata = (index, field, value) => {
    setFormData(prev => {
      const metadata = [...prev.slidesMetadata]
      metadata[index] = { ...metadata[index], [field]: value }
      return { ...prev, slidesMetadata: metadata }
    })
  }

  const removeSlide = (index) => {
    setFormData(prev => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index),
      slidesMetadata: prev.slidesMetadata.filter((_, i) => i !== index)
    }))
  }

  const updateExistingSlide = (index, field, value) => {
    setExistingSlides(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeExistingSlide = (index) => {
    const slide = existingSlides[index]
    if (slide.image) {
      setRemovedSlides(prev => [...prev, slide.image])
    }
    setExistingSlides(prev => prev.filter((_, i) => i !== index))
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

    const newPages = [...pages]
    const [draggedPage] = newPages.splice(draggedIndex, 1)
    newPages.splice(dropIndex, 0, draggedPage)

    setPages(newPages)
    setDraggedIndex(null)
    setDragOverIndex(null)

    try {
      const pageIds = newPages.map(p => p._id)
      await updatePageOrder(pageIds)
      showMessage('Page order updated', 'success')
    } catch (error) {
      showMessage(error.message || 'Failed to update order', 'error')
      await loadPages()
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const needsImage = formData.pageType === 'image' || formData.pageType === 'image-text'
  const needsSlider = formData.pageType === 'slider' || formData.pageType === 'text-slider'
  const needsContent = formData.pageType === 'text' || formData.pageType === 'image-text' || formData.pageType === 'text-slider'
  
  // Calculate total duration for slider pages
  const calculateSliderDuration = () => {
    if (!needsSlider) return formData.pageDuration
    
    // Sum of existing active slides
    const existingTotal = existingSlides
      .filter(s => s.isActive !== false)
      .reduce((sum, s) => sum + (Number(s.duration) || 5), 0)
    
    // Sum of new active slides
    const newTotal = formData.slides
      .filter((_, idx) => formData.slidesMetadata[idx]?.isActive !== false)
      .reduce((sum, _, idx) => sum + (Number(formData.slidesMetadata[idx]?.duration) || 5), 0)
    
    return existingTotal + newTotal
  }
  
  const calculatedDuration = needsSlider ? calculateSliderDuration() : formData.pageDuration

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <div className="skeleton-title" />
          <div className="skeleton-line" />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="card">
        <div className="page-head">
          <div>
            <h1 className="page-title">Page Management</h1>
            <p className="muted">Create and manage dynamic pages with scheduling</p>
          </div>
          <button className="create-button" onClick={openCreateModal}>
            Create Page
          </button>
        </div>

        {pages.length === 0 ? (
          <div className="empty-state">No pages created yet</div>
        ) : (
          <div className="pages-list">
            {pages.map((page, index) => (
              <div
                key={page._id}
                className={`page-card ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                {/* <div className="drag-handle">⋮⋮</div> */}
                <div className="page-card-content">
                  <div className="page-card-header">
                    <h3 className="page-card-title">{page.title}</h3>
                    <div className="page-badges">
                      <span className="badge badge-type">{page.pageType}</span>
                      <span className={`badge ${page.isActive ? 'badge-active' : 'badge-inactive'}`}>
                        {page.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  
                  {page.content && (
                    <p className="page-card-content-text">{page.content.slice(0, 100)}{page.content.length > 100 ? '...' : ''}</p>
                  )}
                  
                  <div className="page-card-meta">
                    {page.pageDuration && (
                      <span className="meta-item">Duration: {page.pageDuration}s</span>
                    )}
                    {page.schedules?.length > 0 && (
                      <span className="meta-item">{page.schedules.length} schedule(s)</span>
                    )}
                  </div>

                  <div className="page-card-actions">
                    <button className="action-button" onClick={() => openViewModal(page)}>
                      View
                    </button>
                    <button className="action-button" onClick={() => openEditModal(page)}>
                      Edit
                    </button>
                    <button className="action-button delete-button" onClick={() => handleDelete(page._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {message && (
          <div className={`message ${messageType}`}>
            <span className="message-icon">{messageType === 'success' ? '✓' : '✕'}</span>
            <span className="message-text">{message}</span>
            <button type="button" className="message-close" onClick={() => setMessage('')}>×</button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingPage ? 'Edit Page' : 'Create Page'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="page-form">
              <div className="form-group">
                <label>Title <span className="required">*</span></label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label>Page Type</label>
                <select
                  value={formData.pageType}
                  onChange={(e) => setFormData(prev => ({ ...prev, pageType: e.target.value }))}
                  className="form-select"
                  disabled={!!editingPage}
                >
                  <option value="text">Text Only</option>
                  <option value="image">Single Image</option>
                  <option value="image-text">Image + Text</option>
                  <option value="slider">Image Slider</option>
                  {/* <option value="text-slider">Text + Slider</option> */}
                </select>
              </div>

              {needsContent && (
                <div className="form-group">
                  <label>Content</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    className="form-textarea"
                    rows="4"
                  />
                </div>
              )}

              {needsImage && (
                <div className="form-group">
                  <label>Image {!editingPage && <span className="required">*</span>}</label>
                  {editingPage?.imageUrl && (
                    <div className="current-image">
                      <img src={editingPage.imageUrl} alt="Current" />
                      <span className="current-label">Current Image</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.files[0] }))}
                    className="form-input"
                    required={!editingPage}
                  />
                  {editingPage && <small className="form-hint">Upload a new image to replace the current one</small>}
                </div>
              )}

              {needsSlider && (
                <div className="form-group">
                  <label>Slider Images</label>
                  {existingSlides.length > 0 && (
                    <div className="current-slides">
                      <span className="current-label">Current Slides</span>
                      <div className="current-slides-grid">
                        {existingSlides.map((slide, idx) => (
                          <div key={idx} className="current-slide-item">
                            <img src={slide.imageUrl} alt={`Slide ${idx + 1}`} />
                            <div className="current-slide-controls">
                              <input
                                type="number"
                                min="1"
                                value={slide.duration || 5}
                                onChange={(e) => updateExistingSlide(idx, 'duration', Number(e.target.value))}
                                className="mini-duration-input"
                                title="Duration (seconds)"
                              />
                              <button
                                type="button"
                                className={`mini-toggle-button ${slide.isActive ? 'active' : 'inactive'}`}
                                onClick={() => updateExistingSlide(idx, 'isActive', !slide.isActive)}
                                title={slide.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                              >
                                {slide.isActive ? '✓' : '×'}
                              </button>
                              <button
                                type="button"
                                className="mini-remove-button"
                                onClick={() => removeExistingSlide(idx)}
                                title="Remove slide"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleSlideFiles(e.target.files)}
                    className="form-input"
                  />
                  {editingPage && <small className="form-hint">Upload new images to add to the slider</small>}
                  
                  {formData.slides.length > 0 && (
                    <div className="slides-list">
                      <span className="slides-label">New Slides to Add</span>
                      {formData.slides.map((slide, index) => (
                        <div key={index} className="slide-item">
                          <span className="slide-name">{slide.name}</span>
                          <input
                            type="number"
                            min="1"
                            value={formData.slidesMetadata[index]?.duration || 5}
                            onChange={(e) => updateSlideMetadata(index, 'duration', Number(e.target.value))}
                            className="slide-duration"
                            placeholder="Duration (s)"
                          />
                          <label className="slide-checkbox">
                            <input
                              type="checkbox"
                              checked={formData.slidesMetadata[index]?.isActive !== false}
                              onChange={(e) => updateSlideMetadata(index, 'isActive', e.target.checked)}
                            />
                            Active
                          </label>
                          <button type="button" className="slide-remove" onClick={() => removeSlide(index)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Page Duration (seconds)</label>
                <input
                  type="number"
                  min="1"
                  value={needsSlider ? calculatedDuration : formData.pageDuration}
                  onChange={(e) => setFormData(prev => ({ ...prev, pageDuration: Number(e.target.value) }))}
                  className="form-input"
                  placeholder="Duration in seconds"
                  disabled={needsSlider}
                />
                <small className="form-hint">
                  {needsSlider 
                    ? `Auto-calculated from slider durations (${calculatedDuration}s total)` 
                    : 'How long this page should be displayed'}
                </small>
              </div>

              <div className="form-group">
                <label>Active</label>
                <select
                  value={formData.isActive ? 'yes' : 'no'}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'yes' }))}
                  className="form-select"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div className="form-group">
                <label>Schedules</label>
                <div className="schedule-buttons">
                  <button type="button" className="schedule-add-button" onClick={() => addSchedule('recurring')}>
                    Add Recurring
                  </button>
                  <button type="button" className="schedule-add-button" onClick={() => addSchedule('daterange')}>
                    Add Date Range
                  </button>
                </div>

                {formData.schedules.map((schedule, index) => (
                  <div key={index} className="schedule-item">
                    <div className="schedule-header">
                      <span className="schedule-type">{schedule.type}</span>
                      <button type="button" className="schedule-remove" onClick={() => removeSchedule(index)}>×</button>
                    </div>

                    {schedule.type === 'recurring' ? (
                      <div className="schedule-fields">
                        <select
                          value={schedule.dayOfWeek}
                          onChange={(e) => updateSchedule(index, 'dayOfWeek', Number(e.target.value))}
                          className="form-select"
                        >
                          {DAYS_OF_WEEK.map(day => (
                            <option key={day.value} value={day.value}>{day.label}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={schedule.startTime || ''}
                          onChange={(e) => updateSchedule(index, 'startTime', e.target.value)}
                          className="form-input"
                        />
                        <input
                          type="time"
                          value={schedule.endTime || ''}
                          onChange={(e) => updateSchedule(index, 'endTime', e.target.value)}
                          className="form-input"
                        />
                      </div>
                    ) : (
                      <div className="schedule-fields">
                        <input
                          type="datetime-local"
                          value={schedule.startDate ? new Date(schedule.startDate).toISOString().slice(0, 16) : ''}
                          onChange={(e) => updateSchedule(index, 'startDate', new Date(e.target.value).toISOString())}
                          className="form-input"
                        />
                        <input
                          type="datetime-local"
                          value={schedule.endDate ? new Date(schedule.endDate).toISOString().slice(0, 16) : ''}
                          onChange={(e) => updateSchedule(index, 'endDate', new Date(e.target.value).toISOString())}
                          className="form-input"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  {editingPage ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingPage && (
        <div className="modal-overlay" onClick={() => setViewingPage(null)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Preview: {viewingPage.title}</h2>
              <button className="modal-close" onClick={() => setViewingPage(null)}>×</button>
            </div>

            <div className="preview-content">
              {viewingPage.pageType === 'text' && (
                <div className="preview-text">
                  <p>{viewingPage.content}</p>
                </div>
              )}

              {viewingPage.pageType === 'image' && viewingPage.imageUrl && (
                <div className="preview-image">
                  <img src={viewingPage.imageUrl} alt={viewingPage.title} />
                </div>
              )}

              {viewingPage.pageType === 'image-text' && (
                <div className="preview-image-text">
                  {viewingPage.imageUrl && (
                    <div className="preview-image">
                      <img src={viewingPage.imageUrl} alt={viewingPage.title} />
                    </div>
                  )}
                  {viewingPage.content && (
                    <div className="preview-text">
                      <p>{viewingPage.content}</p>
                    </div>
                  )}
                </div>
              )}

              {(viewingPage.pageType === 'slider' || viewingPage.pageType === 'text-slider') && (
                <div className="preview-slider">
                  {viewingPage.pageType === 'text-slider' && viewingPage.content && (
                    <div className="preview-text">
                      <p>{viewingPage.content}</p>
                    </div>
                  )}
                  {viewingPage.slides && viewingPage.slides.length > 0 && (
                    <div className="preview-slides">
                      {viewingPage.slides.filter(s => s.isActive !== false).map((slide, idx) => (
                        <div key={idx} className="preview-slide">
                          <img src={slide.imageUrl} alt={`Slide ${idx + 1}`} />
                          <span className="slide-duration-badge">{slide.duration}s</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {viewingPage.schedules && viewingPage.schedules.length > 0 && (
                <div className="preview-schedules">
                  <h3>Schedules</h3>
                  {viewingPage.schedules.map((schedule, idx) => (
                    <div key={idx} className="preview-schedule-item">
                      {schedule.type === 'recurring' ? (
                        <span>
                          {DAYS_OF_WEEK.find(d => d.value === schedule.dayOfWeek)?.label} {schedule.startTime} - {schedule.endTime}
                        </span>
                      ) : (
                        <span>
                          {new Date(schedule.startDate).toLocaleString()} - {new Date(schedule.endDate).toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
