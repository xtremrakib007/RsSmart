import { useState, useEffect } from 'react'
import api from '../services/api.js'
import './SettingsPage.css'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('business')
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [businessHours, setBusinessHours] = useState({})

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings')
      const data = res.data.settings
      setSettings(data)

      // Parse business hours
      if (data.business_hours?.value) {
        setBusinessHours(data.business_hours.value)
      } else {
        setBusinessHours({
          mon: '9:00-18:00', tue: '9:00-18:00', wed: '9:00-18:00',
          thu: '9:00-18:00', fri: '9:00-18:00', sat: '9:00-13:00', sun: 'closed'
        })
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const payload = {}

      // Collect values from current tab
      const inputs = document.querySelectorAll(`[data-settings-tab="${activeTab}"] [data-setting-key]`)
      inputs.forEach(input => {
        const key = input.dataset.settingKey
        const type = input.dataset.settingType
        let value = input.value

        if (type === 'boolean') {
          value = input.checked
        } else if (type === 'number') {
          value = parseFloat(value) || 0
        }

        payload[key] = value
      })

      // Include business hours if on business tab
      if (activeTab === 'business') {
        payload.business_hours = businessHours
      }

      await api.put('/settings', { settings: payload })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const getValue = (key, defaultValue = '') => {
    return settings[key]?.value !== undefined ? settings[key].value : defaultValue
  }

  const updateBusinessHour = (day, value) => {
    setBusinessHours(prev => ({ ...prev, [day]: value }))
  }

  const renderInput = (key, label, type = 'string', options = {}) => {
    const value = getValue(key, options.default || '')
    const desc = settings[key]?.description || ''

    return (
      <div className="setting-row" key={key} data-setting-key-container>
        <div className="setting-label-group">
          <label>{label}</label>
          {desc && <span className="setting-desc">{desc}</span>}
        </div>
        <div className="setting-input">
          {type === 'boolean' ? (
            <label className="toggle">
              <input
                type="checkbox"
                data-setting-key={key}
                data-setting-type="boolean"
                defaultChecked={value}
              />
              <span className="toggle-slider"></span>
            </label>
          ) : type === 'number' ? (
            <input
              type="number"
              data-setting-key={key}
              data-setting-type="number"
              defaultValue={value}
              min={options.min}
              max={options.max}
              step={options.step || 0.01}
            />
          ) : type === 'textarea' ? (
            <textarea
              data-setting-key={key}
              data-setting-type="string"
              defaultValue={value}
              rows={options.rows || 2}
              placeholder={options.placeholder}
            />
          ) : (
            <input
              type="text"
              data-setting-key={key}
              data-setting-type="string"
              defaultValue={value}
              placeholder={options.placeholder}
            />
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="loading">Loading settings...</div>
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
        <div className="save-group">
          {saved && <span className="saved-indicator">✅ Saved!</span>}
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-sidebar">
          {[
            { id: 'business', label: 'Business Info', icon: '🏪' },
            { id: 'tax', label: 'Tax & Currency', icon: '💱' },
            { id: 'hours', label: 'Business Hours', icon: '🕐' },
            { id: 'receipt', label: 'Receipt & Branding', icon: '🧾' },
            { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="settings-content">
          {activeTab === 'business' && (
            <div data-settings-tab="business">
              <h3>Business Information</h3>
              <p className="tab-desc">Configure your store details. These appear on receipts and customer communications.</p>
              <div className="settings-group">
                {renderInput('store_name', 'Store Name', 'string', { placeholder: 'Your Store Name' })}
                {renderInput('store_address', 'Address', 'textarea', { placeholder: 'Full business address', rows: 3 })}
                {renderInput('store_phone', 'Phone', 'string', { placeholder: '+60 12-345-6789' })}
                {renderInput('store_email', 'Email', 'string', { placeholder: 'hello@yourstore.com' })}
              </div>
            </div>
          )}

          {activeTab === 'tax' && (
            <div data-settings-tab="tax">
              <h3>Tax & Currency</h3>
              <p className="tab-desc">Configure how taxes and currency are handled across your store.</p>
              <div className="settings-group">
                {renderInput('currency', 'Currency Code', 'string', { placeholder: 'MYR', default: 'MYR' })}
                {renderInput('currency_symbol', 'Currency Symbol', 'string', { placeholder: 'RM', default: 'RM' })}
                {renderInput('tax_enabled', 'Enable Tax', 'boolean')}
                {renderInput('tax_rate', 'Tax Rate (%)', 'number', { min: 0, max: 100, step: 0.5, default: 0 })}
                {renderInput('tax_inclusive', 'Prices Include Tax', 'boolean')}
              </div>
            </div>
          )}

          {activeTab === 'hours' && (
            <div data-settings-tab="business">
              <h3>Business Hours</h3>
              <p className="tab-desc">Set your operating hours. Customers will see this information.</p>
              <div className="settings-group">
                {DAYS.map(day => (
                  <div className="setting-row hours-row" key={day}>
                    <div className="setting-label-group">
                      <label>{DAY_LABELS[day]}</label>
                    </div>
                    <div className="setting-input hours-input">
                      <input
                        type="text"
                        value={businessHours[day] || 'closed'}
                        onChange={(e) => updateBusinessHour(day, e.target.value)}
                        placeholder="9:00-18:00 or closed"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'receipt' && (
            <div data-settings-tab="receipt">
              <h3>Receipt & Branding</h3>
              <p className="tab-desc">Customize how receipts and invoices appear to customers.</p>
              <div className="settings-group">
                {renderInput('receipt_footer', 'Receipt Footer', 'textarea', { 
                  placeholder: 'Thank you message, return policy, etc.',
                  default: 'Thank you for your business!',
                  rows: 3
                })}
                {renderInput('order_prefix', 'Order Number Prefix', 'string', { placeholder: 'ORD', default: 'ORD' })}
              </div>
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div data-settings-tab="whatsapp">
              <h3>WhatsApp Configuration</h3>
              <p className="tab-desc">Configure automated WhatsApp messages and responses.</p>
              <div className="settings-group">
                {renderInput('whatsapp_greeting', 'Auto-Reply Greeting', 'textarea', {
                  placeholder: 'Welcome message sent to new conversations',
                  default: 'Hello! Welcome to our store. How can we help you today?',
                  rows: 3
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
