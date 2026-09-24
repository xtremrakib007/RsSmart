import { useState, useEffect } from 'react'
import api from '../services/api.js'
import './WhatsAppPage.css'

const TEMPLATE_CATEGORIES = ['general', 'order', 'promotion', 'reminder', 'welcome'];

function WhatsAppPage() {
  const [activeTab, setActiveTab] = useState('conversations')
  const [conversations, setConversations] = useState([])
  const [templates, setTemplates] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [formData, setFormData] = useState({
    name: '', category: 'general', language: 'en', header: '', body: '', footer: '', variables: ''
  })

  useEffect(() => {
    if (activeTab === 'conversations') fetchConversations()
    if (activeTab === 'templates') fetchTemplates()
    if (activeTab === 'logs') fetchLogs()
  }, [activeTab])

  const fetchConversations = async () => {
    setLoading(true)
    try {
      const res = await api.get('/whatsapp/conversations')
      setConversations(res.data.conversations)
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await api.get('/whatsapp/templates')
      setTemplates(res.data.templates)
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await api.get('/whatsapp/webhook-logs')
      setLogs(res.data.logs)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const openConversation = async (conv) => {
    setSelectedConv(conv)
    try {
      const res = await api.get(`/whatsapp/conversations/${conv.id}/messages`)
      setMessages(res.data.messages)
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return
    try {
      await api.post(`/whatsapp/conversations/${selectedConv.id}/messages`, {
        content: newMessage
      })
      setNewMessage('')
      openConversation(selectedConv)
    } catch (err) {
      alert(err.message || 'Failed to send message')
    }
  }

  const handleTemplateSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        variables: formData.variables.split(',').map(v => v.trim()).filter(Boolean)
      }
      if (editingTemplate) {
        await api.put(`/whatsapp/templates/${editingTemplate.id}`, payload)
      } else {
        await api.post('/whatsapp/templates', payload)
      }
      setShowTemplateForm(false)
      setEditingTemplate(null)
      resetForm()
      fetchTemplates()
    } catch (err) {
      alert(err.message || 'Failed to save template')
    }
  }

  const handleEditTemplate = (t) => {
    setEditingTemplate(t)
    setFormData({
      name: t.name, category: t.category, language: t.language || 'en',
      header: t.header || '', body: t.body, footer: t.footer || '',
      variables: (t.variables || []).join(', ')
    })
    setShowTemplateForm(true)
  }

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return
    try {
      await api.delete(`/whatsapp/templates/${id}`)
      fetchTemplates()
    } catch (err) {
      alert(err.message || 'Failed to delete')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', category: 'general', language: 'en', header: '', body: '', footer: '', variables: '' })
  }

  return (
    <div className="whatsapp-page">
      <div className="tabs">
        {['conversations', 'templates', 'logs'].map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab); setSelectedConv(null); }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'conversations' && (
        <div className="conversations-layout">
          <div className="conv-list">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="empty-state">No conversations yet</div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`conv-item ${selectedConv?.id === conv.id ? 'active' : ''}`}
                  onClick={() => openConversation(conv)}
                >
                  <div className="conv-avatar">{conv.customer_name?.charAt(0)?.toUpperCase() || '?'}</div>
                  <div className="conv-info">
                    <div className="conv-name">{conv.customer_name || conv.phone}</div>
                    <div className="conv-preview">{conv.last_message?.substring(0, 40)}...</div>
                  </div>
                  {conv.unread_count > 0 && <span className="unread-badge">{conv.unread_count}</span>}
                </div>
              ))
            )}
          </div>

          <div className="chat-panel">
            {selectedConv ? (
              <>
                <div className="chat-header">
                  <span>{selectedConv.customer_name || selectedConv.phone}</span>
                </div>
                <div className="chat-messages">
                  {messages.length === 0 ? (
                    <div className="empty-chat">No messages yet</div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className={`chat-bubble ${msg.direction}`}>
                        <div className="bubble-content">{msg.content}</div>
                        <div className="bubble-time">{new Date(msg.created_at).toLocaleTimeString()}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="chat-input">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <button className="btn-primary" onClick={sendMessage}>Send</button>
                </div>
              </>
            ) : (
              <div className="empty-chat">Select a conversation</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="templates-section">
          <div className="page-toolbar">
            <h3>Message Templates</h3>
            <button className="btn-primary" onClick={() => { setEditingTemplate(null); resetForm(); setShowTemplateForm(true); }}>
              + New Template
            </button>
          </div>

          {showTemplateForm && (
            <div className="modal-overlay" onClick={() => setShowTemplateForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
                <form onSubmit={handleTemplateSubmit} className="template-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Name *</label>
                      <input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                        {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Header</label>
                    <input value={formData.header} onChange={(e) => setFormData({...formData, header: e.target.value})} placeholder="Optional header text" />
                  </div>
                  <div className="form-group">
                    <label>Body *</label>
                    <textarea value={formData.body} onChange={(e) => setFormData({...formData, body: e.target.value})} rows="4" required placeholder="Message body. Use {{variable}} for dynamic content." />
                  </div>
                  <div className="form-group">
                    <label>Footer</label>
                    <input value={formData.footer} onChange={(e) => setFormData({...formData, footer: e.target.value})} placeholder="Optional footer text" />
                  </div>
                  <div className="form-group">
                    <label>Variables (comma separated)</label>
                    <input value={formData.variables} onChange={(e) => setFormData({...formData, variables: e.target.value})} placeholder="customerName, orderNumber, total" />
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowTemplateForm(false)}>Cancel</button>
                    <button type="submit" className="btn-primary">{editingTemplate ? 'Update' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div className="templates-grid">
              {templates.map(t => (
                <div key={t.id} className="template-card">
                  <div className="template-header">
                    <span className="template-name">{t.name}</span>
                    <span className="template-category">{t.category}</span>
                  </div>
                  {t.header && <div className="template-section header">{t.header}</div>}
                  <div className="template-section body">{t.body}</div>
                  {t.footer && <div className="template-section footer">{t.footer}</div>}
                  <div className="template-meta">
                    <span>Vars: {(t.variables || []).join(', ') || 'none'}</span>
                    <div className="row-actions">
                      <button className="btn-icon" onClick={() => handleEditTemplate(t)}>✏️</button>
                      <button className="btn-icon" onClick={() => handleDeleteTemplate(t.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="logs-section">
          <h3>Webhook Logs</h3>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">No webhook logs yet</div>
          ) : (
            <div className="logs-list">
              {logs.map(log => (
                <div key={log.id} className={`log-item ${log.processed ? 'processed' : 'failed'}`}>
                  <div className="log-header">
                    <span className="log-event">{log.event_type}</span>
                    <span className="log-provider">{log.provider}</span>
                    <span className="log-time">{new Date(log.created_at).toLocaleString()}</span>
                    <span className={`log-status ${log.processed ? 'success' : 'error'}`}>
                      {log.processed ? '✅ Processed' : '❌ Failed'}
                    </span>
                  </div>
                  <pre className="log-payload">{JSON.stringify(log.payload, null, 2)}</pre>
                  {log.error_message && <div className="log-error">{log.error_message}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WhatsAppPage
