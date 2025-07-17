
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { withAuth } from "@/components/with-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, User, Mail, Phone, Edit, FileText, Moon, Bell, MapPin, Globe, Share2, EyeOff, Save, LogOut, Camera, Library, Settings, History, Shield, ShieldCheck, Home, Briefcase, Plus, Calendar, ChevronRight, Upload, CheckSquare, Trash2, Mic, Languages, Undo2, Pencil, Car, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, User as AuthUser } from "@/context/auth-context";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getItem, setItem, removeItem } from "@/lib/storage";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useLanguage } from "@/context/language-context";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ModalType = 'upload-photo' | null;
type AddressType = 'home' | 'work' | 'custom' | { type: 'edit_custom', id: string };

interface SavedLocation {
    id: string;
    name: string;
    address: string;
}

interface Ride {
    id: string;
    destinationAddress: string;
    pickupAddress: string;
    fare: number;
    createdAt: {
        toDate: () => Date;
    };
    status: 'completed' | 'cancelled';
}

const PRESELECTED_DESTINATION_KEY = 'preselected_destination';


function ProfilePageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, logout, fetchUserProfile } = useAuth();
    const { theme, setTheme } = useTheme();
    const { toast } = useToast();
    const { language, changeLanguage, t } = useLanguage();
    const [isDarkMode, setIsDarkMode] = useState(false);

    const [profileData, setProfileData] = useState({ name: '', email: '', phone: '', cpf: '', photoUrl: '', identityDocumentUrl: '', addressProofUrl: '', homeAddress: '', workAddress: '', savedLocations: [] as SavedLocation[] });
    const [isLoading, setIsLoading] = useState(true);
    const [openModal, setOpenModal] = useState<ModalType>(null);
    const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false);
    const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    
    const [addressTypeToSet, setAddressTypeToSet] = useState<AddressType | null>(null);
    const [currentAddress, setCurrentAddress] = useState("");
    const [locationName, setLocationName] = useState("");

    const [rideHistory, setRideHistory] = useState<Ride[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);


    const videoRef = useRef<HTMLVideoElement>(null);
    const photoRef = useRef<HTMLCanvasElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const idInputRef = useRef<HTMLInputElement>(null);
    const addressInputRef = useRef<HTMLInputElement>(null);

    const fetchProfileData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const data = await fetchUserProfile(user);
            const baseData = {
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '+55 11 99999-8888',
                cpf: user.cpf || '123.456.789-00',
                photoUrl: user.photoUrl || '',
                identityDocumentUrl: user.identityDocumentUrl || '',
                addressProofUrl: user.addressProofUrl || '',
                homeAddress: user.homeAddress || '',
                workAddress: user.workAddress || '',
                savedLocations: user.savedLocations || [],
            }
            
            if (data) {
                 setProfileData({ ...baseData, ...data });
            } else {
                 setProfileData(baseData);
                 console.warn("Firestore profile not found, using data from auth context.");
            }
        } catch (error) {
            console.error("Error fetching profile data:", error);
            toast({
                variant: "destructive",
                title: t('toast.profile_load_error_title'),
                description: t('toast.profile_load_error_desc'),
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (user) {
            fetchProfileData();
        }
    }, [user]);

    useEffect(() => {
        const showHistory = searchParams.get('showHistory') === 'true';
        if (showHistory) {
            handleOpenHistory();
        }
    }, [searchParams]);

    const fetchRideHistory = async () => {
        if (!user) return;
        setIsHistoryLoading(true);
        try {
            const ridesRef = collection(db, "rides");
            const q = query(
                ridesRef, 
                where("passengerId", "==", user.id)
            );
            const querySnapshot = await getDocs(q);
            const history: Ride[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
            history.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
            setRideHistory(history);
        } catch (error) {
             console.error("Error fetching ride history:", error);
             toast({ variant: "destructive", title: t('toast.error_title'), description: t('profile.history.load_error_desc')})
        } finally {
            setIsHistoryLoading(false);
        }
    }

    const handleOpenHistory = () => {
        fetchRideHistory();
        setIsHistorySheetOpen(true);
    }
    
     useEffect(() => {
        setIsDarkMode(theme === 'dark');
    }, [theme]);


     useEffect(() => {
        const videoElement = videoRef.current;
        let stream: MediaStream | null = null;
        if (videoElement) {
            stream = videoElement.srcObject as MediaStream | null;
        }

        const stopStream = () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                if(videoElement) videoElement.srcObject = null;
            }
        };

        if (openModal !== 'upload-photo') {
            stopStream();
        } else {
            const getCameraPermission = async () => {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    setHasCameraPermission(true);
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (error) {
                    console.error('Error accessing camera:', error);
                    setHasCameraPermission(false);
                    toast({
                        variant: 'destructive',
                        title: t('toast.camera_denied_title'),
                        description: t('toast.camera_denied_desc'),
                    });
                }
            };
            getCameraPermission();
        }

        return () => {
            stopStream();
        };
    }, [openModal, toast, t]);

    const takePhoto = () => {
        const video = videoRef.current;
        const photo = photoRef.current;

        if (video && photo) {
            const size = Math.min(video.videoWidth, video.videoHeight);
            const x = (video.videoWidth - size) / 2;
            const y = (video.videoHeight - size) / 2;
        
            photo.width = 300;
            photo.height = 300;

            const context = photo.getContext('2d');
            if (context) {
                context.drawImage(video, x, y, size, size, 0, 0, 300, 300);
                setPhotoDataUrl(photo.toDataURL('image/png'));
            }
        }
    };
    
    const handleGalleryFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setPhotoDataUrl(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, documentName: 'identityDocumentUrl' | 'addressProofUrl') => {
        const file = event.target.files?.[0];
        if (file && user) {
            const placeholderUrl = `https://placehold.co/800x600.png?text=${documentName}`;
            try {
                const docRef = doc(db, "profiles", user.id);
                await updateDoc(docRef, { [documentName]: placeholderUrl });
                setProfileData(prev => ({ ...prev, [documentName]: placeholderUrl }));
                toast({ title: t('toast.doc_sent_title'), description: t('toast.doc_sent_desc_passenger') });
            } catch (error) {
                toast({ variant: "destructive", title: t('toast.error_title'), description: t('toast.doc_send_error_desc') });
            }
        }
    };

    const handleSaveProfile = async () => {
        if (!user) return;
        try {
            const docRef = doc(db, "profiles", user.id);
            await updateDoc(docRef, {
                name: profileData.name,
                email: profileData.email,
                phone: profileData.phone,
                cpf: profileData.cpf
            });
            toast({ title: t('toast.info_saved_title') });
             setIsEditingProfile(false);
        } catch (error) {
            toast({ variant: "destructive", title: t('toast.error_title'), description: t('toast.info_save_error_desc') });
        }
    };

    const handleSavePhoto = async () => {
        if (!user || !photoDataUrl) return;
        try {
            const docRef = doc(db, "profiles", user.id);
            await updateDoc(docRef, { photoUrl: photoDataUrl });
            setProfileData({ ...profileData, photoUrl: photoDataUrl });
            toast({ title: t('toast.photo_saved_title') });
            setPhotoDataUrl(null);
            setOpenModal(null);
        } catch (error) {
            toast({ variant: "destructive", title: t('toast.error_title'), description: t('toast.photo_save_error_desc') });
        }
    };
    
     const handleOpenAddressSheet = (type: AddressType, data?: SavedLocation) => {
        setAddressTypeToSet(type);
        if (type === 'home') {
            setCurrentAddress(profileData.homeAddress);
            setLocationName('Casa');
        } else if (type === 'work') {
            setCurrentAddress(profileData.workAddress);
            setLocationName('Trabalho');
        } else if (type === 'custom') {
            setCurrentAddress('');
            setLocationName('');
        } else if (typeof type === 'object' && type.type === 'edit_custom' && data) {
            setCurrentAddress(data.address);
            setLocationName(data.name);
        }
        setIsAddressSheetOpen(true);
    };

    const handleThemeChange = (checked: boolean) => {
        const newTheme = checked ? 'dark' : 'light';
        setTheme(newTheme);
        setIsDarkMode(checked);
    };

    const handleSaveAddress = async () => {
        if (!user || !addressTypeToSet) return;
        
        try {
            const userDocRef = doc(db, "profiles", user.id);
            let updatedProfileData = { ...profileData };

            if (addressTypeToSet === 'home') {
                await updateDoc(userDocRef, { homeAddress: currentAddress });
                updatedProfileData.homeAddress = currentAddress;
            } else if (addressTypeToSet === 'work') {
                await updateDoc(userDocRef, { workAddress: currentAddress });
                 updatedProfileData.workAddress = currentAddress;
            } else if (addressTypeToSet === 'custom') {
                const newLocation: SavedLocation = { id: Date.now().toString(), name: locationName, address: currentAddress };
                const newSavedLocations = [...(profileData.savedLocations || []), newLocation];
                await updateDoc(userDocRef, { savedLocations: newSavedLocations });
                updatedProfileData.savedLocations = newSavedLocations;
            } else if (addressTypeToSet && typeof addressTypeToSet === 'object' && addressTypeToSet.type === 'edit_custom') {
                 const newSavedLocations = profileData.savedLocations.map(loc => 
                    loc.id === addressTypeToSet.id ? { ...loc, name: locationName, address: currentAddress } : loc
                );
                await updateDoc(userDocRef, { savedLocations: newSavedLocations });
                updatedProfileData.savedLocations = newSavedLocations;
            }

            setProfileData(updatedProfileData);
            toast({ title: t('toast.address_saved_title') });
            setIsAddressSheetOpen(false);

        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.error_title'), description: t('toast.address_save_error_desc') });
        }
    };
    
    const handleDeleteLocation = async (id: string) => {
        if (!user) return;
        try {
             const newSavedLocations = profileData.savedLocations.filter(loc => loc.id !== id);
             const userDocRef = doc(db, "profiles", user.id);
             await updateDoc(userDocRef, { savedLocations: newSavedLocations });
             setProfileData(prev => ({...prev, savedLocations: newSavedLocations}));
             toast({title: t('toast.location_removed_title')});
        } catch (error) {
             toast({ variant: 'destructive', title: t('toast.error_title'), description: t('toast.location_remove_error_desc') });
        }
    };
    
    const handleRequestAgain = (ride: Ride) => {
        if (ride.status === 'cancelled') {
            toast({
                variant: 'destructive',
                title: t('toast.reride_cancelled_title'),
                description: t('toast.reride_cancelled_desc')
            });
            return;
        }

        const rerideRequest = {
            pickup: ride.pickupAddress,
            destination: ride.destinationAddress,
        };
        setItem('reride_request', rerideRequest);
        router.push('/passenger/request-ride');
    };
    
    const handleRequestRideToSavedAddress = (address: string | null) => {
        if (!address) {
            toast({
                variant: "destructive",
                title: "Endereço não definido",
                description: "Adicione este endereço em seu perfil primeiro.",
            });
            return;
        }
        setItem(PRESELECTED_DESTINATION_KEY, { place_name: address, center: [0,0] }); // Note: Geocoding will happen on next screen
        router.push('/passenger/request-ride');
    };


     const renderCustomLocationItem = (location: SavedLocation) => (
         <div key={location.id} className="w-full">
            <div className="flex items-center justify-between py-3 px-2">
                <div className="flex items-center gap-4 flex-1">
                    <MapPin className="h-5 w-5 text-muted-foreground"/>
                    <div className="text-left">
                        <p className="font-semibold">{location.name}</p>
                        <p className="text-xs text-muted-foreground">{location.address}</p>
                    </div>
                </div>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRequestRideToSavedAddress(location.address)}>
                        <Car className="h-4 w-4 text-primary"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenAddressSheet({ type: 'edit_custom', id: location.id }, location)}>
                        <Edit className="h-4 w-4"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteLocation(location.id)}>
                        <Trash2 className="h-4 w-4"/>
                    </Button>
                </div>
            </div>
         </div>
    );
    

    if (!user || isLoading) {
      return <div className="flex h-screen w-full items-center justify-center">{t('common.loading')}</div>;
    }
    
    const handleCloseModal = () => {
        setOpenModal(null);
    }


    const ModalContent = () => {
        if (openModal === 'upload-photo') return (
            <Dialog open={openModal === 'upload-photo'} onOpenChange={(isOpen) => !isOpen && handleCloseModal()}>
                 <DialogContent>
                    <DialogHeader><DialogTitle>{t('profile.change_photo')}</DialogTitle></DialogHeader>
                    <div className="flex flex-col items-center space-y-4 py-4">
                        <div className="w-full max-w-sm aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center relative">
                            <video ref={videoRef} className={cn("w-full h-full object-cover", photoDataUrl && "hidden")} autoPlay muted playsInline />
                            {photoDataUrl && (<img src={photoDataUrl} alt={t('profile.your_photo_alt')} className="w-full h-full object-cover"/>)}
                            {hasCameraPermission === false && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
                                    <Alert variant="destructive"><AlertDescription>{t('profile.camera_unavailable_desc')}</AlertDescription></Alert>
                                </div>
                            )}
                        </div>
                        <canvas ref={photoRef} className="hidden"></canvas>
                        <input type="file" ref={galleryInputRef} className="hidden" onChange={handleGalleryFileSelect} accept="image/*" />
                        
                        {photoDataUrl ? (
                            <div className="flex flex-col space-y-2 w-full max-w-sm">
                                <Button onClick={handleSavePhoto}>{t('profile.save_photo')}</Button>
                                <Button variant="ghost" onClick={() => setPhotoDataUrl(null)}>{t('profile.take_another')}</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                                <Button onClick={takePhoto} disabled={!hasCameraPermission}><Camera className="mr-2"/> {t('profile.take_photo_btn')}</Button>
                                <Button variant="outline" onClick={() => galleryInputRef.current?.click()}><Library className="mr-2"/> {t('profile.choose_from_gallery')}</Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        );
        
        return null;
    }
    
     const getSheetTitle = () => {
        if (!addressTypeToSet) return "";
        if (addressTypeToSet === 'home') return t('profile.address.edit_home_title');
        if (addressTypeToSet === 'work') return t('profile.address.edit_work_title');
        if (addressTypeToSet === 'custom') return t('profile.address.add_new_title');
        if (addressTypeToSet && typeof addressTypeToSet === 'object' && addressTypeToSet.type === 'edit_custom') return t('profile.address.edit_saved_title');
        return "";
    };

    return (
        <div className="flex flex-col min-h-screen bg-muted/40">
            <header className="sticky top-0 z-10 flex items-center h-16 px-4 border-b bg-background">
                <Button variant="ghost" size="icon" onClick={() => router.push('/passenger/request-ride')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-lg font-semibold mx-auto">Conta</h1>
                <div className="w-8"></div>
            </header>
            <main className="flex-1 pb-24 container mx-auto px-4">
                <div className="flex flex-col items-center text-center my-6">
                    <div className="relative">
                        <Avatar className="h-24 w-24 border-4 border-background shadow-md">
                           <AvatarImage src={profileData.photoUrl || undefined} data-ai-hint="person avatar" />
                            <AvatarFallback>
                                <User className="h-12 w-12 text-muted-foreground" />
                            </AvatarFallback>
                        </Avatar>
                        <button onClick={() => setOpenModal('upload-photo')} className="absolute bottom-0 right-0 h-7 w-7 bg-primary rounded-full flex items-center justify-center text-white border-2 border-background">
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                    <h1 className="text-2xl font-bold mt-4">{profileData.name}</h1>
                </div>

                <Card className="bg-blue-100/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm mb-6">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="bg-blue-500 text-white h-10 w-10 flex items-center justify-center rounded-lg">
                           <ShieldCheck className="h-6 w-6"/>
                        </div>
                        <p className="flex-1 font-medium text-blue-800 dark:text-blue-200">
                           Lembre-se de usar sempre o cinto de segurança.
                        </p>
                    </CardContent>
                </Card>

                <Card className="mb-6">
                     <CardHeader className="flex flex-row items-center justify-between">
                         <div>
                            <CardTitle>{t('profile.personal_info')}</CardTitle>
                         </div>
                         {isEditingProfile ? (
                            <Button variant="ghost" size="sm" className="gap-1.5 text-primary" onClick={handleSaveProfile}>
                                <Save className="h-4 w-4"/> {t('common.save')}
                            </Button>
                         ): (
                            <Button variant="ghost" size="sm" className="gap-1.5 text-primary" onClick={() => setIsEditingProfile(true)}>
                                <Edit className="h-4 w-4"/> {t('common.edit')}
                            </Button>
                        )}
                     </CardHeader>
                     <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="name">{t('profile.form.full_name')}</Label>
                            <Input id="name" value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} disabled={!isEditingProfile} className={cn(!isEditingProfile && "bg-muted border-none")} />
                        </div>
                        <div>
                            <Label htmlFor="email">{t('profile.form.email')}</Label>
                            <Input id="email" type="email" value={profileData.email} onChange={(e) => setProfileData({...profileData, email: e.target.value})} disabled={!isEditingProfile} className={cn(!isEditingProfile && "bg-muted border-none")} />
                        </div>
                        <div>
                            <Label htmlFor="phone">{t('profile.form.phone')}</Label>
                            <Input id="phone" type="tel" value={profileData.phone} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} disabled={!isEditingProfile} className={cn(!isEditingProfile && "bg-muted border-none")} />
                        </div>
                        <div>
                            <Label htmlFor="cpf">{t('profile.form.cpf')}</Label>
                            <Input id="cpf" value={profileData.cpf} onChange={(e) => setProfileData({...profileData, cpf: e.target.value})} disabled={!isEditingProfile} className={cn(!isEditingProfile && "bg-muted border-none")} />
                        </div>
                     </CardContent>
                </Card>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{t('profile.documents.title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">{t('profile.documents.id_title')}</p>
                                    <p className="text-sm text-muted-foreground">{t('profile.documents.id_desc')}</p>
                                </div>
                                <Badge variant={profileData.identityDocumentUrl ? 'secondary' : 'destructive'} className={cn(profileData.identityDocumentUrl && 'gap-1.5 bg-green-100 text-green-800 border-green-300')}>
                                    {profileData.identityDocumentUrl && <CheckSquare className="h-4 w-4"/>}
                                    {profileData.identityDocumentUrl ? t('profile.documents.status_verified') : t('profile.documents.status_pending')}
                                </Badge>
                            </div>
                            <input type="file" ref={idInputRef} className="hidden" onChange={(e) => handleFileSelect(e, 'identityDocumentUrl')} accept="image/*,.pdf" />
                            <Button variant="outline" className="w-full mt-4" onClick={() => idInputRef.current?.click()}>{t('profile.documents.upload_btn')}</Button>
                        </div>
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">{t('profile.documents.address_proof_title')}</p>
                                    <p className="text-sm text-muted-foreground">{t('profile.documents.address_proof_desc')}</p>
                                </div>
                                <Badge variant={profileData.addressProofUrl ? 'secondary' : 'destructive'} className={cn(profileData.addressProofUrl && 'gap-1.5 bg-green-100 text-green-800 border-green-300')}>
                                    {profileData.addressProofUrl && <CheckSquare className="h-4 w-4"/>}
                                    {profileData.addressProofUrl ? t('profile.documents.status_verified') : t('profile.documents.status_pending')}
                                </Badge>
                            </div>
                            <input type="file" ref={addressInputRef} className="hidden" onChange={(e) => handleFileSelect(e, 'addressProofUrl')} accept="image/*,.pdf" />
                            <Button variant="outline" className="w-full mt-4" onClick={() => addressInputRef.current?.click()}>{t('profile.documents.upload_btn')}</Button>
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-lg">{t('profile.address.saved_locations')}</CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y p-0">
                        <div className="flex items-center justify-between py-3 px-4">
                           <div className="flex items-center gap-4">
                             <Home className="h-5 w-5 text-muted-foreground"/>
                               <div className="text-left">
                                   <p className="font-semibold">{t('profile.address.home')}</p>
                                   <p className="text-xs text-muted-foreground">{profileData.homeAddress || t('profile.address.add_home')}</p>
                               </div>
                           </div>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleRequestRideToSavedAddress(profileData.homeAddress)}>
                                        <Car className="mr-2 h-4 w-4" />
                                        Solicitar Corrida
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenAddressSheet('home')}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        {profileData.homeAddress ? 'Editar' : 'Adicionar'}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                         <div className="flex items-center justify-between py-3 px-4">
                           <div className="flex items-center gap-4">
                             <Briefcase className="h-5 w-5 text-muted-foreground"/>
                               <div className="text-left">
                                   <p className="font-semibold">{t('profile.address.work')}</p>
                                   <p className="text-xs text-muted-foreground">{profileData.workAddress || t('profile.address.add_work')}</p>
                               </div>
                           </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleRequestRideToSavedAddress(profileData.workAddress)}>
                                        <Car className="mr-2 h-4 w-4" />
                                        Solicitar Corrida
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenAddressSheet('work')}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        {profileData.workAddress ? 'Editar' : 'Adicionar'}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {profileData.savedLocations.map(renderCustomLocationItem)}
                        
                        <Button variant="ghost" className="w-full h-auto justify-start items-center py-4 px-4 gap-4" onClick={() => handleOpenAddressSheet('custom')}>
                            <Plus className="h-5 w-5 text-primary"/>
                            <span className="font-semibold text-primary">{t('profile.address.add_new')}</span>
                        </Button>
                    </CardContent>
                </Card>
                
                 <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{t('profile.settings.title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y">
                        <div className="flex items-center justify-between py-4">
                            <div className="flex items-center gap-4">
                                <Moon className="h-5 w-5 text-muted-foreground"/>
                                <p className="font-semibold">{t('profile.settings.dark_mode')}</p>
                            </div>
                            <Switch checked={isDarkMode} onCheckedChange={handleThemeChange} />
                        </div>
                         <div className="flex items-center justify-between py-4">
                            <div className="flex items-center gap-4">
                                <Globe className="h-5 w-5 text-muted-foreground"/>
                                <p className="font-semibold">{t('profile.settings.language')}</p>
                            </div>
                             <Select value={language} onValueChange={(value) => changeLanguage(value as 'pt' | 'en')}>
                                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pt">Português</SelectItem>
                                    <SelectItem value="en">English</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="flex items-center justify-between py-4">
                           <div className="flex items-center gap-4">
                                <Bell className="h-5 w-5 text-muted-foreground" />
                                <div className="flex-1">
                                    <p className="font-semibold">{t('profile.settings.notifications')}</p>
                                </div>
                            </div>
                            <Switch defaultChecked />
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-8">
                    <Button variant="destructive" className="w-full h-12" onClick={logout}>
                        <LogOut className="mr-2 h-5 w-5" />
                        {t('profile.logout_btn')}
                    </Button>
                </div>
            </main>

            <Sheet open={isAddressSheetOpen} onOpenChange={setIsAddressSheetOpen}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>{getSheetTitle()}</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 space-y-4">
                         {(addressTypeToSet === 'custom' || (addressTypeToSet && typeof addressTypeToSet === 'object' && addressTypeToSet.type === 'edit_custom')) && (
                            <div>
                                <Label htmlFor="location-name">{t('profile.address.location_name')}</Label>
                                <Input 
                                    id="location-name" 
                                    value={locationName} 
                                    onChange={(e) => setLocationName(e.target.value)} 
                                    placeholder={t('profile.address.location_name_placeholder')}
                                />
                            </div>
                        )}
                        <div>
                            <Label htmlFor="address-input">{t('profile.address.full_address')}</Label>
                            <Input 
                                id="address-input" 
                                value={currentAddress} 
                                onChange={(e) => setCurrentAddress(e.target.value)} 
                                placeholder={t('profile.address.full_address_placeholder')}
                            />
                        </div>
                    </div>
                    <SheetFooter>
                        <SheetClose asChild>
                            <Button type="button" variant="outline">{t('common.cancel')}</Button>
                        </SheetClose>
                        <Button onClick={handleSaveAddress}>{t('profile.address.save_address_btn')}</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Sheet open={isHistorySheetOpen} onOpenChange={setIsHistorySheetOpen}>
                <SheetContent className="w-full sm:max-w-md p-0">
                    <SheetHeader className="p-6 border-b">
                        <SheetTitle>{t('profile.history.title')}</SheetTitle>
                        <SheetDescription>{t('profile.history.description')}</SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-80px)]">
                        {isHistoryLoading ? (
                            <p className="text-center text-muted-foreground py-10">{t('common.loading')}</p>
                        ) : rideHistory.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10 px-6">
                                <p>{t('profile.history.no_rides')}</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {rideHistory.map(ride => (
                                    <div key={ride.id} className="p-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <p className="font-semibold">{ride.createdAt.toDate().toLocaleDateString('pt-BR')}</p>
                                            <p className="font-bold text-lg">{ride.fare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/>
                                                <p><span className="font-medium text-foreground">{t('profile.history.from')}</span> {ride.pickupAddress}</p>
                                            </div>
                                             <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0"/>
                                                <p><span className="font-medium text-foreground">{t('profile.history.to')}</span> {ride.destinationAddress}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <Badge variant={ride.status === 'completed' ? "secondary" : "destructive"}>
                                                {t(`profile.history.status.${ride.status}`)}
                                            </Badge>
                                             <Button variant="outline" size="sm" onClick={() => handleRequestAgain(ride)}>
                                                <Undo2 className="mr-2 h-4 w-4"/>
                                                {t('profile.history.request_again_btn')}
                                             </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            <ModalContent />
            <BottomNavBar role="passenger" />
        </div>
    );
}


export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Carregando...</div>}>
            <ProfilePageContent />
        </Suspense>
    )
}

    

    