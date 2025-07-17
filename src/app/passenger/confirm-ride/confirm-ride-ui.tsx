
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Info, Plus } from "lucide-react";
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
} from "@/components/ui/sheet"


type RideCategory = "comfort" | "executive";

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

export function ConfirmRideUI() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapRef = useRef<MapRef>(null);

  const [pickupCoords, setPickupCoords] = useState<LngLatLike | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<LngLatLike | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<string>('');

  const [route, setRoute] = useState<any>(null);
  const [distance, setDistance] = useState(0); // in km
  const [duration, setDuration] = useState(0); // in minutes
  
  const [selectedCategory, setSelectedCategory] = useState<RideCategory>("comfort");
  const [fareConfig, setFareConfig] = useState<AppFareConfig>(defaultFareConfig);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);

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
    setDestinationAddress(destination.place_name);

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
            paymentMethod: 'Cartão', // Default for now
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


  return (
    <div className="h-screen w-screen relative flex flex-col bg-background">
      <header className="absolute top-0 left-0 right-0 z-10 p-4">
        <Button variant="ghost" size="icon" className="bg-background rounded-full shadow-md" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </header>
      
      <div className="flex-1">
        <Map mapRef={mapRef} pickup={pickupCoords as LngLatLike} destination={destinationCoords as LngLatLike} route={route} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl p-4 space-y-4">
         <div className="w-full overflow-x-auto pb-2">
            <div className="flex gap-3">
              {isLoadingRoute ? (
                 <>
                  <Skeleton className="h-24 w-48 rounded-lg" />
                  <Skeleton className="h-24 w-48 rounded-lg" />
                 </>
              ) : (
                <>
                <div 
                    className={cn(
                        "p-3 rounded-lg border-2 min-w-48 text-left transition-all",
                        selectedCategory === 'comfort' ? 'border-primary bg-primary/10' : 'border-border bg-muted/50'
                    )}
                    onClick={() => setSelectedCategory('comfort')}
                >
                    <Image src={viagemCarImage} alt="Comfort Car" width={75} height={36} className="mb-2"/>
                    <p className="font-bold">Comfort</p>
                    <p className="font-bold text-primary">{calculateFare('comfort').toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                    <p className="text-xs text-muted-foreground">~{Math.ceil(duration)} min</p>
                </div>
                 <div 
                    className={cn(
                        "p-3 rounded-lg border-2 min-w-48 text-left transition-all",
                         selectedCategory === 'executive' ? 'border-primary bg-primary/10' : 'border-border bg-muted/50'
                    )}
                    onClick={() => setSelectedCategory('executive')}
                >
                    <Image src={executiveCarImage} alt="Executive Car" width={75} height={36} className="mb-2"/>
                    <p className="font-bold">Executivo</p>
                    <p className="font-bold text-primary">{calculateFare('executive').toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                    <p className="text-xs text-muted-foreground">~{Math.ceil(duration)} min</p>
                </div>
                </>
              )}
            </div>
         </div>
         
         <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                    <Plus className="h-4 w-4 mr-2"/>
                    Adicionar observação para o motorista
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                <SheetTitle>Observações para o motorista</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                    <Input placeholder="Ex: Estou com malas grandes" />
                </div>
            </SheetContent>
        </Sheet>
         
         <Button 
            className="w-full h-12 text-lg font-bold bg-secondary hover:bg-secondary/90" 
            disabled={isRequesting || isLoadingRoute}
            onClick={handleRequestRide}
        >
           {isRequesting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
           Confirmar e solicitar
         </Button>
      </div>
    </div>
  );
}
