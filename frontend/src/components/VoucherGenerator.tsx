import React, { useRef, useEffect, useState } from 'react';
import html2canvas from 'html2canvas';

interface VoucherGeneratorProps {
  voucher: any;
  onClose: () => void;
}

const VoucherGenerator: React.FC<VoucherGeneratorProps> = ({ voucher, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Roboto:wght@400;500;700&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    const VOUCHER_WIDTH = 920;
    const updateScale = () => {
      if (!previewAreaRef.current) return;
      const available = previewAreaRef.current.clientWidth - 32; // 16px padding each side
      setScale(Math.min(1, available / VOUCHER_WIDTH));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const isTourflot = voucher.tour_type === 'tourflot';
  const isJetskiVoucher = voucher.tour_type === 'jetski';
  const isVietnam = voucher.tour_type === 'vietnam' || /вьетнам|vietnam/i.test(voucher.company_name || '');

  const headerImg = isTourflot
    ? '/voucher-bg/header-tourflot.png'
    : isJetskiVoucher
    ? '/voucher-bg/footer-jetski-ru.png'
    : isVietnam
    ? '/voucher-bg/header-vietnam.png'
    : '/voucher-bg/header-phuket.png';

  const footerImg = isTourflot
    ? '/voucher-bg/footer-tourflot.png'
    : isJetskiVoucher
    ? '/voucher-bg/header-jetski.png'
    : isVietnam
    ? '/voucher-bg/footer-vietnam.png'
    : '/voucher-bg/footer-phuket.png';

  // accentColor kept for potential future use
  // const accentColor = isTourflot ? '#2271b1' : isJetskiVoucher ? '#0ea5e9' : isVietnam ? '#207550' : '#6b3fa0';
  const cashColor   = '#e53e3e';

  // Per-jetski passenger config (JSONB array from DB)
  const jetskiConfig: {adults: number; children: number}[] | null =
    isJetskiVoucher && Array.isArray(voucher.jetski_config) && voucher.jetski_config.length > 0
      ? voucher.jetski_config
      : null;

  const companyInfo = isTourflot
    ? { line1: 'Tour Flot Phuket (TFP Phuket Co., Ltd)', line2: '46/23 Moo.9 T.Chalong Muang Phuket 83130', line3: 'Contact: +66 81 968 0544 / +66 85 888 0071', line4: '@tourflot_phuket / www.tourflotphuket.com' }
    : isVietnam
    ? { line1: 'Тур Тур Вьетнам', line2: 'CÔNG TY TNHH DL HOA TIÊU THANH ĐẶNG ĐC: 34', line3: 'Nguyễn Thị Minh Khai - 09, Tôn Đản, Lộc Thọ, Nha Trang', line4: '@tour_tour_vietnam' }
    : { line1: 'Tour Tour Phuket (TFP Phuket Co., Ltd) License 34/02974', offices: ['Patong office: 168 Rat Uthit 200 Pi Road', 'Karon office: 470/4 Patak Road, Karon Subdistrict', 'Chalong office: 46/23 Sunrise Rd, Chalong'], line3: 'Contact: Thai/Eng: +66 81 968 0544, Eng/Rus: +66 85 888 0071', line4: '@tour_tour_phuket  /  www.tourtourphuket.ru' };

  const num = (v: any) => Number(v || 0);
  const currencySymbol = voucher.currency === 'VND' ? '₫' : voucher.currency === 'USD' ? '$' : voucher.currency === 'RUB' ? '₽' : '฿';
  const fmt = (v: any) => `${currencySymbol}${num(v).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

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
  const timeStr  = voucher.tour_time ? String(voucher.tour_time).slice(0,5) : '';
  const dateTime = [dateStr, timeStr].filter(Boolean).join(' • ');

  const totalSale    = num(voucher.total_sale);
  const paidToAgency = num(voucher.paid_to_agency);
  const cashOnTour   = num(voucher.cash_on_tour);
  const managerPhone = voucher.manager_phone || '';
  const defaultCancelTerms = `Аннуляция за 24 часа до выезда — без штрафа\n100% штраф в день поездки\nЧео Лан 2 дня: аннуляция без штрафа за 2 дня до выезда\nЧео Лан 2 дня: аннуляция без штрафа за 7 дней до выезда\nАннуляция осуществляется в рабочее время компании (09:00–21:00)\n\n⚠️ ВАЖНО! Беременные женщины не допускаются на скоростные лодки и прочие активити.\nУточняйте при бронировании тура.`;

  const cancelTermsRaw = Array.isArray(voucher.cancellation_terms) && voucher.cancellation_terms.length > 0
    ? voucher.cancellation_terms.join('\n')
    : (voucher.cancellation_notes || '');
  const cancelTerms = cancelTermsRaw || (isTourflot ? '' : defaultCancelTerms);
  // remarksText hidden from voucher per requirements

  const download = async () => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, allowTaint: true });
    const link = document.createElement('a');
    link.download = `voucher-${voucher.voucher_number}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  const S = {
    label: { fontSize: 13, fontWeight: 700, color: '#7B1C1C', letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 6, backgroundColor: '#f0f0f0', padding: '3px 10px', borderRadius: 4, display: 'block' as const },
    value: { fontSize: 22, fontWeight: 700, color: '#1a1a1a' },
    divider: { borderTop: '1px solid #eee', margin: '16px 0' },
    section: { marginBottom: 16 },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-3xl w-full flex flex-col my-auto">

        {/* Modal controls */}
        <div className="border-b px-4 py-3 flex justify-between items-center shrink-0 gap-3">
          <h2 className="text-base sm:text-xl font-bold text-gray-800 truncate">Ваучер № {voucher.voucher_number}</h2>
          <div className="flex space-x-2 shrink-0">
            <button onClick={download} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs sm:text-sm font-medium whitespace-nowrap">
              ⬇ Скачать JPG
            </button>
            <button onClick={onClose} className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-xs sm:text-sm whitespace-nowrap">
              Закрыть
            </button>
          </div>
        </div>

        {/* Voucher */}
        <div ref={previewAreaRef} className="overflow-auto p-4 flex justify-center bg-gray-100 min-h-0 flex-1">
          <div style={{ width: 920 * scale, flexShrink: 0 }}>
          <div ref={ref} style={{ width: 920, transformOrigin: 'top left', transform: `scale(${scale})`, backgroundColor: '#fff', fontFamily: "'Roboto', Arial, sans-serif", borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.12)' }}>

            {/* ── HEADER ── */}
            {isTourflot ? (
              <div style={{ backgroundColor: '#2f4974', position: 'relative', display: 'flex', alignItems: 'center', minHeight: 180 }}>
                <img src="/voucher-bg/flot-icon.png" alt="icon"
                  style={{ flexShrink: 0, height: 180, aspectRatio: '1', objectFit: 'cover', backgroundColor: 'white' }} />
                <div style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'flex-end', alignSelf: 'stretch', textAlign: 'right' }}>
                  {[(companyInfo as any).line1,
                    (companyInfo as any).line2,
                    (companyInfo as any).line3,
                    (companyInfo as any).line4,
                  ].map((line: string, i: number) => (
                    <div key={i} style={{ fontSize: 14, fontWeight: 700, color: 'white', lineHeight: 1.5 }}>{line}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative', overflow: 'hidden', maxHeight: (isVietnam || isJetskiVoucher) ? undefined : 480 }}>
                <img src={headerImg} alt="header" style={{ width: '100%', display: 'block', marginBottom: (isVietnam || isJetskiVoucher) ? 0 : -54 }} />
                {!isJetskiVoucher && !isVietnam && (
                <div style={{ position: 'absolute', top: 0, bottom: 0, right: '1.5%', textAlign: 'right', maxWidth: '52%', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '8px 0 20px' }}>
                  {[(companyInfo as any).line1,
                    ...((companyInfo as any).offices || [(companyInfo as any).line2]),
                    (companyInfo as any).line3,
                    (companyInfo as any).line4,
                  ].map((line: string, i: number) => (
                    <div key={i} style={{ fontSize: 15, fontWeight: 700, color: '#111', lineHeight: 1.4 }}>{line}</div>
                  ))}
                </div>
                )}
              </div>
            )}


            {/* ── BODY ── */}
            <div style={{ padding: '16px 32px 2px' }}>

              {/* VOUCHER № | DATE & TIME */}
              <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                <div style={{ flex: 1, backgroundColor: 'rgba(123, 28, 28, 0.12)', padding: '12px 16px', borderRadius: 8, borderLeft: '4px solid #7B1C1C' }}>
                  <div style={{ ...S.label, backgroundColor: 'transparent' }}>Voucher №</div>
                  <div style={{ ...S.value, fontFamily: "'Oswald', sans-serif", fontSize: 26, letterSpacing: 1, color: '#1a1a1a' }}>{voucher.voucher_number}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={S.label}>Date &amp; Time</div>
                  <div style={S.value}>{dateTime || '—'}</div>
                </div>
              </div>
              <div style={S.divider} />

              {/* TOUR */}
              <div style={S.section}>
                <div style={S.label}>Tour</div>
                <div style={{ ...S.value, fontSize: 26 }}>{voucher.tour_details || voucher.tour_name || '—'}</div>
              </div>
              <div style={S.divider} />

              {/* CLIENT NAME | PHONE */}
              <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={S.label}>Client Name</div>
                  <div style={S.value}>{voucher.client_name || '—'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={S.label}>Phone</div>
                  <div style={S.value}>{voucher.client_phone || '—'}</div>
                </div>
              </div>
              <div style={S.divider} />

              {/* TOTAL PASSENGERS | NUMBER OF PASSENGERS */}
              {isJetskiVoucher && jetskiConfig ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ ...S.label, marginBottom: 8 }}>Гидроциклы / Jetskis</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f0f4ff' }}>
                          <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 700, color: '#444', borderBottom: '2px solid #dce4f0' }}>#</th>
                          <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: '#444', borderBottom: '2px solid #dce4f0' }}>Adults / Взрослых</th>
                          <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: '#444', borderBottom: '2px solid #dce4f0' }}>Children / Детей</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jetskiConfig.map((jp, idx) => (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                            <td style={{ padding: '5px 12px', color: '#666', fontWeight: 600 }}>Jetski {idx + 1}</td>
                            <td style={{ padding: '5px 12px', textAlign: 'center', fontWeight: 700, color: '#1a1a1a' }}>{jp.adults}</td>
                            <td style={{ padding: '5px 12px', textAlign: 'center', fontWeight: 700, color: '#1a1a1a' }}>{jp.children}</td>
                          </tr>
                        ))}
                        <tr style={{ backgroundColor: '#f0f4ff', fontWeight: 700 }}>
                          <td style={{ padding: '6px 12px', color: '#444' }}>Total</td>
                          <td style={{ padding: '6px 12px', textAlign: 'center', color: '#1e3a5f' }}>{jetskiConfig.reduce((s, p) => s + p.adults, 0)}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'center', color: '#1e3a5f' }}>{jetskiConfig.reduce((s, p) => s + p.children, 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div style={S.divider} />
                </>
              ) : (
              <>
              <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={S.label}>Total Passengers</div>
                  <div style={S.value}>{totalPax > 0 ? `${totalPax} Person(s)` : '—'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.label, marginBottom: 8 }}>Number of Passengers</div>
                  <div style={{ display: 'flex', gap: 48 }}>
                    {[['Adults', adults], ['Children', children], ['Infants', infants]].map(([lbl, val]) => (
                      <div key={lbl as string}>
                        <div style={{ fontSize: 13, color: '#888' }}>{lbl}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={S.divider} />
              </>
              )}

              {/* HOTEL | ROOM */}
              {(voucher.hotel_name || voucher.room_number) && (
                <>
                  <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                    {voucher.hotel_name && (
                      <div style={{ flex: 1 }}>
                        <div style={S.label}>Hotel Name</div>
                        <div style={S.value}>{voucher.hotel_name}</div>
                      </div>
                    )}
                    {voucher.room_number && (
                      <div style={{ flex: 1 }}>
                        <div style={S.label}>Room Number</div>
                        <div style={S.value}>{voucher.room_number}</div>
                      </div>
                    )}
                    {voucher.hotline_phone && (
                      <div style={{ flex: 1, backgroundColor: 'rgba(123, 28, 28, 0.12)', borderRadius: 10, padding: '10px 16px', textAlign: 'center', borderLeft: '4px solid #7B1C1C' }}>
                        <div style={{ fontSize: 11, color: '#7B1C1C', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Hotline</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1a1a' }}>{voucher.hotline_phone}</div>
                      </div>
                    )}
                  </div>
                  <div style={S.divider} />
                </>
              )}

              {/* PRICE + CANCELLATION side by side */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 16, alignItems: 'flex-start' }}>

                {/* LEFT: Price Summary */}
                <div style={{ flex: cancelTerms || managerPhone ? 1 : undefined, width: cancelTerms || managerPhone ? undefined : '100%', backgroundColor: '#f8f9ff', borderRadius: 10, padding: '14px 16px', border: '1px solid #dce4f0' }}>
                  <div style={{ ...S.label, marginBottom: 12, backgroundColor: 'transparent' }}>Price Summary</div>
                  {(() => {
                    const isIndividual = voucher.tour_type === 'individual' || voucher.tour_type === 'tourflot';
                    const isJetski = isJetskiVoucher;
                    if (isIndividual) {
                      // Flat price — just show one line, no multiplication
                      return totalSale > 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 18, color: '#666' }}>Tour:</span>
                          <span style={{ fontSize: 18, color: '#333', fontWeight: 700 }}>{fmt(totalSale)}</span>
                        </div>
                      ) : null;
                    }
                    if (isJetski) {
                      const jetskiPrice = num(voucher.adult_sale);
                      const jetskiCount = jetskiConfig ? jetskiConfig.length : adults;
                      return jetskiPrice > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 18, color: '#666', textAlign: 'left' }}>Гидроцикл:</span>
                          <span style={{ fontSize: 18, color: '#555', textAlign: 'center' }}>{fmt(jetskiPrice)} × {jetskiCount}</span>
                          <span style={{ fontSize: 18, color: '#333', textAlign: 'right', fontWeight: 700 }}>{fmt(jetskiPrice * jetskiCount)}</span>
                        </div>
                      ) : null;
                    }
                    const rows = [
                      num(voucher.adult_sale) > 0   ? { label: 'Adult',    price: num(voucher.adult_sale),    qty: adults } : null,
                      num(voucher.child_sale) > 0 && children > 0 ? { label: 'Child',    price: num(voucher.child_sale),    qty: children } : null,
                      num(voucher.infant_sale) > 0 && infants > 0 ? { label: 'Infant',   price: num(voucher.infant_sale),   qty: infants } : null,
                      num(voucher.transfer_sale) > 0 ? { label: 'Transfer', price: num(voucher.transfer_sale), qty: adults + children } : null,
                      num(voucher.other_sale) > 0 ? { label: 'Other', price: num(voucher.other_sale), qty: 1 } : null,
                    ].filter(Boolean) as { label: string; price: number; qty: number }[];
                    const fallback = rows.length === 0 && totalSale > 0
                      ? [{ label: 'Tour', price: totalPax > 0 ? totalSale / totalPax : totalSale, qty: totalPax > 0 ? totalPax : 1 }]
                      : rows;
                    return fallback.map((row) => (
                      <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 18, color: '#666', textAlign: 'left' }}>{row.label}:</span>
                        <span style={{ fontSize: 18, color: '#555', textAlign: 'center' }}>{row.qty > 1 ? `${fmt(row.price)} × ${row.qty}` : ''}</span>
                        <span style={{ fontSize: 18, color: '#333', textAlign: 'right' }}>{fmt(row.price * row.qty)}</span>
                      </div>
                    ));
                  })()}
                  <div style={{ borderTop: '1px solid #eee', margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 19, color: '#444' }}>Total Amount:</span>
                    <span style={{ fontSize: 19, fontWeight: 700 }}>{fmt(totalSale)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 19, color: '#444' }}>Paid to Agency:</span>
                    <span style={{ fontSize: 19, fontWeight: 700 }}>{fmt(paidToAgency)}</span>
                  </div>
                  {cashOnTour > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#fff5f5', padding: '12px 16px', borderRadius: 8, borderLeft: `4px solid ${cashColor}` }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: cashColor }}>CASH ON TOUR:</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: cashColor }}>{fmt(cashOnTour)}</span>
                  </div>
                  )}
                </div>

                {/* RIGHT: Cancellation + Hotline */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {cancelTerms && (
                    <div style={{ backgroundColor: '#fff8f8', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#c00', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>📋 Правила аннуляции тура</div>
                      <div style={{ fontSize: 13, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.65, textAlign: 'justify' }}>{cancelTerms}</div>
                    </div>
                  )}
                  {managerPhone && (
                    <div style={{ backgroundColor: 'rgba(123, 28, 28, 0.12)', borderRadius: 10, padding: '14px 20px', textAlign: 'center', borderLeft: '4px solid #7B1C1C' }}>
                      <div style={{ fontSize: 11, color: '#7B1C1C', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Hotline</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1a1a' }}>{managerPhone}</div>
                    </div>
                  )}
                </div>

              </div>

              {/* REMARKS */}
              {voucher.remarks && (
                <div style={{ marginBottom: 16 }}>
                  <div style={S.divider} />
                  <div style={{ backgroundColor: '#f9f9f9', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ ...S.label, marginBottom: 6 }}>Remarks</div>
                    <div style={{ fontSize: 13, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{voucher.remarks}</div>
                  </div>
                </div>
              )}

            </div>

            {/* ── FOOTER ── */}
            {isTourflot ? (
              <div style={{ backgroundColor: '#2f4974', height: 160, position: 'relative', display: 'flex', alignItems: 'center', paddingLeft: 32 }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", letterSpacing: 2 }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'white', textTransform: 'uppercase' }}>Желаем попутного ветра!</div>
                  <div style={{ fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 3, marginTop: 4 }}>И семь футов под килем</div>
                </div>
                <img src="/voucher-bg/—Pngtree—luxury yacht sailing isolated on_20745614 1.png" alt="yacht"
                  style={{ position: 'absolute', right: 0, bottom: 0, height: '140%', objectFit: 'contain', objectPosition: 'bottom right' }} />
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <img src={footerImg} alt="footer" style={{ width: '100%', display: 'block' }} />
                {!isJetskiVoucher && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: 'white', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 2px 2px 8px rgba(0,0,0,0.5)', fontFamily: "'Oswald', sans-serif", letterSpacing: 3, textTransform: 'uppercase', marginTop: 10 }}>
                    ПРИЯТНОГО ОТДЫХА!
                  </div>
                </div>
                )}
              </div>
            )}

          </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VoucherGenerator;
