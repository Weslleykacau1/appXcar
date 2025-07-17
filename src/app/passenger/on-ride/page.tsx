
"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Map } from '@/components/map';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Star, Phone, MessageSquare, Shield, X, MapPin } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { removeItem, setItem } from '@/lib/storage';

const RIDE_TO_RATE_DRIVER = 'ride_to_rate_driver';

interface RideData {
    status: 'accepted' | 'arrived' | 'completed' | 'cancelled';
    driverId: string;
    driverName: string;
    driverVehicleModel: string;
    driverVehiclePlate: string;
    pickupAddress: string;
    destinationAddress: string;
}

interface DriverProfile {
    photoUrl: string;
    phone: string; // Add phone to driver profile
}

function OnRideComponent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rideId = searchParams.get('rideId');
    const { toast } = useToast();

    const [rideData, setRideData] = useState<RideData | null>(null);
    const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
    const [eta, setEta] = useState(5); // Mock ETA in minutes

    useEffect(() => {
        if (!rideId) {
            router.push('/passenger/request-ride');
            return;
        }

        const unsubscribe = onSnapshot(doc(db, 'rides', rideId), async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as RideData;
                setRideData(data);

                if (data.status === 'completed') {
                    unsubscribe();
                    toast({ title: 'Viagem Concluída!', description: 'Obrigado por viajar conosco. Por favor, avalie seu motorista.' });
                    router.replace(`/passenger/rate-driver`);
                } else if (data.status === 'cancelled') {
                    unsubscribe();
                    toast({ variant: 'destructive', title: 'Corrida Cancelada', description: 'O motorista cancelou a corrida.' });
                    removeItem('passenger_current_ride');
                    router.replace('/passenger/request-ride');
                }

                if (data.driverId && !driverProfile) {
                    const driverSnap = await getDoc(doc(db, 'profiles', data.driverId));
                    if(driverSnap.exists()){
                        const driverData = driverSnap.data();
                        setDriverProfile({
                            photoUrl: driverData.photoUrl,
                            phone: driverData.phone || '5511999999999' // fallback phone
                        });
                    }
                }
            }
        });
        
        // Mock ETA countdown
        const timer = setInterval(() => {
            setEta(prev => (prev > 1 ? prev - 1 : 1));
        }, 60 * 1000);

        return () => {
            unsubscribe();
            clearInterval(timer);
        };
    }, [rideId, router, toast, driverProfile]);
    
    const handleOpenWhatsApp = () => {
     if (driverProfile?.phone) {
        window.open(`https://wa.me/${driverProfile.phone}`, '_blank');
    } else {
        toast({
            variant: "destructive",
            title: "Erro",
            description: "Número de telefone do motorista não encontrado.",
        });
    }
  };


    if (!rideData || !driverProfile) {
        return <div className="h-screen w-screen flex items-center justify-center">Carregando detalhes da corrida...</div>;
    }
    
    const getStatusInfo = () => {
        switch(rideData.status) {
            case 'accepted':
                return { title: 'Motorista a caminho', description: `Chega em ${eta} min.`, progress: 33 };
            case 'arrived':
                return { title: 'Motorista no local', description: 'Encontre seu motorista.', progress: 66 };
            case 'completed':
                 return { title: 'Viagem concluída', description: 'Obrigado por viajar conosco!', progress: 100 };
            default:
                 return { title: 'Aguardando motorista', description: '...', progress: 10 };
        }
    }
    
    const { title, description, progress } = getStatusInfo();

    return (
         <div className="h-screen w-screen relative flex flex-col bg-background">
            <div className="flex-1">
                 <Map showMovingCar />
            </div>

             <div className="absolute top-4 right-4 z-10">
                <Button variant="ghost" size="icon" className="bg-background/80 backdrop-blur-sm rounded-full h-12 w-12">
                    <Shield className="h-6 w-6"/>
                </Button>
            </div>

            <Card className="absolute bottom-4 left-4 right-4 z-10 rounded-2xl shadow-2xl">
                <CardContent className="p-4 space-y-4">
                     <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={driverProfile.photoUrl || undefined} data-ai-hint="person avatar" />
                                <AvatarFallback>{rideData.driverName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="text-xl font-bold">{rideData.driverName}</h3>
                                <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 text-yellow-400 fill-current"/>
                                    <p className="font-semibold">4.9</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-lg">{rideData.driverVehiclePlate}</p>
                            <p className="text-sm text-muted-foreground">{rideData.driverVehicleModel}</p>
                        </div>
                    </div>
                    
                    <div>
                         <div className="flex justify-between items-end mb-2">
                            <div>
                               <h4 className="text-lg font-bold">{title}</h4>
                               <p className="text-muted-foreground">{description}</p>
                            </div>
                            <div className="flex gap-2">
                                 <Button size="icon" variant="outline" className="rounded-full h-12 w-12" onClick={handleOpenWhatsApp}>
                                    <MessageSquare className="h-6 w-6"/>
                                </Button>
                                <a href={`tel:${driverProfile.phone}`}>
                                    <Button size="icon" variant="outline" className="rounded-full h-12 w-12">
                                        <Phone className="h-6 w-6"/>
                                    </Button>
                                </a>
                            </div>
                         </div>
                         <Progress value={progress} />
                    </div>

                    <Card className="bg-muted">
                        <CardContent className="p-3">
                             <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-red-500 mt-1"/>
                                 <div>
                                    <p className="text-xs text-muted-foreground">Destino</p>
                                    <p className="font-semibold">{rideData.destinationAddress}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </CardContent>
            </Card>
        </div>
    );
}

export default function OnRidePage() {
     return (
        <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-background">Carregando...</div>}>
            <OnRideComponent />
        </Suspense>
    );
}
