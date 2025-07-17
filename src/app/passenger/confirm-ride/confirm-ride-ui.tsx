
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Info, Users, Briefcase, Landmark, CreditCard, Wallet, ChevronDown, Clock, Check } from "lucide-react";
import { useRouter } from 'next/navigation';
import type { MapRef, LngLatLike } from "react-map-gl";
import { useToast } from "@/hooks/use-toast";
import { getItem, removeItem, setItem } from "@/lib/storage";
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, onSnapshot, getDoc } from "firebase/firestore";
import { Map } from "@/components/map";
import { executiveCarImage, viagemCarImage } from "@/lib/images";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"


type RideCategory = "comfort" | "executive";
type PaymentMethod = "Cartão" | "PIX" | "Dinheiro";


const PRESELECTED_DESTINATION_KEY = 'preselected_destination';
const ADMIN_FARES_CONFIG_KEY = 'admin_fares_config';
const PASSENGER_CURRENT_RIDE = 'passenger_current_ride';
const SURGE_MULTIPLIER = 1.3;

interface Suggestion {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
}

interface FareConfig {
    baseFare: number;
    costPerMinute: number;
    costPerKm: number;
    bookingFee: number;
}

interface AppFareConfig {
    comfort: FareConfig;
    executive: FareConfig;
}

const defaultFareConfig: AppFareConfig = {
    comfort: { baseFare: 3.50, costPerMinute: 0.45, costPerKm: 1.50, bookingFee: 2.00 },
    executive: { baseFare: 2.50, costPerMinute: 0.30, costPerKm: 1.20, bookingFee: 2.00 }
};

const paymentIcons: { [key in PaymentMethod]: React.ReactNode } = {
  'Cartão': <CreditCard className="h-6 w-6" />,
  'PIX': <Landmark className="h-6 w-6" />,
  'Dinheiro': <Wallet className="h-6 w-6" />,
};


export function ConfirmRideUI() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const mapRef = useRef<MapRef>(null);

  const [pickupCoords, setPickupCoords] = useState<LngLatLike | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<LngLatLike | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [pickupAddress, setPickupAddress] = useState<string>('Localidade atual');


  const [route, setRoute] = useState<any>(null);
  const [distance, setDistance] = useState(0); // in km
  const [duration, setDuration] = useState(0); // in minutes
  
  const [selectedCategory, setSelectedCategory] = useState<RideCategory>("comfort");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [fareConfig, setFareConfig] = useState<AppFareConfig>(defaultFareConfig);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);


  useEffect(() => {
    // Get stored fare config from admin
    const storedFares = getItem<AppFareConfig>(ADMIN_FARES_CONFIG_KEY);
    if (storedFares) {
        // Convert string values to numbers
        const numericFares = Object.entries(storedFares).reduce((acc, [category, config]) => {
            acc[category as RideCategory] = Object.entries(config).reduce((cfg, [key, value]) => {
                cfg[key as keyof FareConfig] = parseFloat(value as string);
                return cfg;
            }, {} as FareConfig);
            return acc;
        }, {} as AppFareConfig);
        setFareConfig(numericFares);
    }
    
    // Get destination from storage
    const destination = getItem<Suggestion>(PRESELECTED_DESTINATION_KEY);
    if (!destination) {
      toast({ variant: 'destructive', title: 'Destino não encontrado', description: 'Por favor, selecione um destino novamente.' });
      router.push('/passenger/request-ride');
      return;
    }
    setDestinationCoords(destination.center);
    setDestinationAddress(destination.place_name.split(',')[0]);

    // Get user's current location for pickup
    navigator.geolocation.getCurrentPosition(
      (position) => setPickupCoords([position.coords.longitude, position.coords.latitude]),
      () => {
        toast({ variant: 'destructive', title: 'Localização necessária', description: 'Por favor, habilite a localização para solicitar uma corrida.' });
        router.push('/passenger/request-ride');
      }
    );
  }, [router, toast]);

  const calculateFare = (category: RideCategory) => {
    if (!distance || !duration) return 0;
    const config = fareConfig[category];
    const isSurge = Math.random() < 0.2; // 20% chance of surge pricing
    const multiplier = isSurge ? SURGE_MULTIPLIER : 1;
    const fare = (config.baseFare + (duration * config.costPerMinute) + (distance * config.costPerKm) + config.bookingFee) * multiplier;
    return fare;
  };

  const getRoute = useCallback(async () => {
    if (!pickupCoords || !destinationCoords || !mapboxToken) return;

    setIsLoadingRoute(true);
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupCoords[0]},${pickupCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?steps=true&geometries=geojson&access_token=${mapboxToken}`
    );
    const data = await response.json();
    if (data.routes && data.routes[0]) {
      const routeData = data.routes[0];
      setRoute(routeData.geometry.coordinates);
      setDistance(routeData.distance / 1000); // meters to km
      setDuration(routeData.duration / 60); // seconds to minutes
      
      const bounds: [LngLatLike, LngLatLike] = [
          pickupCoords,
          destinationCoords
      ];
      mapRef.current?.fitBounds(bounds, { padding: 80, duration: 1000 });
    }
    setIsLoadingRoute(false);
  }, [pickupCoords, destinationCoords, mapboxToken]);

  useEffect(() => {
    getRoute();
  }, [getRoute]);

  const handleRequestRide = async () => {
    if (!user || !pickupCoords || !destinationCoords || !route) return;

    setIsRequesting(true);
    try {
        const fare = calculateFare(selectedCategory);
        const rideRequest = {
            passengerId: user.id,
            passengerName: user.name,
            passengerPhotoUrl: user.photoUrl || '',
            pickupAddress: "Minha Localização Atual", // This should be geocoded in a real app
            destinationAddress: destinationAddress,
            pickupCoords: { lat: pickupCoords[1], lng: pickupCoords[0] },
            destinationCoords: { lat: destinationCoords[1], lng: destinationCoords[0] },
            fare: fare,
            category: selectedCategory,
            status: 'pending',
            createdAt: serverTimestamp(),
            paymentMethod: paymentMethod,
            route: {
              coordinates: route,
              distance: distance,
              duration: duration
            }
        };

        const rideDocRef = await addDoc(collection(db, "rides"), rideRequest);
        setItem(PASSENGER_CURRENT_RIDE, { rideId: rideDocRef.id });

        toast({ title: 'Procurando motorista...', description: 'Aguarde enquanto encontramos um motorista para você.' });
        router.push(`/passenger/finding-driver?rideId=${rideDocRef.id}`);

    } catch (error) {
        console.error("Error requesting ride: ", error);
        toast({ variant: 'destructive', title: 'Erro ao solicitar corrida', description: 'Tente novamente.' });
    } finally {
        setIsRequesting(false);
    }
  };

  const handleSelectPayment = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setIsPaymentSheetOpen(false);
  }


  return (
    <div className="h-screen w-screen relative flex flex-col bg-background">
      <header className="absolute top-0 left-0 right-0 z-10 p-4">
         <div className="bg-background/80 backdrop-blur-sm rounded-lg shadow-md flex items-center p-2 gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
             <div className="flex-1 text-center font-semibold truncate">{pickupAddress}</div>
             <p>→</p>
             <div className="flex-1 text-center font-semibold truncate">{destinationAddress}</div>
             {duration > 0 ? (
                <div className="bg-primary/20 text-primary font-semibold text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Clock className="h-3 w-3"/>
                    {Math.ceil(duration)} min
                </div>
             ) : <Skeleton className="h-6 w-16 rounded-full" />}
         </div>
      </header>
      
      <div className="flex-1">
        <Map mapRef={mapRef} pickup={pickupCoords as LngLatLike} destination={destinationCoords as LngLatLike} route={route} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl p-4 space-y-4">
          <div className="space-y-3">
             {isLoadingRoute ? (
                 <>
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                 </>
              ) : (
                <>
                 <div
                    onClick={() => setSelectedCategory('comfort')}
                    className={cn(
                        "p-4 rounded-lg border-2 flex items-center gap-4 transition-all cursor-pointer",
                        selectedCategory === 'comfort' ? 'border-primary bg-primary/10' : 'border-border'
                    )}
                 >
                    <Image src={viagemCarImage} alt="Comfort Car" width={100} height={50} className="rounded-md object-contain"/>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">Comfort</h3>
                            <Users className="h-4 w-4 text-muted-foreground"/>
                            <span className="text-sm text-muted-foreground">4</span>
                        </div>
                        <p className="text-sm text-muted-foreground">em {Math.ceil(duration * 0.8)} min</p>
                    </div>
                    <p className="text-lg font-bold">{calculateFare('comfort').toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                 </div>

                 <div
                    onClick={() => setSelectedCategory('executive')}
                    className={cn(
                        "p-4 rounded-lg border-2 flex items-center gap-4 transition-all cursor-pointer",
                        selectedCategory === 'executive' ? 'border-primary bg-primary/10' : 'border-border'
                    )}
                 >
                    <Image src={executiveCarImage} alt="Executive Car" width={100} height={50} className="rounded-md object-contain"/>
                     <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">Executivo</h3>
                            <Users className="h-4 w-4 text-muted-foreground"/>
                            <span className="text-sm text-muted-foreground">4</span>
                        </div>
                        <p className="text-sm text-muted-foreground">em {Math.ceil(duration * 0.6)} min</p>
                    </div>
                    <p className="text-lg font-bold">{calculateFare('executive').toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                 </div>
                </>
              )}
          </div>
         
         <div className="flex items-center gap-4">
             <Sheet open={isPaymentSheetOpen} onOpenChange={setIsPaymentSheetOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" className="p-0 h-auto gap-2">
                        {React.cloneElement(paymentIcons[paymentMethod] as React.ReactElement, { className: 'h-4 w-4' })}
                        <span className="font-semibold">{paymentMethod}</span>
                        <ChevronDown className="h-4 w-4 opacity-50"/>
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl">
                    <SheetHeader>
                        <SheetTitle className="text-center">Forma de Pagamento</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 space-y-3">
                        {(Object.keys(paymentIcons) as PaymentMethod[]).map((method) => (
                             <button
                                key={method}
                                onClick={() => handleSelectPayment(method)}
                                className="w-full p-4 rounded-lg border-2 flex items-center justify-between gap-4 transition-all cursor-pointer hover:bg-muted"
                            >
                                <div className="flex items-center gap-4">
                                    {paymentIcons[method]}
                                    <span className="font-semibold text-lg">{method}</span>
                                </div>
                                {paymentMethod === method && <Check className="h-5 w-5 text-primary" />}
                            </button>
                        ))}
                    </div>
                </SheetContent>
             </Sheet>

            <Button 
                className="w-full h-12 text-lg font-bold bg-secondary hover:bg-secondary/90" 
                disabled={isRequesting || isLoadingRoute}
                onClick={handleRequestRide}
            >
               {isRequesting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 
                `Selecionar ${selectedCategory === 'comfort' ? 'Comfort' : 'Executivo'}`
               }
            </Button>
         </div>
      </div>
    </div>
  );
}
