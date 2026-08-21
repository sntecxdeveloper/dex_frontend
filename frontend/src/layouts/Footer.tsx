export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-4 px-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          © 2026 Dex Platform. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <a href="#" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Privacy</a>
          <a href="#" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Terms</a>
          <a href="#" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Support</a>
        </div>
      </div>
    </footer>
  );
}
