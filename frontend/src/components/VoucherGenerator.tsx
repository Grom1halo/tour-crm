import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

interface VoucherGeneratorProps {
  voucher: any;
  onClose: () => void;
}

const VoucherGenerator: React.FC<VoucherGeneratorProps> = ({ voucher, onClose }) => {
  const voucherRef = useRef<HTMLDivElement>(null);

  const downloadAsImage = async () => {
    if (!voucherRef.current) return;

    try {
      const canvas = await html2canvas(voucherRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `voucher-${voucher.voucher_number}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating voucher image:', error);
      alert('Failed to generate voucher image');
    }
  };

  const getTotalPax = () => {
    return (voucher.adults || 0) + (voucher.children || 0) + (voucher.infants || 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Voucher Preview</h2>
          <div className="flex space-x-3">
            <button
              onClick={downloadAsImage}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Download Image
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Close
            </button>
          </div>
        </div>

        {/* Voucher Content */}
        <div className="p-6">
          <div
            ref={voucherRef}
            className="bg-white border-2 border-gray-300 rounded-lg overflow-hidden"
            style={{ width: '800px', margin: '0 auto' }}
          >
            {/* Header with gradient background */}
            <div
              className="relative text-white p-8"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-4xl font-bold mb-2">TOUR TOUR PHUKET</h1>
                  <p className="text-sm opacity-90">Your Tropical Adventure Partner</p>
                </div>
                <div className="text-right">
                  <div className="text-xs opacity-75 mb-1">VOUCHER №</div>
                  <div className="text-3xl font-bold">{voucher.voucher_number}</div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="mt-6 pt-4 border-t border-white/30 text-sm opacity-90">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    📞 +66 (0) 123-456-789<br />
                    📧 info@tourtourphuket.com
                  </div>
                  <div className="text-right">
                    🌐 www.tourtourphuket.com<br />
                    📍 Phuket, Thailand
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-8">
              {/* Tour Info */}
              <div className="mb-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tour</div>
                <div className="text-2xl font-bold text-gray-800">{voucher.tour_name}</div>
                <div className="text-sm text-gray-600 mt-1">by {voucher.company_name}</div>
              </div>

              {/* Client & Date Info Grid */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Client Name</div>
                  <div className="text-lg font-semibold text-gray-800">{voucher.client_name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Phone</div>
                  <div className="text-lg font-semibold text-gray-800">{voucher.client_phone}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Date & Time</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {format(new Date(voucher.tour_date), 'dd MMM yyyy')}
                    {voucher.tour_time && ` • ${voucher.tour_time}`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Passengers</div>
                  <div className="text-lg font-semibold text-gray-800">{getTotalPax()} Person(s)</div>
                </div>
              </div>

              {/* Passengers Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Number of Passengers</div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Adults</div>
                    <div className="text-xl font-bold text-gray-800">{voucher.adults || 0}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Children</div>
                    <div className="text-xl font-bold text-gray-800">{voucher.children || 0}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Infants</div>
                    <div className="text-xl font-bold text-gray-800">{voucher.infants || 0}</div>
                  </div>
                </div>
              </div>

              {/* Hotel Info */}
              {(voucher.hotel_name || voucher.room_number) && (
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {voucher.hotel_name && (
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Hotel Name</div>
                      <div className="text-lg font-semibold text-gray-800">{voucher.hotel_name}</div>
                    </div>
                  )}
                  {voucher.room_number && (
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Room Number</div>
                      <div className="text-lg font-semibold text-gray-800">{voucher.room_number}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Price Summary */}
              <div className="border-t-2 border-gray-200 pt-6 mb-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Price Summary</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-700">
                    <span>Total Amount:</span>
                    <span className="font-semibold">฿{Number(voucher.total_sale).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Paid to Agency:</span>
                    <span className="font-semibold">฿{Number(voucher.paid_to_agency || 0).toFixed(2)}</span>
                  </div>
                  {voucher.cash_on_tour > 0 && (
                    <div className="flex justify-between text-red-600 font-bold text-lg pt-2 border-t border-gray-200">
                      <span>CASH ON TOUR:</span>
                      <span>฿{Number(voucher.cash_on_tour).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Remarks */}
              {voucher.remarks && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                  <div className="text-xs text-yellow-800 uppercase tracking-wide mb-1">Remarks</div>
                  <div className="text-sm text-yellow-900">{voucher.remarks}</div>
                </div>
              )}

              {/* Important Notice */}
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                <div className="font-bold text-red-800 mb-2 text-center">⚠️ ВАЖНО! / IMPORTANT!</div>
                <div className="text-xs text-red-900 space-y-1">
                  <p>• Пожалуйста, будьте готовы за 10 минут до указанного времени</p>
                  <p>• Please be ready 10 minutes before the specified time</p>
                  <p>• Отмена или изменение за 24 часа - бесплатно / Cancellation within 24h - free</p>
                  <p>• Отмена менее чем за 24 часа - штраф 50% / Less than 24h - 50% penalty</p>
                  <p>• No-show - штраф 100% / No-show - 100% penalty</p>
                </div>
              </div>

              {/* Hotline */}
              <div className="text-center bg-blue-600 text-white py-4 rounded-lg mb-4">
                <div className="text-sm mb-1">24/7 HOTLINE</div>
                <div className="text-2xl font-bold">+66 (0) 123-456-789</div>
              </div>

              {/* Footer */}
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 mb-2">🌴 ПРИЯТНОГО ОТДЫХА! 🌴</div>
                <div className="text-xl font-bold text-purple-600">HAVE A NICE VACATION!</div>
              </div>
            </div>

            {/* Footer Gradient */}
            <div
              className="h-4"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherGenerator;
