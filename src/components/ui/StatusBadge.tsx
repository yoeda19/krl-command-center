export default function StatusBadge({ status }: { status: any }) {
  let cls = 'badge-aman';
  if (status === 'KRITIS' || status === 'FAST MOVING' || status === 'BELUM PO') {
    cls = 'badge-kritis';
  } else if (status === 'WASPADA') {
    cls = 'badge-waspada';
  } else if (status === 'SLOW MOVING') {
    cls = 'bg-blue-950/40 text-blue-400 border border-blue-800/60';
  } else if (status === 'DEAD STOCK') {
    cls = 'bg-slate-900/40 text-slate-400 border border-slate-700/60';
  }

  return (
    <div className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full ${cls}`}>
      <span className="text-[10px] font-black tracking-widest uppercase">{status === 'BELUM PO' ? 'NO PO' : status}</span>
    </div>
  );
}
