
import { Suspense } from 'react';
import { ConfirmRideUI } from './confirm-ride-ui';
import { withAuth } from '@/components/with-auth';

function ConfirmRidePage() {

  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-background">Carregando...</div>}>
      <ConfirmRideUI />
    </Suspense>
  );
}

export default withAuth(ConfirmRidePage, ["passenger"]);
