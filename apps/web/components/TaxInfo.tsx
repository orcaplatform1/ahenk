import { COMPANY_TITLE, TAX_OFFICE, TAX_OFFICE_EN } from '@/lib/companyInfo';

// en: İngilizce yasal sayfalar
export function TaxInfo({ showTitle = true, en = false }: { showTitle?: boolean; en?: boolean }) {
  return (
    <>
      {showTitle && <p style={{ color: '#a39c93', fontSize: 13 }}>{en ? 'Trade Name' : 'Ticari Unvan'}: {COMPANY_TITLE}</p>}
      <p style={{ color: '#a39c93', fontSize: 13 }}>{en ? 'Tax Office' : 'Vergi Dairesi'}: {en ? TAX_OFFICE_EN : TAX_OFFICE}</p>
      <p style={{ color: '#a39c93', fontSize: 13 }}>{en ? 'Tax No' : 'Vergi No'}:</p>
    </>
  );
}
