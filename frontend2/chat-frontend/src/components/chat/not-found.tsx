import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 items-center justify-center flex-col gap-4">
      <p className="text-6xl font-bold text-slate-600">404</p>
      <p className="text-slate-400">Page not found</p>
      <Link
        to="/"
        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
