export default function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-[60] rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-card"
    >
      {message}
    </div>
  );
}
