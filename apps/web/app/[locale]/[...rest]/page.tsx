import { notFound } from 'next/navigation';

// Bilinmeyen adres: kök not-found sayfası (seçili dilde)
export default function CatchAll() {
  notFound();
}
