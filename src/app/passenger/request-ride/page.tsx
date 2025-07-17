
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { withAuth } from "@/components/with-auth";
import { useAuth, User } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, LocateFixed, Menu, Loader2, Star, X, ShieldCheck, Search, Pencil, Settings2, Car, ArrowLeft, CreditCard, Landmark, ChevronDown, Users, Home, Briefcase, Zap, History, Plus, Wallet, Circle } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";


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


const PRESELECTED_TRIP_KEY = 'preselected_trip';

interface RecentRide {
    id: string;
    destinationAddress: string;
    createdAt: Date;
    status: 'completed' | 'cancelled';
}


function RequestRidePage() {
  const { user, fetchUserProfile } = useAuth();
  const router = useRouter();
  
  const mapRef = useRef<MapRef>(null);
  const [activeInput, setActiveInput] = useState<'pickup' | 'destination' | 'stop1' | 'stop2' | 'shortcut' | null>(null);

  const [pickupInput, setPickupInput] = useState("Localidade atual");
  const [destinationInput, setDestinationInput] = useState("");
  const [stopInputs, setStopInputs] = useState<string[]>([]);
  const [shortcutInput, setShortcutInput] = useState("");
  
  const [pickupSuggestion, setPickupSuggestion] = useState<Suggestion | null>(null);
  const [destinationSuggestion, setDestinationSuggestion] = useState<Suggestion | null>(null);
  const [stopSuggestions, setStopSuggestions] = useState<(Suggestion | null)[]>([]);
  const [selectedShortcutSuggestion, setSelectedShortcutSuggestion] = useState<Suggestion | null>(null);


  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isPlanningTrip, setIsPlanningTrip] = useState(false);
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);
  const [isAddingShortcut, setIsAddingShortcut] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{address: string, coords: LngLatLike} | null>(null);
  const [recentRides, setRecentRides] = useState<RecentRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { toast } = useToast();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  const [homeAddress, setHomeAddress] = useState<string | null>(null);
  const [workAddress, setWorkAddress] = useState<string | null>(null);


  const geocodeAddress = useCallback(async (address: string): Promise<Suggestion | null> => {
    if (!mapboxToken || !address) return null;
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1&country=BR&language=pt`);
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      return data.features[0];
    }
    return null;
  }, [mapboxToken]);

   const loadUserData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        const userProfile = await fetchUserProfile(user as User);
        if (userProfile) {
            setHomeAddress(userProfile.homeAddress || null);
            setWorkAddress(userProfile.workAddress || null);
        }

        const ridesRef = collection(db, "rides");
        const q = query(
            ridesRef, 
            where("passengerId", "==", user.id)
        );
        const querySnapshot = await getDocs(q);
        
        const allRides = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                destinationAddress: data.destinationAddress,
                createdAt: data.createdAt.toDate(),
                status: data.status,
            };
        });

        const completedRides = allRides
            .filter(ride => ride.status === 'completed')
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 3);
        
        setRecentRides(completedRides);
        setIsLoading(false);
    }, [user, fetchUserProfile]);


  useEffect(() => {
    loadUserData();
  }, [loadUserData]);


  const debounce = (func: Function, delay: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), delay);
    };
  };

  const fetchSuggestions = async (query: string) => {
    if (query.length < 3 || !mapboxToken) {
      setSuggestions([]);
      return;
    }
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&autocomplete=true&country=BR&language=pt&proximity=-38.5267,-3.7327`);
    const data = await response.json();
    setSuggestions(data.features);
  };
  
  const debouncedFetchSuggestions = useCallback(debounce((query: string) => fetchSuggestions(query), 300), [mapboxToken]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'pickup' | 'destination' | 'stop' | 'shortcut', index?: number) => {
    const value = e.target.value;
     if (type === 'pickup') {
        setPickupInput(value);
        setActiveInput('pickup');
    } else if (type === 'destination') {
        setDestinationInput(value);
        setActiveInput('destination');
    } else if (type === 'stop' && index !== undefined) {
        const newStops = [...stopInputs];
        newStops[index] = value;
        setStopInputs(newStops);
        setActiveInput(`stop${index+1}` as 'stop1' | 'stop2');
    } else if (type === 'shortcut') {
        setShortcutInput(value);
        setActiveInput('shortcut');
        setSelectedShortcutSuggestion(null); // Clear selection when user types again
    }
    debouncedFetchSuggestions(value);
  };

  const handleSelectSuggestion = (suggestion: Suggestion) => {
      if (activeInput === 'pickup') {
        setPickupSuggestion(suggestion);
        setPickupInput(suggestion.place_name);
    } else if (activeInput === 'destination') {
        setDestinationSuggestion(suggestion);
        setDestinationInput(suggestion.place_name);
    } else if (activeInput?.startsWith('stop')) {
        const index = parseInt(activeInput.replace('stop', ''), 10) - 1;
        const newStopSuggestions = [...stopSuggestions];
        newStopSuggestions[index] = suggestion;
        setStopSuggestions(newStopSuggestions);

        const newStopInputs = [...stopInputs];
        newStopInputs[index] = suggestion.place_name;
        setStopInputs(newStopInputs);
    } else if (activeInput === 'shortcut') {
        setShortcutInput(suggestion.place_name);
        setSelectedShortcutSuggestion(suggestion);
    }
    setSuggestions([]);
    // Do not set activeInput to null here for the shortcut flow
  };
  
  const handleOpenTripPlanner = (destination?: Suggestion) => {
    // Reset state for new planning session
    setPickupInput("Localidade atual");
    setDestinationInput(destination ? destination.place_name : "");
    setStopInputs([]);
    setPickupSuggestion(null);
    setDestinationSuggestion(destination || null);
    setStopSuggestions([]);
    setSuggestions([]);
    setActiveInput(destination ? null : 'destination');
    setIsPlanningTrip(true);
  }

  const handleConfirmTrip = () => {
    if (!destinationSuggestion) {
        toast({ variant: 'destructive', title: 'Destino Obrigatório', description: 'Por favor, selecione um destino válido.' });
        return;
    }

    const tripData = {
        pickup: pickupSuggestion, // Can be null for "Current Location"
        stops: stopSuggestions.filter((s): s is Suggestion => s !== null),
        destination: destinationSuggestion
    }

    setItem(PRESELECTED_TRIP_KEY, tripData);
    router.push('/passenger/confirm-ride');
  }
  
  const handleAddStop = () => {
    if (stopInputs.length < 2) {
      setStopInputs([...stopInputs, ""]);
      setStopSuggestions([...stopSuggestions, null]);
    }
  };

  const handleRemoveStop = (index: number) => {
    const newStops = [...stopInputs];
    newStops.splice(index, 1);
    setStopInputs(newStops);

    const newStopSuggestions = [...stopSuggestions];
    newStopSuggestions.splice(index, 1);
    setStopSuggestions(newStopSuggestions);
  };
  
  const handleConfirmPickedLocation = () => {
    if (!pickedLocation) return;
    const { address, coords } = pickedLocation;

    const newSuggestion: Suggestion = {
      id: `mapbox-place.${(coords as number[]).join(',')}`,
      text: address.split(',')[0],
      place_name: address,
      center: coords as [number, number],
    };

    setDestinationSuggestion(newSuggestion);
    setDestinationInput(address);
    setIsPickingOnMap(false);
    handleOpenTripPlanner(newSuggestion);
  };
  
  const reverseGeocode = useCallback(debounce(async (lng: number, lat: number) => {
    if (!mapboxToken) return;
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&limit=1&types=address,poi`);
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const address = data.features[0].place_name;
      const coords: LngLatLike = [lng, lat];
      setPickedLocation({ address, coords });
    } else {
      const coords: LngLatLike = [lng, lat];
      setPickedLocation({ address: `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`, coords });
    }
  }, 300), [mapboxToken]);

   const handleShortcutClick = async (type: 'home' | 'work') => {
        const address = type === 'home' ? homeAddress : workAddress;
        if (address) {
            const suggestion = await geocodeAddress(address);
            if (suggestion) {
                handleOpenTripPlanner(suggestion);
            } else {
                toast({ variant: 'destructive', title: 'Endereço não encontrado', description: 'Não foi possível localizar o endereço salvo.' });
            }
        } else {
            toast({ title: 'Adicionar Endereço', description: 'Adicione seu endereço de casa no perfil.' });
            router.push('/passenger/profile');
        }
    };
    
    const handlePlannerShortcutClick = async (type: 'home' | 'work') => {
        const address = type === 'home' ? homeAddress : workAddress;
        if (address) {
            const suggestion = await geocodeAddress(address);
            if (suggestion) {
                setDestinationSuggestion(suggestion);
                setDestinationInput(suggestion.place_name);
                setSuggestions([]);
                setActiveInput(null);
            } else {
                toast({ variant: 'destructive', title: 'Endereço não encontrado' });
            }
        } else {
            router.push('/passenger/profile');
        }
    };

    const handleCreateShortcut = () => {
        if (!selectedShortcutSuggestion) return;
        // Logic to save the shortcut would go here.
        // For now, we'll just show a toast and close the screen.
        toast({
            title: "Atalho Criado!",
            description: `O atalho para "${selectedShortcutSuggestion.text}" foi salvo.`
        });
        setIsAddingShortcut(false);
        setShortcutInput("");
        setSelectedShortcutSuggestion(null);
    }

  if (isLoading || !user) {
    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#FAD7FF] via-[#E5D0FF] to-background dark:from-[#9B2FFF] dark:via-[#B028A6] dark:to-[#1D1B2E]">
             <div className="p-6 text-foreground dark:text-white space-y-6">
                <Skeleton className="h-9 w-48 bg-black/10 dark:bg-white/20 rounded-lg"/>
                 <div className="relative flex items-center">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground dark:text-pink-200" />
                     <div className="pl-12 pr-4 h-14 w-full flex items-center text-base rounded-full bg-[#f2eefc] dark:bg-[#2a2733] border-none">
                        <Skeleton className="h-5 w-40 bg-black/10 dark:bg-white/20 rounded-lg" />
                     </div>
                 </div>
             </div>
             <main className="flex-1 p-4 space-y-6 pb-24 bg-background rounded-t-3xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
                 <Card className="bg-card shadow-lg">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="bg-primary/20 p-2 rounded-full">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/><path d="M12 17.5c-3.038 0-5.5-2.462-5.5-5.5s2.462-5.5 5.5-5.5c1.47 0 2.825.582 3.82 1.544"/><path d="M20 17.5c-1.13.43-2.323.68-3.58.75"/></svg>
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-64 bg-muted" />
                            <Skeleton className="h-4 w-48 bg-muted" />
                        </div>
                    </CardContent>
                 </Card>
                 <Separator/>
                 <Skeleton className="h-6 w-32 rounded-lg bg-muted" />
                 <div className="space-y-2">
                    <Skeleton className="h-16 w-full rounded-lg bg-muted" />
                    <Skeleton className="h-16 w-full rounded-lg bg-muted" />
                 </div>
             </main>
             <BottomNavBar role="passenger" />
        </div>
    );
  }

  const firstName = user.name.split(' ')[0];


  if (isAddingShortcut) {
      return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            <header className="flex items-center p-4 border-b">
                 <Button variant="ghost" size="icon" className="-ml-2" onClick={() => setIsAddingShortcut(false)}>
                    <X className="h-6 w-6" />
                </Button>
                <h1 className="text-xl font-bold mx-auto">Adicionar atalho</h1>
                <div className="w-8"></div>
            </header>
             <main className="flex-1 flex flex-col p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Informe o endereço"
                        className="h-12 text-base pl-10 rounded-lg border-primary/50 focus-visible:ring-primary/50"
                        value={shortcutInput}
                        onChange={(e) => handleInputChange(e, 'shortcut')}
                        onFocus={() => setActiveInput('shortcut')}
                    />
                </div>
                {!selectedShortcutSuggestion && suggestions.length > 0 && activeInput === 'shortcut' && (
                    <div className="space-y-1 mt-4">
                        {suggestions.map((suggestion) => (
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
                 {selectedShortcutSuggestion && (
                    <div className="mt-auto pb-4">
                        <Button className="w-full h-12 text-lg" onClick={handleCreateShortcut}>
                            Criar atalho
                        </Button>
                    </div>
                )}
            </main>
        </div>
      )
  }

  if (isPickingOnMap) {
    return (
        <div className="h-screen w-screen relative flex flex-col bg-background text-foreground">
             <div className="absolute inset-0 z-0">
                <Map mapRef={mapRef} onMove={(evt) => reverseGeocode(evt.viewState.longitude, evt.viewState.latitude)} />
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <MapPin className="h-12 w-12 text-pink-500" fill="hsl(var(--primary))" />
            </div>

             <Button variant="ghost" size="icon" className="absolute top-4 left-4 z-20 bg-background/80 backdrop-blur-sm shadow-md" onClick={() => setIsPickingOnMap(false)}>
                <ArrowLeft />
            </Button>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-20 bg-background/80 backdrop-blur-sm shadow-md" onClick={() => mapRef.current?.flyTo({zoom: 15, essential: true })}>
                <LocateFixed />
            </Button>

            <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
                 <Card className="shadow-2xl">
                    <CardContent className="p-4 space-y-4">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold">Definir destino</h2>
                             <div className="p-2 h-14 border rounded-md flex items-center gap-2">
                                <Search className="h-5 w-5 text-pink-500" />
                                {pickedLocation ? (
                                    <p className="font-semibold truncate">{pickedLocation.address}</p>
                                ): (
                                    <p className="text-muted-foreground">Movendo mapa...</p>
                                )}
                             </div>
                        </div>
                        <Button className="w-full h-12 text-lg" onClick={handleConfirmPickedLocation} disabled={!pickedLocation}>
                            Definir destino
                        </Button>
                    </CardContent>
                 </Card>
            </div>
        </div>
    )
  }

  if (isPlanningTrip) {
    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            <header className="flex items-center p-4 border-b">
                 <Button variant="ghost" size="icon" className="-ml-2" onClick={() => setIsPlanningTrip(false)}>
                    <X className="h-6 w-6" />
                </Button>
                <h1 className="text-xl font-bold mx-auto">Viagem</h1>
                 <Button size="sm" onClick={handleConfirmTrip} disabled={!destinationSuggestion}>
                    Confirmar
                 </Button>
            </header>
            <main className="flex-1 px-4 py-6 space-y-6">
                 <Card className="bg-card shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                               <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-background ring-2 ring-blue-500 mt-5"></div>
                               <div className="w-px h-12 bg-border my-1 flex-grow"></div>
                                {stopInputs.map((_, index) => (
                                   <React.Fragment key={`stop-dot-${index}`}>
                                        <div className="w-3 h-3 rounded-full bg-muted-foreground border-2 border-background ring-2 ring-muted-foreground mt-5"></div>
                                        <div className="w-px h-12 bg-border my-1 flex-grow"></div>
                                   </React.Fragment>
                                ))}
                               <div className="w-3 h-3 rounded-full bg-pink-500 border-2 border-background ring-2 ring-pink-500 mt-5"></div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="relative">
                                    <Input
                                        id="pickup-planner"
                                        placeholder="Local de Partida"
                                        className="border-none p-2 h-auto text-base font-semibold focus-visible:ring-0"
                                        required
                                        value={pickupInput}
                                        onChange={(e) => handleInputChange(e, 'pickup')}
                                        onFocus={() => setActiveInput('pickup')}
                                        autoComplete="off"
                                    />
                                </div>
                                <Separator />
                                {stopInputs.map((stop, index) => (
                                    <React.Fragment key={`stop-input-${index}`}>
                                        <div className="relative">
                                            <Input
                                                id={`stop-planner-${index}`}
                                                placeholder={`Parada ${index + 1}`}
                                                className="border-none p-2 h-auto text-base font-semibold focus-visible:ring-0 pr-8"
                                                value={stop}
                                                onChange={(e) => handleInputChange(e, 'stop', index)}
                                                onFocus={() => setActiveInput(`stop${index+1}` as 'stop1' | 'stop2')}
                                                autoComplete="off"
                                            />
                                            <button onClick={() => handleRemoveStop(index)} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 bg-muted rounded-full flex items-center justify-center">
                                                <X className="h-4 w-4"/>
                                            </button>
                                        </div>
                                        <Separator />
                                    </React.Fragment>
                                ))}

                                <div className="relative">
                                    <Input
                                        id="destination-planner"
                                        placeholder="Destino"
                                        className="border-none p-2 h-auto text-base font-semibold focus-visible:ring-0 pr-8"
                                        required
                                        value={destinationInput}
                                        onChange={(e) => handleInputChange(e, 'destination')}
                                        onFocus={() => setActiveInput('destination')}
                                        autoComplete="off"
                                    />
                                    {stopInputs.length < 2 && (
                                     <button onClick={handleAddStop} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 bg-muted rounded-full flex items-center justify-center">
                                        <Plus className="h-4 w-4"/>
                                    </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                 {suggestions.length > 0 && activeInput ? (
                    <div className="space-y-1">
                        {suggestions.map((suggestion) => (
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
                 ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {homeAddress && (
                                <button className="flex items-center gap-3 p-3 text-left rounded-lg bg-muted hover:bg-muted/80" onClick={() => handlePlannerShortcutClick('home')}>
                                    <Home className="h-5 w-5 text-primary" />
                                    <span className="font-semibold">Casa</span>
                                </button>
                            )}
                             {workAddress && (
                                <button className="flex items-center gap-3 p-3 text-left rounded-lg bg-muted hover:bg-muted/80" onClick={() => handlePlannerShortcutClick('work')}>
                                    <Briefcase className="h-5 w-5 text-primary" />
                                    <span className="font-semibold">Trabalho</span>
                                </button>
                            )}
                        </div>
                        <Separator/>
                         <button className="flex items-center gap-4 w-full p-2 text-left hover:bg-muted rounded-lg -ml-2" onClick={() => setIsPickingOnMap(true)}>
                             <div className="p-3 bg-muted rounded-full">
                                <MapPin className="h-5 w-5 text-pink-500" />
                             </div>
                             <span className="font-semibold">Definir no mapa</span>
                        </button>
                        <button className="flex items-center gap-4 w-full p-2 text-left hover:bg-muted rounded-lg -ml-2" onClick={() => setIsAddingShortcut(true)}>
                             <div className="p-3 bg-muted rounded-full">
                                <Star className="h-5 w-5 text-yellow-500" />
                             </div>
                             <span className="font-semibold">Adicionar atalho</span>
                        </button>
                    </div>
                 )}

            </main>
        </div>
    )
  }


  return (
    <div className="flex flex-col min-h-screen w-full bg-gradient-to-b from-[#FAD7FF] via-[#E5D0FF] to-background dark:from-[#9B2FFF] dark:via-[#B028A6] dark:to-[#1D1B2E]">
        <div className="p-6 text-foreground dark:text-white space-y-6">
            <h1 className="text-3xl font-bold">Oi, {firstName}</h1>
            
            <div className="relative flex items-center cursor-pointer" onClick={() => handleOpenTripPlanner()}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground dark:text-white/80" />
                <div
                    id="destination"
                    className="pl-12 pr-4 h-14 w-full flex items-center text-base rounded-full bg-[#f2eefc] dark:bg-[#2a2733] border border-transparent dark:border-none"
                >
                    <span className="text-muted-foreground dark:text-white/80">Para onde você vai?</span>
                </div>
            </div>
        </div>
        <main className="flex-1 p-4 space-y-6 pb-24 bg-background rounded-t-3xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
             <Card className="bg-card shadow-lg">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-primary/20 p-2 rounded-full">
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/><path d="M12 17.5c-3.038 0-5.5-2.462-5.5-5.5s2.462-5.5 5.5-5.5c1.47 0 2.825.582 3.82 1.544"/><path d="M20 17.5c-1.13.43-2.323.68-3.58.75"/></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground">Lembre-se de usar o cinto de segurança</h3>
                        <p className="text-sm text-muted-foreground">Sua segurança é nossa prioridade.</p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-around gap-2">
                <button 
                    onClick={() => handleShortcutClick('home')}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-muted flex-1 hover:bg-primary/10 transition-colors"
                >
                    <Home className="h-6 w-6 text-primary"/>
                    <span className="text-sm font-semibold">Casa</span>
                </button>
                 <button 
                    onClick={() => handleShortcutClick('work')}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-muted flex-1 hover:bg-primary/10 transition-colors"
                >
                    <Briefcase className="h-6 w-6 text-primary"/>
                    <span className="text-sm font-semibold">Trabalho</span>
                </button>
                 <button 
                    onClick={() => setIsAddingShortcut(true)}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-muted flex-1 hover:bg-primary/10 transition-colors"
                >
                    <Plus className="h-6 w-6 text-primary"/>
                    <span className="text-sm font-semibold">Adicionar</span>
                </button>
            </div>
            
            <Separator />
            
            <div>
                 <h2 className="text-lg font-semibold mb-3">Viagens recentes</h2>
                 <div className="space-y-2">
                    {recentRides.map(ride => (
                        <button key={ride.id} className="w-full flex items-center gap-4 text-left p-2 -ml-2 rounded-lg hover:bg-muted" onClick={async () => {
                            const suggestion = await geocodeAddress(ride.destinationAddress);
                            if (suggestion) {
                                handleOpenTripPlanner(suggestion);
                            }
                        }}>
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

