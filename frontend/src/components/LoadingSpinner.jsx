function LoadingSpinner({
  message = "Loading..."
}) {
  return (
    <div
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
        style={{
          width: "48px",
          height: "48px",
          border: "5px solid #e5e7eb",
          borderTop: "5px solid #2563eb",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }}
      />

      <p
        style={{
          margin: 0,
          fontSize: "1rem",
          color: "#4b5563"
        }}
      >
        {message}
      </p>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default LoadingSpinner;