export default function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center">
      <div className="relative">
        {/* Outer ring */}
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
        {/* Inner ring */}
        <div className="absolute top-0 left-0 animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-blue-600 border-r-purple-600"></div>
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse text-2xl">🔄</div>
        </div>
      </div>
    </div>
  );
} 