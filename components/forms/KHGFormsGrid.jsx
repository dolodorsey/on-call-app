'use client';

import { useState } from 'react';
import KHGFormModal from './KHGFormModal';
import { BRAND_CONFIG, FORM_TYPES, getBrandForms } from '@/lib/forms-config';

/**
 * KHGFormsGrid — Full "Connect With Us" section with all form buttons.
 * 
 * Drop this into any page on any KHG brand site.
 * It reads NEXT_PUBLIC_BRAND_KEY from env to determine which forms to show.
 * 
 * Usage:
 *   <KHGFormsGrid />                              // uses env brand key
 *   <KHGFormsGrid brandKey="huglife" />           // explicit override
 *   <KHGFormsGrid title="Work With Us" />         // custom heading
 */
export default function KHGFormsGrid({
  brandKey,
  title = 'Connect With Us',
  subtitle = 'Choose an option below to get started.',
}) {
  const key = brandKey || process.env.NEXT_PUBLIC_BRAND_KEY || 'huglife';
  const config = BRAND_CONFIG[key] || BRAND_CONFIG.huglife;
  const forms = getBrandForms(key);
  
  const [activeForm, setActiveForm] = useState(null);

  return (
    <>
      <section style={{
        padding: 'clamp(60px, 10vw, 140px) clamp(20px, 5vw, 80px)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* GRAIN OVERLAY */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          pointerEvents: 'none',
        }} />

        {/* HEADER */}
        <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 6vw, 80px)', position: 'relative' }}>
          <div style={{
            width: 1,
            height: 40,
            background: `linear-gradient(to bottom, transparent, ${config.accent}50)`,
            margin: '0 auto 24px',
          }} />
          <h2 style={{
            fontFamily: 'var(--font-heading, "Cormorant Garamond", Georgia, serif)',
            fontSize: 'clamp(32px, 5vw, 60px)',
            fontWeight: 300,
            color: '#fff',
            margin: '0 0 14px',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
          }}>
            {title}
          </h2>
          <p style={{
            fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
            fontSize: 'clamp(13px, 1.4vw, 15px)',
            color: 'rgba(255,255,255,0.4)',
            maxWidth: 440,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            {subtitle}
          </p>
        </div>

        {/* GRID */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
          maxWidth: 1100,
          margin: '0 auto',
          position: 'relative',
        }}>
          {forms.map((form, i) => (
            <FormButton
              key={form.key}
              form={form}
              accent={config.accent}
              delay={i * 40}
              onClick={() => setActiveForm(form.key)}
            />
          ))}
        </div>
      </section>

      {/* FORM MODAL */}
      <KHGFormModal
        isOpen={!!activeForm}
        formType={activeForm}
        formConfig={activeForm ? FORM_TYPES[activeForm] : null}
        brandAccent={config.accent}
        brandName={config.name}
        onClose={() => setActiveForm(null)}
      />
    </>
  );
}

function FormButton({ form, accent, delay, onClick }) {
  const [hovered, setHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        background: hovered ? `${accent}0C` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? accent + '30' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 12,
        color: '#fff',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
        textAlign: 'left',
        transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? `0 8px 32px ${accent}12` : 'none',
        animation: `khgReveal 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
      }}
    >
      <span style={{
        fontSize: 18,
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered ? `${accent}15` : 'rgba(255,255,255,0.03)',
        borderRadius: 9,
        flexShrink: 0,
        transition: 'background 0.3s ease',
      }}>
        {form.icon}
      </span>
      <span style={{ letterSpacing: '0.01em' }}>{form.label}</span>

      <style jsx>{`
        @keyframes khgReveal {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </button>
  );
}

/**
 * INDIVIDUAL FORM BUTTON — use anywhere on any page
 * 
 * Usage:
 *   <KHGFormTrigger formKey="rsvp" label="RSVP Now" />
 *   <KHGFormTrigger formKey="sponsor" variant="accent" />
 */
export function KHGFormTrigger({
  formKey,
  label,
  variant = 'default', // 'default' | 'accent' | 'outline' | 'ghost'
  size = 'md',
  brandKey,
  className = '',
  style: customStyle = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const key = brandKey || process.env.NEXT_PUBLIC_BRAND_KEY || 'huglife';
  const config = BRAND_CONFIG[key] || BRAND_CONFIG.huglife;
  const formConfig = FORM_TYPES[formKey];
  
  if (!formConfig) return null;

  const sizes = {
    sm: { padding: '8px 16px', fontSize: 12 },
    md: { padding: '12px 24px', fontSize: 14 },
    lg: { padding: '16px 32px', fontSize: 15 },
  };

  const variants = {
    default: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: '#fff',
    },
    accent: {
      background: config.accent,
      border: `1px solid ${config.accent}`,
      color: '#fff',
    },
    outline: {
      background: 'transparent',
      border: `1px solid ${config.accent}50`,
      color: config.accent,
    },
    ghost: {
      background: 'transparent',
      border: '1px solid transparent',
      color: 'rgba(255,255,255,0.7)',
    },
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={className}
        style={{
          ...sizes[size],
          ...variants[variant],
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 10,
          cursor: 'pointer',
          fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
          fontWeight: 500,
          letterSpacing: '0.02em',
          transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
          ...customStyle,
        }}
      >
        <span style={{ fontSize: size === 'sm' ? 14 : 16 }}>{formConfig.icon}</span>
        {label || formConfig.label}
      </button>

      <KHGFormModal
        isOpen={isOpen}
        formType={formKey}
        formConfig={formConfig}
        brandAccent={config.accent}
        brandName={config.name}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
