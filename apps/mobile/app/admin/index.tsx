import { Redirect } from 'expo-router';
// apps/web/app/admin/page.tsx: /admin → /admin/stats
export default function AdminRoot() { return <Redirect href="/admin/stats" />; }
