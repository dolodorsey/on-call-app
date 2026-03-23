'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * KHGFormModal — Universal form component for all 16 KHG form types.
 * 
 * Every form renders as a modal overlay with brand-specific accent color.
 * Submits to /api/forms which routes to the correct GHL sub-account.
 * 
 * Props:
 *   formType: string (key from FORM_TYPES)
 *   formConfig: object (the form definition from forms-config.js)
 *   brandAccent: string (hex color)
 *   brandName: string
 *   onClose: function
 *   isOpen: boolean
 */
export default function KHGFormModal({
  formType,
  formConfig,
  brandAccent = '#FF6B35',
  brandName = '',
  onClose,
  isOpen,
}) {
  const [formData, setFormData] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setFormData({});
      setStatus('idle');
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape' && status !== 'submitting') onClose?.(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, status, onClose]);

  if (!isOpen || !formConfig) return null;

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    const allFields = formConfig.fields || [];
    for (const field of allFields) {
      if (field.required && !formData[field.name]?.trim()) {
        setErrorMsg(`${field.label} is required`);
        return;
      }
    }
    if (!formData._name?.trim() || !formData._email?.trim()) {
      setErrorMsg('Name and Email are required');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');

    try {
      const { _name, _email, _phone, ...extraFields } = formData;
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType,
          name: _name,
          email: _email,
          phone: _phone || '',
          source: `${brandName} Website`,
          fields: extraFields,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
    fontWeight: 500,
    letterSpacing: '0.03em',
  };

  return (
    <div
      ref={modalRef}
      onClick={(e) => { if (e.target === modalRef.current && status !== 'submitting') onClose?.(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(24px)',
        animation: 'khgFadeIn 0.25s ease',
        padding: 20,
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 580,
        maxHeight: '92vh',
        background: '#0c0c0c',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        animation: 'khgSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* HEADER */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{
              fontSize: 24,
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${brandAccent}12`,
              borderRadius: 12,
              border: `1px solid ${brandAccent}25`,
            }}>
              {formConfig.icon}
            </span>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 500,
                color: '#fff',
                fontFamily: 'var(--font-heading, "Cormorant Garamond", Georgia, serif)',
                letterSpacing: '0.01em',
              }}>
                {formConfig.label}
              </h2>
              <p style={{
                margin: 0,
                fontSize: 12,
                color: 'rgba(255,255,255,0.35)',
                marginTop: 2,
              }}>
                {formConfig.description}
              </p>
            </div>
          </div>
          <button
            onClick={() => status !== 'submitting' && onClose?.()}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: 16,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* FORM BODY */}
        <div style={{
          padding: '24px 28px 28px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {status === 'success' ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 20px',
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: `${brandAccent}15`,
                border: `2px solid ${brandAccent}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 28,
              }}>
                ✓
              </div>
              <h3 style={{
                fontFamily: 'var(--font-heading, "Cormorant Garamond", Georgia, serif)',
                fontSize: 24,
                fontWeight: 400,
                color: '#fff',
                margin: '0 0 10px',
              }}>
                Submitted
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 28 }}>
                Thank you. Our team will be in touch shortly.
              </p>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 32px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* UNIVERSAL FIELDS: Name, Email, Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input
                    type="text"
                    value={formData._name || ''}
                    onChange={(e) => handleChange('_name', e.target.value)}
                    placeholder="Your full name"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = brandAccent + '60'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input
                    type="email"
                    value={formData._email || ''}
                    onChange={(e) => handleChange('_email', e.target.value)}
                    placeholder="you@email.com"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = brandAccent + '60'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input
                    type="tel"
                    value={formData._phone || ''}
                    onChange={(e) => handleChange('_phone', e.target.value)}
                    placeholder="(xxx) xxx-xxxx"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = brandAccent + '60'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
              </div>

              {/* DIVIDER */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '18px 0' }} />

              {/* FORM-SPECIFIC FIELDS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(formConfig.fields || []).map((field) => (
                  <div key={field.name}>
                    <label style={labelStyle}>
                      {field.label}{field.required ? ' *' : ''}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={formData[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        style={{
                          ...inputStyle,
                          appearance: 'none',
                          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%23666\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M8 11L3 6h10z\'/%3E%3C/svg%3E")',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 14px center',
                        }}
                      >
                        <option value="" style={{ background: '#111' }}>Select...</option>
                        {(field.options || []).map(opt => (
                          <option key={opt} value={opt} style={{ background: '#111' }}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.label}
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                        onFocus={(e) => e.target.style.borderColor = brandAccent + '60'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                      />
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.label}
                        style={inputStyle}
                        onFocus={(e) => e.target.style.borderColor = brandAccent + '60'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* HOW DID YOU HEAR */}
              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>How Did You Hear About Us?</label>
                <select
                  value={formData.referral_source || ''}
                  onChange={(e) => handleChange('referral_source', e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: 'none',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%23666\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M8 11L3 6h10z\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 14px center',
                  }}
                >
                  <option value="" style={{ background: '#111' }}>Select...</option>
                  {['Instagram', 'TikTok', 'Facebook', 'Twitter/X', 'Google', 'Friend/Referral', 'Event', 'Other'].map(opt => (
                    <option key={opt} value={opt} style={{ background: '#111' }}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* ERROR MESSAGE */}
              {errorMsg && (
                <div style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  background: 'rgba(255,68,68,0.08)',
                  border: '1px solid rgba(255,68,68,0.2)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#ff6b6b',
                }}>
                  {errorMsg}
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <button
                onClick={handleSubmit}
                disabled={status === 'submitting'}
                style={{
                  width: '100%',
                  marginTop: 22,
                  padding: '14px 24px',
                  background: status === 'submitting' ? 'rgba(255,255,255,0.05)' : brandAccent,
                  border: 'none',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: status === 'submitting' ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.02em',
                  transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                  opacity: status === 'submitting' ? 0.6 : 1,
                }}
              >
                {status === 'submitting' ? 'Submitting...' : 'Submit'}
              </button>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes khgFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes khgSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
