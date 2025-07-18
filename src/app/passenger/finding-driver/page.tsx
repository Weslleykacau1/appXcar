
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { Map } from '@/components/map';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { setItem, removeItem } from '@/lib/storage';
import { useWakeLock } from '@/hooks/use-wake-lock';

const PASSENGER_CURRENT_RIDE = 'passenger_current_ride';
const RIDE_TO_RATE_DRIVER = 'ride_to_rate_driver';

interface RideDetails {
    pickupAddress: string;
    destinationAddress: string;
    driverId?: string;
    driverName?: string;
    driverAvatar?: string;
}

function FindingDriverComponent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rideId = searchParams.get('rideId');
    const { toast } = useToast();
    const [rideDetails, setRideDetails] = useState<RideDetails | null>(null);

    useWakeLock();

    useEffect(() => {
        if (!rideId) {
            toast({ variant: 'destructive', title: 'Erro', description: 'ID da corrida não encontrado.' });
            router.push('/passenger/request-ride');
            return;
        }
        
        const unsubscribe = onSnapshot(doc(db, 'rides', rideId), async (docSnap) => {
            if (docSnap.exists()) {
                const rideData = docSnap.data();
                setRideDetails({
                    pickupAddress: rideData.pickupAddress,
                    destinationAddress: rideData.destinationAddress,
                });

                if (rideData.status === 'accepted' && rideData.driverId) {
                     const driverProfileSnap = await getDoc(doc(db, "profiles", rideData.driverId));
                     const driverProfile = driverProfileSnap.data();

                     setItem(RIDE_TO_RATE_DRIVER, {
                        rideId: docSnap.id,
                        driverName: driverProfile?.name || 'Motorista',
                        driverAvatar: driverProfile?.photoUrl || '',
                    });
                    
                    unsubscribe();
                    router.replace(`/passenger/on-ride?rideId=${rideId}`);
                }
            } else {
                 toast({ variant: 'destructive', title: 'Erro', description: 'Corrida não encontrada.' });
                 router.push('/passenger/request-ride');
            }
        });

        return () => unsubscribe();
    }, [rideId, router, toast]);

    const handleCancelRide = async () => {
        if (!rideId) return;
        try {
            const rideDocRef = doc(db, 'rides', rideId);
            await updateDoc(rideDocRef, { status: 'cancelled' });
            removeItem(PASSENGER_CURRENT_RIDE);
            toast({ title: 'Corrida cancelada.' });
            router.push('/passenger/request-ride');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível cancelar a corrida.' });
        }
    };

    return (
        <div className="h-screen w-screen relative flex flex-col bg-background">
            <div className="flex-1 relative">
                <Map />
                 <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="relative w-64 h-64">
                         <div className="absolute inset-0 border-4 border-primary/30 rounded-full animate-pulse"></div>
                         <div className="absolute inset-4 border-4 border-primary/50 rounded-full animate-pulse delay-150"></div>
                         <div className="absolute inset-8 border-4 border-primary/70 rounded-full animate-pulse delay-300"></div>
                    </div>
                 </div>
            </div>
             <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl p-6 space-y-6">
                 <div className="text-center">
                    <h2 className="text-2xl font-bold">Procurando por um motorista...</h2>
                    <p className="text-muted-foreground">Isso pode levar um momento.</p>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-green-500 mt-1"/>
                        <div>
                            <p className="text-xs text-muted-foreground">Partida</p>
                            <p className="font-semibold">{rideDetails?.pickupAddress}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-red-500 mt-1"/>
                         <div>
                            <p className="text-xs text-muted-foreground">Destino</p>
                            <p className="font-semibold">{rideDetails?.destinationAddress}</p>
                        </div>
                    </div>
                 </div>
                 <Button variant="destructive" className="w-full h-12" onClick={handleCancelRide}>
                     Cancelar
                 </Button>
            </div>
        </div>
    );
}


export default function FindingDriverPage() {
    return (
        <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-background">Carregando...</div>}>
            <FindingDriverComponent />
        </Suspense>
    );
}
