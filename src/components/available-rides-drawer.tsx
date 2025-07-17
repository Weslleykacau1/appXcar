
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, DocumentData, Timestamp, updateDoc, doc, getDoc } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MapPin, User, Car, Clock, DollarSign, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { setItem } from '@/lib/storage';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';

interface RideRequest {
    id: string;
    passengerId: string;
    passengerName: string;
    passengerPhotoUrl?: string;
    driverId?: string; // Driver is not assigned yet
    driverName?: string;
    pickupAddress: string;
    destinationAddress: string;
    fare: number;
    status: string;
    category: string;
    createdAt: Date;
    paymentMethod: string;
    pickupCoords: { lat: number; lng: number };
    destinationCoords: { lat: number; lng: number };
    route?: {
        coordinates: string; // Stored as JSON string
        distance: number;
        duration: number;
    };
}

interface AvailableRidesDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const RIDE_REQUEST_KEY = 'pending_ride_request';
const CURRENT_RIDE_KEY = 'current_ride_data';

export function AvailableRidesDrawer({ open, onOpenChange }: AvailableRidesDrawerProps) {
    const { user: driver } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [rides, setRides] = useState<RideRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;

        setIsLoading(true);
        const q = query(collection(db, "rides"), where("status", "==", "pending"));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const rideRequests: RideRequest[] = [];
            querySnapshot.forEach((doc: DocumentData) => {
                const data = doc.data();
                rideRequests.push({
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                } as RideRequest);
            });
            setRides(rideRequests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching real-time rides:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [open]);

    const handleAcceptRide = async (ride: RideRequest) => {
        if (!driver) return;
        setAcceptingRideId(ride.id);

        try {
            const rideDocRef = doc(db, "rides", ride.id);
            // Get the driver's profile to add their details to the ride
            const driverProfileSnap = await getDoc(doc(db, "profiles", driver.id));
            const driverProfile = driverProfileSnap.data();

            await updateDoc(rideDocRef, {
                driverId: driver.id,
                driverName: driver.name,
                status: 'accepted',
                driverVehicleModel: driverProfile?.vehicle_model || 'N/A',
                driverVehiclePlate: driverProfile?.vehicle_license_plate || 'N/A',
            });

            const rideDataForDriver = {
                id: ride.id,
                fare: ride.fare,
                pickupAddress: ride.pickupAddress,
                destination: ride.destinationAddress,
                passenger: {
                    name: ride.passengerName,
                    avatarUrl: ride.passengerPhotoUrl || '',
                    rating: 4.8, // Should come from passenger profile
                    phone: '5511999999999', // Placeholder phone
                },
                route: {
                    pickup: { lat: ride.pickupCoords.lat, lng: ride.pickupCoords.lng },
                    destination: { lat: ride.destinationCoords.lat, lng: ride.destinationCoords.lng },
                    coordinates: ride.route?.coordinates || "[]" 
                }
            };
            
            setItem(CURRENT_RIDE_KEY, rideDataForDriver);

            toast({
                title: 'Corrida Aceita!',
                description: 'Navegando para os detalhes da corrida.',
            });
            
            onOpenChange(false);
            router.push('/driver/on-ride');

        } catch (error) {
            console.error("Error accepting ride:", error);
            toast({
                variant: 'destructive',
                title: 'Erro ao aceitar',
                description: 'A corrida pode não estar mais disponível. Tente outra.',
            });
        } finally {
            setAcceptingRideId(null);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:w-[540px] p-0">
                <SheetHeader className="p-6 border-b">
                    <SheetTitle>Corridas Disponíveis</SheetTitle>
                    <SheetDescription>
                        Visualize e aceite corridas pendentes.
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-80px)]">
                     <div className="p-6 space-y-4">
                        {isLoading ? (
                            <div className="flex justify-center items-center py-10">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : rides.length === 0 ? (
                            <p className="text-muted-foreground text-center py-10">Nenhuma corrida disponível no momento.</p>
                        ) : (
                            rides.map((ride) => (
                                <Card key={ride.id}>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 font-semibold">
                                                    <User className="h-4 w-4 text-primary" /> {ride.passengerName}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Car className="h-4 w-4" /> {ride.category}
                                                </div>
                                            </div>
                                             <div className="text-right">
                                                <p className="font-bold text-lg">{ride.fare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                 <Badge variant='outline'>{ride.paymentMethod}</Badge>
                                            </div>
                                        </div>
                                        <Separator/>
                                         <div className="space-y-2 text-sm">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 mt-1 text-green-500"/>
                                                <p><span className="font-semibold text-muted-foreground">De:</span> {ride.pickupAddress}</p>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 mt-1 text-red-500"/>
                                                 <p><span className="font-semibold text-muted-foreground">Para:</span> {ride.destinationAddress}</p>
                                            </div>
                                             <div className="flex items-start gap-2 text-muted-foreground">
                                                <Clock className="h-4 w-4 mt-1"/>
                                                <p>{ride.createdAt.toLocaleTimeString('pt-BR')}</p>
                                            </div>
                                        </div>
                                        <Button 
                                            className="w-full" 
                                            onClick={() => handleAcceptRide(ride)}
                                            disabled={acceptingRideId === ride.id}
                                        >
                                            {acceptingRideId === ride.id && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                            {acceptingRideId === ride.id ? 'Aceitando...' : 'Aceitar Corrida'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                     </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
