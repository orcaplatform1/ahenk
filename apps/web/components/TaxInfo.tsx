import { TAX_OFFICE } from '@/lib/companyInfo';

export function TaxInfo() {
  return (
    <>
      <p style={{ color: '#a39c93', fontSize: 13 }}>Vergi Dairesi: {TAX_OFFICE}</p>
      <p style={{ color: '#a39c93', fontSize: 13 }}>Vergi No:</p>
    </>
  );
}
