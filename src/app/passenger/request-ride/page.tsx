
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { withAuth } from "@/components/with-auth";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, LocateFixed, Menu, Loader2, Star, X, ShieldCheck, Search, Pencil, Settings2, Car, ArrowLeft, CreditCard, Landmark, ChevronDown, Users, Home, Briefcase, Zap, History, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Map } from "@/components/map";
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';
import type { MapRef, LngLatLike } from "react-map-gl";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { setItem, getItem, removeItem } from "@/lib/storage";
import { Label } from "@/components/ui/label";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit, addDoc, serverTimestamp, doc, updateDoc, getDoc, onSnapshot, orderBy } from "firebase/firestore";
import Image from "next/image";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import { viagemCarImage, executiveCarImage } from "@/lib/images";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";


type RideCategory = "comfort" | "executive";
type PaymentMethod = "Cartão" | "PIX" | "Dinheiro";
type AddressType = 'home' | 'work';


interface FoundDriver {
    id: string;
    name: string;
    avatarUrl: string;
    rating: number;
    vehicle: {
        model: string;
        licensePlate: string;
    };
    eta: number;
}

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


const RIDE_REQUEST_KEY = 'passenger_current_ride';
const RERIDE_REQUEST_KEY = 'reride_request';
const ADMIN_FARES_CONFIG_KEY = 'admin_fares_config';
const PRESELECTED_DESTINATION_KEY = 'preselected_destination';
const SURGE_MULTIPLIER = 1.3;


const defaultFareConfig: AppFareConfig = {
    comfort: {
        baseFare: 3.50,
        costPerMinute: 0.45,
        costPerKm: 1.50,
        bookingFee: 2.00
    },
    executive: {
        baseFare: 2.50,
        costPerMinute: 0.30,
        costPerKm: 1.20,
        bookingFee: 2.00
    }
}

interface RecentRide {
    id: string;
    destinationAddress: string;
    createdAt: Date;
}


function RequestRidePage() {
  const { user, fetchUserProfile } = useAuth();
  const router = useRouter();
  
  const mapRef = useRef<MapRef>(null);
  
  const [destinationInput, setDestinationInput] = useState("");
  const [destinationSuggestions, setDestinationSuggestions] = useState<Suggestion[]>([]);
  
  const [isPlanningTrip, setIsPlanningTrip] = useState(false);


  const [recentRides, setRecentRides] = useState<RecentRide[]>([]);

  const { toast } = useToast();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  const [homeAddress, setHomeAddress] = useState<string | null>(null);
  const [workAddress, setWorkAddress] = useState<string | null>(null);


  const geocodeAddress = useCallback(async (address: string): Promise<Suggestion | null> => {
    if (!mapboxToken) return null;
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1&country=BR&language=pt`);
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      return data.features[0];
    }
    return null;
  }, [mapboxToken]);

   useEffect(() => {
    const loadUserData = async () => {
        if (!user) return;
        const userProfile = await fetchUserProfile(user);
        if (userProfile) {
            setHomeAddress(userProfile.homeAddress || null);
            setWorkAddress(userProfile.workAddress || null);
        }

        const ridesRef = collection(db, "rides");
        const q = query(
            ridesRef, 
            where("passengerId", "==", user.id),
            where("status", "==", "completed"),
            orderBy("createdAt", "desc"),
            limit(3)
        );
        const querySnapshot = await getDocs(q);
        const history: RecentRide[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                destinationAddress: data.destinationAddress,
                createdAt: data.createdAt.toDate(),
            };
        });
        setRecentRides(history);
    };
    loadUserData();
   }, [user, fetchUserProfile]);


  const debounce = (func: Function, delay: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), delay);
    };
  };

  const fetchSuggestions = async (query: string) => {
    if (query.length < 3 || !mapboxToken) {
      setDestinationSuggestions([]);
      return;
    }
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&autocomplete=true&country=BR&language=pt&proximity=-38.5267,-3.7327`);
    const data = await response.json();
    setDestinationSuggestions(data.features);
  };
  
  const debouncedFetchDestinationSuggestions = useCallback(debounce((query: string) => fetchSuggestions(query), 300), []);
  
  const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDestinationInput(value);
    debouncedFetchDestinationSuggestions(value);
  };

  const handleSelectSuggestion = (suggestion: Suggestion | string) => {
      const isString = typeof suggestion === 'string';
      const address = isString ? suggestion : suggestion.place_name;
      
      if (isString) {
          geocodeAddress(address).then(geoSuggestion => {
              if (geoSuggestion) {
                  setItem(PRESELECTED_DESTINATION_KEY, geoSuggestion);
                  router.push('/passenger/confirm-ride');
              }
          })
      } else {
         setItem(PRESELECTED_DESTINATION_KEY, suggestion);
         router.push('/passenger/confirm-ride');
      }
  };
  
  const handleOpenTripPlanner = () => {
    setIsPlanningTrip(true);
    setDestinationInput("");
    setDestinationSuggestions([]);
  }


  if (!user) return null;

  const firstName = user.name.split(' ')[0];


  if (isPlanningTrip) {
    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            <header className="flex items-center p-4">
                 <Button variant="ghost" size="icon" onClick={() => setIsPlanningTrip(false)}>
                    <X className="h-6 w-6" />
                </Button>
                <h1 className="text-xl font-bold mx-auto">Viagem</h1>
                <div className="w-8"></div>
            </header>
            <main className="flex-1 px-4 space-y-4">
                <Card className="bg-card">
                    <CardContent className="p-4 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center mt-1">
                               <div className="w-3 h-3 rounded-full border-2 border-primary"></div>
                               <div className="w-px h-10 bg-border my-1"></div>
                               <div className="w-3 h-3 rounded-full border-2 border-destructive"></div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Início</Label>
                                    <p className="font-semibold">Localidade atual</p>
                                </div>
                                <Separator/>
                                 <div className="relative space-y-1">
                                    <Label className="text-xs text-muted-foreground">Destino</Label>
                                    <Input
                                        id="destination-planner"
                                        placeholder="Para onde?"
                                        className="border-none p-0 h-auto font-semibold focus-visible:ring-0"
                                        required
                                        value={destinationInput}
                                        onChange={handleDestinationChange}
                                        autoComplete="off"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                 {destinationSuggestions.length === 0 ? (
                    <>
                        <button className="w-full flex items-center gap-4 text-left p-3 -ml-3 rounded-lg hover:bg-muted" onClick={() => homeAddress && handleSelectSuggestion(homeAddress)}>
                            <div className="p-3 bg-muted rounded-full">
                                <Home className="h-5 w-5 text-muted-foreground"/>
                            </div>
                            <p className="font-semibold">Casa</p>
                        </button>
                        <button className="w-full flex items-center gap-4 text-left p-3 -ml-3 rounded-lg hover:bg-muted" onClick={() => workAddress && handleSelectSuggestion(workAddress)}>
                            <div className="p-3 bg-muted rounded-full">
                                <Briefcase className="h-5 w-5 text-muted-foreground"/>
                            </div>
                            <p className="font-semibold">Trabalho</p>
                        </button>
                    </>
                 ) : (
                    <div className="space-y-1">
                        {destinationSuggestions.map((suggestion) => (
                             <button key={suggestion.id} className="w-full flex items-center gap-4 text-left p-3 -ml-3 rounded-lg hover:bg-muted" onClick={() => handleSelectSuggestion(suggestion)}>
                               <div className="p-3 bg-muted rounded-full">
                                 <MapPin className="h-5 w-5 text-muted-foreground"/>
                               </div>
                               <div>
                                <p className="font-semibold">{suggestion.text}</p>
                                <p className="text-sm text-muted-foreground">{suggestion.place_name.replace(`${suggestion.text}, `, '')}</p>
                               </div>
                             </button>
                        ))}
                    </div>
                 )}

            </main>
        </div>
    )
  }


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
        <main className="flex-1 p-4 space-y-6 pb-24">
            <h1 className="text-3xl font-bold">Olá, {firstName}</h1>
            
            <div className="relative flex items-center cursor-pointer" onClick={handleOpenTripPlanner}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <div
                    id="destination"
                    className="pl-12 pr-4 h-14 w-full flex items-center text-base rounded-full bg-muted border-none"
                >
                    <span className="text-muted-foreground">Para onde você vai?</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <Button variant="secondary" className="h-14 rounded-full justify-start px-5" onClick={() => homeAddress && handleSelectSuggestion(homeAddress)}>
                    <Home className="mr-3"/>
                    <span className="font-semibold">Casa</span>
                </Button>
                 <Button variant="secondary" className="h-14 rounded-full justify-start px-5" onClick={() => workAddress && handleSelectSuggestion(workAddress)}>
                    <Briefcase className="mr-3"/>
                    <span className="font-semibold">Trabalho</span>
                </Button>
            </div>
            
            <Separator />
            
            <div>
                 <h2 className="text-lg font-semibold mb-3">Viagens recentes</h2>
                 <div className="space-y-2">
                    {recentRides.map(ride => (
                        <button key={ride.id} className="w-full flex items-center gap-4 text-left p-2 -ml-2 rounded-lg hover:bg-muted" onClick={() => handleSelectSuggestion(ride.destinationAddress)}>
                           <div className="p-3 bg-muted rounded-full">
                             <History className="h-5 w-5 text-muted-foreground"/>
                           </div>
                           <div>
                            <p className="font-semibold">{ride.destinationAddress.split(',')[0]}</p>
                            <p className="text-sm text-muted-foreground">
                                {ride.createdAt.toLocaleDateString('pt-BR', { weekday: 'long' })}
                            </p>
                           </div>
                        </button>
                    ))}
                 </div>
            </div>

            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    <div className="p-4">
                         <h2 className="font-semibold">Você está aqui</h2>
                    </div>
                     <div className="h-48 w-full">
                        <Map mapRef={mapRef}/>
                    </div>
                </CardContent>
            </Card>

        </main>
        <BottomNavBar role="passenger" />
    </div>
  );
}

export default withAuth(RequestRidePage, ["passenger"]);
