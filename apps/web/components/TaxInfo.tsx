import { COMPANY_TITLE, TAX_OFFICE } from '@/lib/companyInfo';

export function TaxInfo({ showTitle = true }: { showTitle?: boolean }) {
  return (
    <>
      {showTitle && <p style={{ color: '#a39c93', fontSize: 13 }}>Ticari Unvan: {COMPANY_TITLE}</p>}
      <p style={{ color: '#a39c93', fontSize: 13 }}>Vergi Dairesi: {TAX_OFFICE}</p>
      <p style={{ color: '#a39c93', fontSize: 13 }}>Vergi No:</p>
    </>
  );
}
