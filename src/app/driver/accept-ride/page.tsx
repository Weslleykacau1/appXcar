
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { withAuth } from "@/components/with-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import MapGL, { Marker, Source, Layer, LngLatLike } from 'react-map-gl';
import type {LineLayer} from 'react-map-gl';
import { useTheme } from 'next-themes';
import { User, Star, X, Check, MapPin, Zap } from "lucide-react";
import { useRouter } from 'next/navigation';
import { Progress } from "@/components/ui/progress";
import { getItem, removeItem, setItem } from "@/lib/storage";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";
import { useWakeLock } from "@/hooks/use-wake-lock";

interface RideRequest {
  id: string;
  fare: number;
  pickupAddress: string;
  destination: string;
  tripDistance: number;
  tripTime: number;
  rideCategory: string;
  passenger: {
    name: string;
    avatarUrl: string;
    rating: number;
    phone: string;
  },
  route: {
    pickup: { lat: number, lng: number };
    destination: { lat: number, lng: number };
    coordinates: LngLatLike[];
  }
}

const RIDE_REQUEST_KEY = 'pending_ride_request';
const CURRENT_RIDE_KEY = 'current_ride_data';
const NOTIFICATION_SOUND_URL = "https://cdn.pixabay.com/audio/2022/03/15/audio_2c4102c9a2.mp3";


function AcceptRidePage() {
  const { user: driver } = useAuth();
  const { resolvedTheme } = useTheme();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(15);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [rideData, setRideData] = useState<RideRequest | null>(null);

  useWakeLock();

  useEffect(() => {
    const request = getItem<RideRequest>(RIDE_REQUEST_KEY);
    if (!request) {
        // No ride request found, maybe the passenger cancelled.
        router.back();
    } else {
        setRideData(request);
    }
  }, [router]);

  const lineColor = resolvedTheme === 'dark' ? '#BB86FC' : '#6200EE';

  const routeLayer: LineLayer | null = rideData ? {
    id: 'route',
    type: 'line',
    source: 'route',
    layout: {
        'line-join': 'round',
        'line-cap': 'round'
    },
    paint: {
        'line-color': lineColor,
        'line-width': 4
    }
  } : null;

  const routeGeoJSON: GeoJSON.Feature<GeoJSON.LineString> | null = rideData ? {
    type: 'Feature',
    properties: {},
    geometry: {
        type: 'LineString',
        coordinates: rideData.route.coordinates
    }
} : null;

  const handleAcceptRide = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (!rideData || !driver) return;
    
    // Update ride status in Firestore
    const rideDocRef = doc(db, "rides", rideData.id);
    const driverProfileSnap = await getDoc(doc(db, "profiles", driver.id));
    const driverProfile = driverProfileSnap.data();
    
    const driverData = {
      driverId: driver.id,
      driverName: driver.name,
      status: 'accepted',
      driverVehicleModel: driverProfile?.vehicle_model || 'N/A',
      driverVehiclePlate: driverProfile?.vehicle_license_plate || 'N/A',
    }

    await updateDoc(rideDocRef, driverData);

    // Set ride data for the next page
    setItem(CURRENT_RIDE_KEY, {...rideData, ...driverData});
    removeItem(RIDE_REQUEST_KEY); // Clear the request
    router.push('/driver/on-ride');
  }

  const handleRejectRide = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    removeItem(RIDE_REQUEST_KEY); // Clear the request
    router.back();
  }, [router]);


  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
      audioRef.current.loop = true;
    }
    
    const playPromise = audioRef.current.play();

    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log("A reprodução automática foi bloqueada pelo navegador:", error);
      });
    }

    const showNotification = () => {
        if ('Notification' in window && Notification.permission === 'granted') {
            // NOTE: new Notification() is blocked in secure contexts (like this one)
            // without a Service Worker. Removing for now to prevent app crash.
            // A full implementation would require a service worker.
            /*
             new Notification('Nova Solicitação de Corrida', {
                body: 'Você tem uma nova solicitação de viagem.',
                icon: '/favicon.ico'
            });
            */
        }
    }
    
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
    }

    // Browser Notification API
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        showNotification();
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            showNotification();
          }
        });
      }
    }


    return () => {
        if(audioRef.current) {
            audioRef.current.pause();
        }
    }
  }, []);

  useEffect(() => {
    if (timeLeft === 0) {
      handleRejectRide();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, handleRejectRide]);

  const mapStyle = resolvedTheme === 'dark' 
    ? 'mapbox://styles/mapbox/dark-v11' 
    : 'mapbox://styles/mapbox/streets-v12';

  if (!mapboxToken || !rideData) {
    return (
      <div className="w-full h-screen bg-muted flex items-center justify-center">
        <p className="text-muted-foreground text-center p-4">
          Carregando dados da corrida...
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative">
      <MapGL
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          longitude: rideData.route.pickup.lng,
          latitude: rideData.route.pickup.lat,
          zoom: 13
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        interactive={false}
      >
        <Marker longitude={rideData.route.pickup.lng} latitude={rideData.route.pickup.lat}>
            <MapPin className="text-blue-500 h-8 w-8" fill="currentColor"/>
        </Marker>
         <Marker longitude={-38.5267} latitude={-3.7327} anchor="center">
             <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L3 22L12 18L21 22L12 2Z" fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="1" strokeLinejoin="round"/>
                </svg>
            </div>
        </Marker>
        
        {routeGeoJSON && routeLayer && (
            <Source id="route" type="geojson" data={routeGeoJSON}>
                <Layer {...routeLayer} />
            </Source>
        )}
      </MapGL>

        <div className="absolute top-4 right-4 z-10">
            <Button variant="ghost" size="icon" className="bg-background/80 backdrop-blur-sm rounded-full h-12 w-12" onClick={handleRejectRide}>
                <X className="h-6 w-6"/>
            </Button>
        </div>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <Card className="w-full max-w-lg mx-auto rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 bg-secondary text-secondary-foreground relative">
             <Progress value={(timeLeft / 15) * 100} className="absolute top-0 left-0 w-full h-1 rounded-none [&>div]:bg-green-400" />
             <div className="flex justify-between items-center">
                <div>
                  <Badge variant="destructive" className="bg-green-600/80 text-white border-none">
                    <Zap className="h-4 w-4 mr-1.5"/>
                    Alta demanda
                  </Badge>
                  <h2 className="text-4xl font-bold mt-1">R${rideData.fare.toFixed(2)}</h2>
                </div>
                <div className="text-right">
                    <p className="font-semibold">{rideData.tripDistance.toFixed(1)} km</p>
                    <p className="text-sm opacity-90">{rideData.tripTime} min</p>
                </div>
             </div>
          </div>
          <div className="p-4 bg-gray-800 text-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 truncate">
                <Avatar className="h-14 w-14 border-2 border-gray-600 shrink-0">
                    <AvatarImage src={rideData.passenger.avatarUrl || 'https://placehold.co/100x100.png'} data-ai-hint="person avatar" />
                    <AvatarFallback>{rideData.passenger.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="truncate">
                    <h3 className="text-lg font-bold truncate">{rideData.passenger.name}</h3>
                    <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400" fill="currentColor" />
                        <p className="font-semibold">{rideData.passenger.rating.toFixed(1)}</p>
                    </div>
                </div>
            </div>
          </div>
          <CardContent className="p-4 space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center mt-1">
                  <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-background"></div>
                  <div className="w-px h-6 bg-border my-1"></div>
                  <MapPin className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="font-medium">1.5 km de distância · <span className="text-muted-foreground">{rideData.pickupAddress}</span></p>
                  <p className="font-medium mt-2">{rideData.destination}</p>
                </div>
              </div>
              <Badge variant="outline" className="gap-2">
                    <User className="h-4 w-4"/>
                    <span className="capitalize">{rideData.rideCategory === 'comfort' ? 'Comfort' : rideData.rideCategory}</span>
              </Badge>
              <div className="flex items-center gap-3 pt-2">
                 <Button variant="ghost" className="h-14 text-base font-bold flex-1" onClick={handleRejectRide}>
                    Recusar
                </Button>
                <Button size="lg" className="h-14 text-lg font-bold flex-1" onClick={handleAcceptRide}>
                    Aceitar
                </Button>
              </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(AcceptRidePage, ["driver"]);
