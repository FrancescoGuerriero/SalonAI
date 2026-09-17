function LoadingSpinner({
  message = "Loading..."
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        minHeight: "60vh",
        width: "100%",
        gap: "1rem"
      }}
    >
      <div
        className="salonai-loading-spinner"
        aria-hidden="true"
        style={{
          width: "48px",
          height: "48px",
          border: "5px solid #e5e7eb",
          borderTop: "5px solid #555552",
          borderRadius: "50%",
          animation: "salonai-loading-spin 0.8s linear infinite"
        }}
      />

      <p
        style={{
          margin: 0,
          fontSize: "1rem",
          color: "#454542"
        }}
      >
        {message}
      </p>

      <style>{`
        @keyframes salonai-loading-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .salonai-loading-spinner {
            animation-duration: 1.6s !important;
          }
        }
      `}</style>
    </div>
  );
}

export default LoadingSpinner;
