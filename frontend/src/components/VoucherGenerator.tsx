import React, { useRef } from 'react';
import html2canvas from 'html2canvas';

interface VoucherGeneratorProps {
  voucher: any;
  onClose: () => void;
}

const VoucherGenerator: React.FC<VoucherGeneratorProps> = ({ voucher, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  const isTourflot   = voucher.tour_type === 'tourflot';
  const isVietnam    = /вьетнам|vietnam/i.test(voucher.company_name || '');

  // ── Palette ────────────────────────────────────────────────────────────────
  const headerGrad = isTourflot
    ? 'linear-gradient(135deg, #1a3a5c 0%, #1e5080 60%, #2271b1 100%)'
    : isVietnam
    ? 'linear-gradient(135deg, #1a5c3a 0%, #207550 60%, #27a06b 100%)'
    : 'linear-gradient(135deg, #6b3fa0 0%, #5a3490 50%, #3b5bab 100%)';
  const accentColor = isTourflot ? '#2271b1' : isVietnam ? '#207550' : '#6b3fa0';
  const cashColor   = '#e53e3e';

  // ── Data ───────────────────────────────────────────────────────────────────
  const num  = (v: any) => Number(v || 0);
  const fmt  = (v: any) => `฿${num(v).toFixed(2)}`;
  const adults   = num(voucher.adults);
  const children = num(voucher.children);
  const infants  = num(voucher.infants);
  const totalPax = adults + children + infants;

  let dateStr = '';
  if (voucher.tour_date) {
    const d = new Date(voucher.tour_date);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dateStr = `${String(d.getUTCDate()).padStart(2,'0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  const timeStr    = voucher.tour_time ? String(voucher.tour_time).slice(0,5) : '';
  const dateTime   = [dateStr, timeStr].filter(Boolean).join(' • ');

  const totalSale    = num(voucher.total_sale);
  const paidToAgency = num(voucher.paid_to_agency);
  const cashOnTour   = num(voucher.cash_on_tour);
  const managerPhone = voucher.manager_phone || '';
  const cancelNotes  = voucher.cancellation_notes || '';
  const remarksText  = (voucher.is_important ? '[ВАЖНО] ' : '') + (voucher.remarks || '');

  // ── Header info per template ───────────────────────────────────────────────
  const headerInfo = isTourflot
    ? { title: 'TOUR FLOT PHUKET', subtitle: 'TFP Phuket Co., Ltd', phone: '+66 81 968 0544', site: 'www.tourflotphuket.com' }
    : isVietnam
    ? { title: 'ТУР ТУР ВЬЕТНАМ', subtitle: 'Экскурсии с русским гидом', phone: '+66 85 888 0071', site: 'www.tourtourphuket.ru' }
    : { title: 'TOUR TOUR PHUKET', subtitle: 'Your Tropical Adventure Partner', phone: '+66 85 888 0071', site: 'www.tourtourphuket.ru' };

  // ── Download ───────────────────────────────────────────────────────────────
  const download = async () => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, allowTaint: true });
    const link = document.createElement('a');
    link.download = `voucher-${voucher.voucher_number}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const S = {
    label: { fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 4 },
    value: { fontSize: 17, fontWeight: 700, color: '#1a1a1a' },
    divider: { borderTop: '1px solid #eee', margin: '16px 0' },
    section: { marginBottom: 16 },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-3xl w-full flex flex-col my-auto">

        {/* Modal controls */}
        <div className="border-b px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Ваучер № {voucher.voucher_number}</h2>
          <div className="flex space-x-3">
            <button onClick={download} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
              ⬇ Скачать JPG
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm">
              Закрыть
            </button>
          </div>
        </div>

        {/* Voucher */}
        <div className="overflow-auto p-4 flex justify-center bg-gray-100 min-h-0 flex-1">
          <div ref={ref} style={{ width: 760, backgroundColor: '#fff', fontFamily: "'Segoe UI', Arial, sans-serif", borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.12)' }}>

            {/* ── HEADER ── */}
            <div style={{ background: headerGrad, padding: '28px 32px 0' }}>
              {/* Row 1: title + voucher number */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'white', letterSpacing: 1 }}>{headerInfo.title}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{headerInfo.subtitle}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase' }}>Voucher №</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'white', letterSpacing: 1 }}>{voucher.voucher_number}</div>
                </div>
              </div>
              {/* Row 2: contacts */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingBottom: 16, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 16 }}>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>📞 {headerInfo.phone}</span>
                  {managerPhone && managerPhone !== headerInfo.phone && <span>📱 {managerPhone}</span>}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>🌐 {headerInfo.site}</span>
                  <span>📍 {isVietnam ? 'Vietnam' : 'Phuket, Thailand'}</span>
                </div>
              </div>
            </div>

            {/* ── BODY ── */}
            <div style={{ padding: '28px 32px' }}>

              {/* TOUR */}
              <div style={S.section}>
                <div style={S.label}>Tour</div>
                <div style={{ ...S.value, fontSize: 22 }}>{voucher.tour_name || '—'}</div>
                {voucher.company_name && <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>by {voucher.company_name}</div>}
              </div>
              <div style={S.divider} />

              {/* CLIENT NAME | PHONE */}
              <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                <div style={{ flex: 2 }}>
                  <div style={S.label}>Client Name</div>
                  <div style={S.value}>{voucher.client_name || '—'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={S.label}>Phone</div>
                  <div style={S.value}>{voucher.client_phone || '—'}</div>
                </div>
              </div>
              <div style={S.divider} />

              {/* DATE | TOTAL PAX */}
              <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={S.label}>Date &amp; Time</div>
                  <div style={S.value}>{dateTime || '—'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={S.label}>Total Passengers</div>
                  <div style={S.value}>{totalPax > 0 ? `${totalPax} Person(s)` : '—'}</div>
                </div>
              </div>

              {/* PAX breakdown box */}
              <div style={{ backgroundColor: '#f7f7fb', borderRadius: 8, padding: '14px 20px', marginBottom: 16 }}>
                <div style={{ ...S.label, marginBottom: 10 }}>Number of Passengers</div>
                <div style={{ display: 'flex', gap: 48 }}>
                  {[['Adults', adults], ['Children', children], ['Infants', infants]].map(([lbl, val]) => (
                    <div key={lbl as string}>
                      <div style={{ fontSize: 12, color: '#888' }}>{lbl}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={S.divider} />

              {/* HOTEL | ROOM */}
              <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                <div style={{ flex: 2 }}>
                  <div style={S.label}>Hotel Name</div>
                  <div style={S.value}>{voucher.hotel_name || '—'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={S.label}>Room Number</div>
                  <div style={S.value}>{voucher.room_number || '—'}</div>
                </div>
              </div>
              <div style={S.divider} />

              {/* PRICE SUMMARY */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...S.label, marginBottom: 12 }}>Price Summary</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, color: '#444' }}>Total Amount:</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{fmt(totalSale)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 15, color: '#444' }}>Paid to Agency:</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{fmt(paidToAgency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#fff5f5', padding: '12px 16px', borderRadius: 8, borderLeft: `4px solid ${cashColor}` }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: cashColor }}>CASH ON TOUR:</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: cashColor }}>{fmt(cashOnTour)}</span>
                </div>
              </div>

              {/* ВАЖНО box */}
              {cancelNotes && (
                <div style={{ backgroundColor: '#fff8f8', border: '1px solid #fca5a5', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#c00', marginBottom: 8 }}>⚠️ ВАЖНО! / IMPORTANT!</div>
                  <div style={{ fontSize: 13, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{cancelNotes}</div>
                </div>
              )}

              {/* REMARKS */}
              {remarksText && (
                <div style={{ backgroundColor: '#fffbea', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#555' }}>
                  {remarksText}
                </div>
              )}

              {/* HOTLINE */}
              {managerPhone && managerPhone !== headerInfo.phone && (
                <div style={{ background: headerGrad, borderRadius: 10, padding: '16px 24px', textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>24/7 Hotline</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'white' }}>{managerPhone}</div>
                </div>
              )}

              {/* FOOTER */}
              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: accentColor }}>
                  🌴 ПРИЯТНОГО ОТДЫХА! 🌴
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: accentColor, opacity: 0.7, marginTop: 4 }}>
                  HAVE A NICE VACATION!
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VoucherGenerator;
