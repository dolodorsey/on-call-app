'use client';

import { KHGFormGrid } from '@/components/KHGForms';

export default function ConnectPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#080808',
    }}>
      {/* HERO */}
      <section style={{
        padding: 'clamp(100px, 15vw, 180px) clamp(20px, 5vw, 80px) clamp(40px, 6vw, 80px)',
        textAlign: 'center',
        position: 'relative',
      }}>
        <h1 style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: 'clamp(40px, 8vw, 80px)',
          fontWeight: 300,
          color: '#fff',
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
          marginBottom: 16,
        }}>
          Connect With Us
        </h1>
        <p style={{
          fontSize: 'clamp(14px, 1.5vw, 17px)',
          color: 'rgba(255,255,255,0.4)',
          maxWidth: 520,
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          Whether you're a vendor, artist, sponsor, volunteer, or just want to collaborate — we'd love to hear from you.
        </p>
      </section>

      {/* FORMS GRID */}
      <KHGFormGrid
        brandKey="on_call"
        title=""
        subtitle=""
        showSelective={false}
      />
    </main>
  );
}
