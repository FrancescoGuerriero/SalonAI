export default function LoadingBlock({
  rows = 4,
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-xl bg-gray-100"
        />
      ))}
    </div>
  );
}
