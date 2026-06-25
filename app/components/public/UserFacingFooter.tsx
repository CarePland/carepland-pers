type UserFacingFooterProps = {
  buildInfo?: string | null;
  onWhyCarePland: () => void;
};

export function UserFacingFooter({
  buildInfo = null,
  onWhyCarePland,
}: UserFacingFooterProps) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 flex min-h-12 items-center justify-center border-t border-slate-100 bg-slate-50 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-[11px] text-slate-400 shadow-[0_-1px_10px_rgba(15,23,42,0.04)] sm:px-4 lg:px-6">
      {buildInfo ? (
        <p className="absolute left-0 hidden max-w-[38%] truncate text-left md:block">
          {buildInfo}
        </p>
      ) : null}
      <p className="text-center">© 2026 CarePland</p>
      <button
        className="absolute right-0 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-500 hover:bg-blue-100 hover:text-blue-700"
        onClick={onWhyCarePland}
        type="button"
      >
        Why CarePland?
      </button>
    </footer>
  );
}
