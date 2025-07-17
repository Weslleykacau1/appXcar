
"use client";

import { useEffect, useState, useRef } from "react";
import { withAuth } from "@/components/with-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MapGL, { Marker, Source, Layer, LngLatLike, MapRef } from 'react-map-gl';
import type {LineLayer} from 'react-map-gl';
import { useTheme } from 'next-themes';
import { MapPin, Phone, Flag, Star, MessageSquare, Shield, Circle, Navigation } from "lucide-react";
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { setItem, getItem, removeItem } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";


interface RideData {
  id: string; // Firestore document ID
  fare: number;
  passenger: {
    name: string;
    avatarUrl: string;
    rating: number;
    phone: string;
  };
  pickupAddress: string;
  destination: string;
  stops: { lat: number; lng: number, address: string }[];
  route: {
    pickup: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    coordinates: LngLatLike[];
  };
  driverVehicleModel: string;
  driverVehiclePlate: string;
}

const mockDriverLocation = { lat: -3.7327, lng: -38.5267 };
const CURRENT_RIDE_KEY = 'current_ride_data';

type RidePhase = 'to_pickup' | 'arrived_at_pickup' | 'to_destination';

function OnRidePage() {
  const { resolvedTheme } = useTheme();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const [rideData, setRideData] = useState<RideData | null>(null);
  const [ridePhase, setRidePhase] = useState<RidePhase>('to_pickup');
  const [eta, setEta] = useState(5); // Mock ETA in minutes
  const { toast } = useToast();

  useEffect(() => {
    const data = getItem<RideData>(CURRENT_RIDE_KEY);
    if (data) {
        setRideData(data);
    } else {
        router.push('/driver'); // No ride data, go back to dash
    }
  }, [router]);

  useEffect(() => {
      if (!rideData?.id) return;

      const unsubscribe = onSnapshot(doc(db, "rides", rideData.id), (docSnap) => {
          const data = docSnap.data();
          if (data?.status === 'cancelled') {
              toast({
                  variant: 'destructive',
                  title: 'Corrida Cancelada',
                  description: 'O passageiro cancelou a corrida.',
                  duration: 5000,
              });
              removeItem(CURRENT_RIDE_KEY);
              router.replace('/driver');
          }
      });
      
        // Mock ETA countdown
        const timer = setInterval(() => {
            setEta(prev => (prev > 1 ? prev - 1 : 1));
        }, 60 * 1000);

      return () => {
          unsubscribe();
          clearInterval(timer);
      }
  }, [rideData, router, toast]);

  const routeLayer: LineLayer | null = rideData ? {
    id: 'route',
    type: 'line',
    source: 'route',
    layout: {
        'line-join': 'round',
        'line-cap': 'round'
    },
    paint: {
        'line-color': resolvedTheme === 'dark' ? '#FFFFFF' : '#000000',
        'line-width': 5
    }
  } : null;

  const routeGeoJSON: GeoJSON.Feature<GeoJSON.LineString> | null = rideData ? {
      type: 'Feature',
      properties: {},
      geometry: {
          type: 'LineString',
          coordinates: ridePhase === 'to_pickup'
            ? [mockDriverLocation, rideData.route.pickup].map(p => [p.lng, p.lat]) as LngLatLike[]
            : rideData.route.coordinates
      }
  } : null;

  const mapStyle = resolvedTheme === 'dark' 
    ? 'mapbox://styles/mapbox/dark-v11' 
    : 'mapbox://styles/mapbox/streets-v12';
  
    const handleOpenWhatsApp = () => {
     if (rideData?.passenger.phone) {
        window.open(`https://wa.me/${rideData.passenger.phone}`, '_blank');
    } else {
        toast({
            variant: "destructive",
            title: "Erro",
            description: "Número de telefone do passageiro não encontrado.",
        });
    }
  };
  
  const handleArrivedAtPickup = async () => {
    if (!rideData) return;
    try {
        const rideDocRef = doc(db, "rides", rideData.id);
        await updateDoc(rideDocRef, { status: 'arrived' });
        setRidePhase('arrived_at_pickup');
        toast({
            title: "Você chegou!",
            description: "Aguardando o passageiro.",
        });
    } catch (error) {
        console.error("Error setting arrived status:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o status.' });
    }
  }


  const handleStartRide = async () => {
    if (!rideData) return;

    try {
        const rideDocRef = doc(db, "rides", rideData.id);
        await updateDoc(rideDocRef, { status: 'in_progress' });

        setRidePhase('to_destination');
        if (mapRef.current && rideData) {
            mapRef.current.fitBounds(
                [rideData.route.pickup, rideData.route.destination].map(p => [p.lng, p.lat]) as [LngLatLike, LngLatLike],
                { padding: 80, duration: 1000 }
            );
        }
        toast({
          title: "Viagem iniciada!",
          description: "Boa viagem até o destino final.",
        });
    } catch (error) {
        console.error("Error starting ride:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível iniciar a corrida.' });
    }
  };

  const handleFinishRide = async () => {
    if (!rideData) return;
    try {
        const rideDocRef = doc(db, "rides", rideData.id);
        await updateDoc(rideDocRef, { status: 'completed' });

        const currentEarnings = parseFloat(sessionStorage.getItem('today_earnings') || '0');
        const newEarnings = currentEarnings + rideData.fare;
        sessionStorage.setItem('today_earnings', newEarnings.toString());
        
        const currentRides = parseInt(sessionStorage.getItem('today_rides') || '0', 10);
        const newRides = currentRides + 1;
        sessionStorage.setItem('today_rides', newRides.toString());

        setItem('ride_to_rate_data', rideData);
        removeItem(CURRENT_RIDE_KEY);
        router.push('/driver/rate-passenger');
    } catch (error) {
        console.error("Error finishing ride:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível finalizar a corrida.' });
    }
  };

  const handleNavigate = (app: 'waze' | 'google') => {
    if (!rideData) return;
    
    let destinationCoords;
    if (ridePhase === 'to_pickup') {
      destinationCoords = rideData.route.pickup;
    } else {
      // Find the next destination (first stop or final destination)
      const nextStop = rideData.stops?.[0]; // This needs to be improved to track which stop is next
      destinationCoords = nextStop || rideData.route.destination;
    }
    
    const lat = destinationCoords.lat;
    const lng = destinationCoords.lng;

    let url = '';
    if (app === 'waze') {
      url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    } else if (app === 'google') {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }

    if (url) {
      window.open(url, '_blank');
    }
  };

  if (!mapboxToken || !rideData) {
    return (
      <div className="w-full h-screen bg-muted flex items-center justify-center">
        <p className="text-muted-foreground text-center p-4">
          Carregando dados...
        </p>
      </div>
    );
  }
  
  const getStatusInfo = () => {
    switch(ridePhase) {
        case 'to_pickup':
            return { title: 'Motorista a caminho', description: `Chega em ${eta} min.`, progress: 33 };
        case 'arrived_at_pickup':
            return { title: 'Passageiro aguardando', description: 'Encontre o passageiro no local.', progress: 50 };
        case 'to_destination':
            return { title: 'Viagem em andamento', description: 'Siga para o destino final.', progress: 66 };
        default:
             return { title: 'Aguardando...', description: '...', progress: 10 };
    }
  }

  const { title, description, progress } = getStatusInfo();

  return (
    <div className="h-screen w-screen relative">
      <MapGL
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          longitude: mockDriverLocation.lng,
          latitude: mockDriverLocation.lat,
          zoom: 13
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        interactive={true}
      >
        <Marker longitude={mockDriverLocation.lng} latitude={mockDriverLocation.lat} anchor="center">
            <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-lg">
                 <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 3L4 29L16 24L28 29L16 3Z" fill="hsl(var(--primary))"/>
                </svg>
            </div>
        </Marker>
        <Marker longitude={rideData.route.pickup.lng} latitude={rideData.route.pickup.lat}>
            <MapPin className="text-blue-500 h-10 w-10" fill="currentColor"/>
        </Marker>
        
         {rideData.stops && rideData.stops.map((stop, index) => (
          <Marker key={`stop-${index}`} longitude={stop.lng} latitude={stop.lat}>
            <div className="bg-background rounded-full p-1 shadow-md">
                <Circle className="text-orange-500 h-5 w-5" fill="currentColor"/>
            </div>
          </Marker>
        ))}

        <Marker longitude={rideData.route.destination.lng} latitude={rideData.route.destination.lat}>
            <Flag className="text-green-500 h-10 w-10" fill="currentColor"/>
        </Marker>
        
        {routeGeoJSON && routeLayer && (
            <Source id="route" type="geojson" data={routeGeoJSON}>
                <Layer {...routeLayer} />
            </Source>
        )}
      </MapGL>
      
      <div className="absolute top-4 right-4 z-10">
            <Button variant="ghost" size="icon" className="bg-background/80 backdrop-blur-sm rounded-full h-12 w-12">
                <Shield className="h-6 w-6"/>
            </Button>
       </div>


      <div className="absolute bottom-0 left-0 right-0 p-4">
        <Card className="w-full max-w-lg mx-auto rounded-2xl shadow-2xl overflow-hidden">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={rideData.passenger.avatarUrl || undefined} data-ai-hint="person avatar" />
                        <AvatarFallback>{rideData.passenger.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="text-xl font-bold">{rideData.passenger.name}</h3>
                        <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current"/>
                            <p className="font-semibold">{rideData.passenger.rating.toFixed(1)}</p>
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
                        <a href={`tel:${rideData.passenger.phone}`}>
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
                    <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center mt-1">
                           <MapPin className="h-5 w-5 text-blue-500" />
                           {rideData.stops && rideData.stops.length > 0 && (
                                <Separator orientation="vertical" className="h-6 my-1 bg-border" />
                           )}
                           {rideData.stops && rideData.stops.map((_, index) => (
                               <div key={`stop-icon-${index}`} className="flex flex-col items-center">
                                 <Circle className="h-4 w-4 text-orange-500" />
                                 <Separator orientation="vertical" className="h-6 my-1 bg-border" />
                               </div>
                           ))}
                           <Flag className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div>
                                <p className="text-xs text-muted-foreground">Partida</p>
                                <p className="font-semibold leading-tight">{rideData.pickupAddress}</p>
                            </div>
                             {rideData.stops && rideData.stops.map((stop, index) => (
                                 <div key={`stop-addr-${index}`}>
                                    <Separator className="my-2"/>
                                    <p className="text-xs text-muted-foreground">Parada {index + 1}</p>
                                    <p className="font-semibold leading-tight">{stop.address}</p>
                                 </div>
                             ))}
                            <Separator className="my-2"/>
                            <div>
                                <p className="text-xs text-muted-foreground">Destino</p>
                                <p className="font-semibold leading-tight">{rideData.destination}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => handleNavigate('waze')}>
                <Navigation className="mr-2 h-4 w-4" />
                Waze
              </Button>
              <Button variant="outline" onClick={() => handleNavigate('google')}>
                <Navigation className="mr-2 h-4 w-4" />
                Maps
              </Button>
            </div>

             {ridePhase === 'to_pickup' && (
                <Button onClick={handleArrivedAtPickup} className="w-full h-12 text-base">
                    Cheguei ao local de partida
                </Button>
            )}

            {ridePhase === 'arrived_at_pickup' && (
                 <Button onClick={handleStartRide} className="w-full h-12 text-base">
                    Iniciar Corrida
                </Button>
            )}

            {ridePhase === 'to_destination' && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full h-12 text-base">
                            Finalizar Corrida
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Recebimento</AlertDialogTitle>
                            <AlertDialogDescription>
                                Você recebeu o valor de <strong>{rideData.fare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> do passageiro?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleFinishRide}>
                                Finalizar corrida e avaliar passageiro
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(OnRidePage, ["driver"]);
