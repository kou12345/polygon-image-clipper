export const LoadingSpinner: React.FC = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      marginTop: "20px",
      flexDirection: "column",
      gap: "10px",
    }}
  >
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    <p className="text-sm text-gray-600">PDF 表示中...</p>
  </div>
);
