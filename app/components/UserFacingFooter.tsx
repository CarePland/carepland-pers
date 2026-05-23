type UserFacingFooterProps = {
  buildInfo?: string | null;
  onWhyCarePland: () => void;
};

export function UserFacingFooter({
  buildInfo = null,
  onWhyCarePland,
}: UserFacingFooterProps) {
  return (
    <footer className="relative mt-10 flex min-h-8 items-center justify-center pb-3 text-[11px] text-slate-400">
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
