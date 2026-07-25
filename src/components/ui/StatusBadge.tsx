export default function StatusBadge({ status }: { status: any }) {
  let cls = 'badge-aman';
  if (status === 'KRITIS' || status === 'FAST MOVING' || status === 'BELUM PO') {
    cls = 'badge-kritis';
  } else if (status === 'WASPADA') {
    cls = 'badge-waspada';
  } else if (status === 'SLOW MOVING') {
    cls = 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60';
  } else if (status === 'DEAD STOCK') {
    cls = 'bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700/60';
  }

  const labelText = status === 'BELUM PO' ? 'Belum PO' : status;

  return (
    <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md ${cls}`}>
      <span className="text-[11px] font-semibold tracking-wide">{labelText}</span>
    </div>
  );
}
