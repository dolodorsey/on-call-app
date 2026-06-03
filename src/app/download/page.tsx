export const metadata = {
  title: "On Call - Android Download",
  description: "Download the On Call Android app directly.",
};

export default function DownloadPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0F1C",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      color: "#F5F0E8",
      padding: "40px 20px",
      textAlign: "center",
    }}>

      <div style={{ marginBottom: "32px" }}>
        <div style={{
          width: "80px", height: "80px",
          background: "#3B82F6",
          borderRadius: "20px",
          margin: "0 auto 20px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "36px"
        }}>📱</div>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          On Call
        </h1>
        <p style={{ color: "#3B82F6", fontSize: "1rem", margin: 0 }}>
          Book vetted service pros on demand.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%", maxWidth: "320px" }}>

        <a
          href="https://dzlmtvodpyhetvektfuo.supabase.co/storage/v1/object/public/apks/on-call-release.apk"
          download="on-call-release.apk"
          style={{
            background: "#3B82F6",
            color: "#0A0F1C",
            padding: "18px 32px",
            borderRadius: "12px",
            fontWeight: 800,
            fontSize: "1.05rem",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          ⬇ Download for Android
        </a>

        <a
          href="https://testflight.apple.com"
          style={{
            background: "transparent",
            color: "#F5F0E8",
            padding: "16px 32px",
            borderRadius: "12px",
            fontWeight: 600,
            fontSize: "1rem",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            border: "1px solid rgba(245,240,232,0.2)",
          }}
        >
           Download for iPhone (TestFlight)
        </a>

      </div>

      <div style={{ marginTop: "40px", maxWidth: "300px" }}>
        <p style={{ color: "rgba(245,240,232,0.4)", fontSize: "0.8rem", lineHeight: 1.6 }}>
          <strong style={{ color: "rgba(245,240,232,0.7)" }}>Android:</strong> After download, open the APK file.
          Enable <em>Install from Unknown Sources</em> in Settings if prompted.
        </p>
        <p style={{ color: "rgba(245,240,232,0.4)", fontSize: "0.8rem", lineHeight: 1.6, marginTop: "8px" }}>
          <strong style={{ color: "rgba(245,240,232,0.7)" }}>iPhone:</strong> TestFlight link opens the App Store.
          No Apple approval required — available immediately.
        </p>
      </div>

      <p style={{ marginTop: "48px", color: "rgba(245,240,232,0.25)", fontSize: "0.75rem" }}>
        The Kollective Hospitality Group · oncallallday.com
      </p>
    </div>
  );
}
