'use client';

import { useParams } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';
import CityEditor from '@/components/CityEditor';

export default function EditCityPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <AdminLayout title="Editar Ciudad">
      <CityEditor cityId={id} />
    </AdminLayout>
  );
}
