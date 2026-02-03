import axios from 'axios'

// API configuration
// Set `VITE_API_BASE_URL` in `.env` if needed.
const API_BASE_URL = 'http://192.168.18.7:5000/api'

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const unwrap = (payload) => {
  // Supports common API shapes: plain object, { data: object }, { result: object }
  if (payload && typeof payload === 'object') {
    if (payload.data && typeof payload.data === 'object') return payload.data
    if (payload.result && typeof payload.result === 'object') return payload.result
  }
  return payload
}

// Error handler to extract server error messages
const getErrorMessage = (error) => {
  if (error.response) {
    // Server responded with error status
    const serverMessage = error.response.data?.message || error.response.data?.error
    return serverMessage || `Server Error: ${error.response.status}`
  } else if (error.request) {
    // Request made but no response
    return 'No response from server. Check if the server is running.'
  } else {
    // Error in request setup
    return error.message || 'An unexpected error occurred'
  }
}

// Fetch masjid configuration
export async function fetchMasjidConfig() {
  try {
    const response = await apiClient.get('/masjid-config')
    return unwrap(response.data)
  } catch (error) {
    if (error.response?.status === 404) {
      // Config doesn't exist yet, return null
      return null
    }
    throw new Error(getErrorMessage(error))
  }
}

// Create masjid configuration
export async function createMasjidConfig(configData) {
  try {
    const response = await apiClient.post('/masjid-config', configData)
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// Update masjid configuration
export async function updateMasjidConfig(configData) {
  try {
    const response = await apiClient.post('/masjid-config', configData)
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// Preferred: create/update with the same payload
export async function saveMasjidConfig(configData, { exists } = {}) {
  // Backend replaces existing config; POST is used for both create/update.
  return createMasjidConfig(configData)
}

// ------------------------------
// Iqamaah times
// ------------------------------

export async function fetchIqamaahTimesMonth(year, month) {
  try {
    const response = await apiClient.get('/iqamaah-times/month', {
      params: { year, month },
    })
    return unwrap(response.data)
  } catch (error) {
    if (error.response?.status === 404) return null
    throw new Error(getErrorMessage(error))
  }
}

export async function createIqamaahRange(payload) {
  try {
    const response = await apiClient.post('/iqamaah-times/range', payload)
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function updateIqamaahRange(payload) {
  try {
    const response = await apiClient.patch('/iqamaah-times/range', payload)
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function deleteIqamaahRange(payload) {
  try {
    const response = await apiClient.delete('/iqamaah-times/range', { data: payload })
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function createIqamaahTimes(payload) {
  try {
    const response = await apiClient.post('/iqamaah-times', payload)
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function updateIqamaahTimes(payload) {
  try {
    const response = await apiClient.post('/iqamaah-times', payload)
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// Backend replaces existing data; always send full payload
export async function saveIqamaahTimes(payload, { exists } = {}) {
  // Backend replaces existing month data; POST is used for both create/update.
  return createIqamaahTimes(payload)
}

// ------------------------------
// Banners
// ------------------------------

export async function fetchBanners() {
  try {
    const response = await apiClient.get('/banners')
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function uploadBanners(files, durations) {
  try {
    const formData = new FormData()
    ;(files || []).forEach(file => {
      formData.append('banners', file)
    })
    
    if (durations && durations.length > 0) {
      formData.append('durations', JSON.stringify(durations))
    }

    const response = await apiClient.post('/banners', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function deleteBanner(filename) {
  try {
    const response = await apiClient.delete(`/banners/${filename}`)
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function updateBannerOrder(orderData) {
  try {
    const response = await apiClient.put('/banners/order', orderData)
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ------------------------------
// Pages Management
// ------------------------------

export async function fetchPages() {
  try {
    const response = await apiClient.get('/pages')
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function fetchActivePage() {
  try {
    const response = await apiClient.get('/pages/active')
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function fetchPageById(pageId) {
  try {
    const response = await apiClient.get(`/pages/${pageId}`)
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function createPage(formData) {
  try {
    const response = await apiClient.post('/pages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function updatePage(pageId, formData) {
  try {
    const response = await apiClient.put(`/pages/${pageId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function deletePage(pageId) {
  try {
    const response = await apiClient.delete(`/pages/${pageId}`)
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function updatePageOrder(pageIds) {
  try {
    const response = await apiClient.put('/pages/order/update', { pageIds })
    return unwrap(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

