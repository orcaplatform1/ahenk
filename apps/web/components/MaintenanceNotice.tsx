// Bakım modu açıkken üyelere gösterilen uyarı (admin ayarları → Bakım Modu)
export default function MaintenanceNotice() {
  return (
    <div className="mb-4 rounded-2xl px-4 py-3" style={{ background: 'rgba(201,162,39,0.10)', border: '1px solid rgba(201,162,39,0.35)' }}>
      <p className="text-sm font-semibold mb-0.5" style={{ color: '#e0b84a' }}>Bakım çalışması</p>
      <p className="text-xs text-[#ccc] leading-relaxed">
        Kısa bir bakım çalışması yapıyoruz. Bu sürede paket satın alma ve yeni eşleşmeler geçici olarak durduruldu.
      </p>
    </div>
  );
}
