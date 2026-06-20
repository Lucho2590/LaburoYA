'use client';

import { AdminLayout } from '@/components/AdminLayout';
import CityEditor from '@/components/CityEditor';

export default function NewCityPage() {
  return (
    <AdminLayout title="Nueva Ciudad">
      <CityEditor />
    </AdminLayout>
  );
}
