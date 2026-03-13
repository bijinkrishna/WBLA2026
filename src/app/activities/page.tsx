'use client';

import { Suspense } from 'react';
import ActivitiesContent from './ActivitiesContent';

export default function ActivitiesPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <ActivitiesContent />
    </Suspense>
  );
}
