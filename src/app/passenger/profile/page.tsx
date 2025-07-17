
"use client";

import { useState, useEffect, useRef } from "react";
import { withAuth } from "@/components/with-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, User, Mail, Phone, Edit, FileText, Moon, Bell, MapPin, Globe, Share2, EyeOff, Save, Car, Upload, CheckSquare, Camera, Library, LogOut, Settings, ChevronRight, Plus, Shield, History, ArrowLeft, X, Home, Briefcase, Trash2 } from "lucide-react";
import { useRouter } from 'next/navigation';
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
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { useLanguage } from "@/context/language-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription as SheetDescriptionComponent, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type ModalType = 'upload-photo' | null;
type AddressType = 'home' | 'work';
type SheetType = { type: 'address'; addressType: AddressType; } | null;

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

function PassengerProfilePage() {
    const router = useRouter();
    const { user, logout, fetchUserProfile } = useAuth();
    const { theme, setTheme } = useTheme();
    const { toast } = useToast();
    const { language, changeLanguage, t } = useLanguage();
    
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [openModal, setOpenModal] = useState<ModalType>(null);
    const [openSheet, setOpenSheet] = useState<SheetType>(null);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
    const [rideHistory, setRideHistory] = useState<Ride[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    
    const [profileData, setProfileData] = useState<Partial<AuthUser>>({ name: '', email: '', phone: '', photoUrl: '', identityDocumentUrl: '', homeAddress: '', workAddress: '' });
    const [addressInput, setAddressInput] = useState('');
    
    const idInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const photoRef = useRef<HTMLCanvasElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

    const fetchProfileData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const fullProfile = await fetchUserProfile(user);
            if (fullProfile) {
                setProfileData(fullProfile);
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

    const fetchRideHistory = async () => {
        if (!user) return;
        setIsHistoryLoading(true);
        try {
            const today = new Date();
            const startOfTodayTimestamp = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

            const ridesRef = collection(db, "rides");
            const q = query(ridesRef, where("passengerId", "==", user.id));
            
            const querySnapshot = await getDocs(q);
            const allRides: Ride[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
            
            const todaysRides = allRides.filter(ride => {
                const rideDate = ride.createdAt?.toDate ? ride.createdAt.toDate().getTime() : 0;
                return rideDate >= startOfTodayTimestamp;
            });

            todaysRides.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return dateB - dateA;
            });
            
            setRideHistory(todaysRides);
        } catch (error) {
             console.error("Error fetching ride history:", error);
             toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar o histórico."})
        } finally {
            setIsHistoryLoading(false);
        }
    }
    
    const handleOpenAddressSheet = (addressType: AddressType) => {
        setAddressInput( (addressType === 'home' ? profileData.homeAddress : profileData.workAddress) || '');
        setOpenSheet({ type: 'address', addressType });
    };

    const handleOpenHistory = () => {
        fetchRideHistory();
        setIsHistorySheetOpen(true);
    }
    
    useEffect(() => {
        if (user) {
            fetchProfileData();
        }
    }, [user, language]);

    useEffect(() => {
        setIsDarkMode(theme === 'dark');
    }, [theme]);
    
    useEffect(() => {
        const videoElement = videoRef.current;
        const stream = videoElement?.srcObject as MediaStream | null;
        
        if (openModal !== 'upload-photo' && stream) {
            stream.getTracks().forEach(track => track.stop());
            if (videoElement) videoElement.srcObject = null;
        }

        if (openModal === 'upload-photo') {
          const getCameraPermission = async () => {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({video: true});
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
          
          return () => {
             if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
          }
        }
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
            reader.onload = (e) => {
                setPhotoDataUrl(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSavePhoto = async () => {
        if (!user || !photoDataUrl) return;

        try {
            const docRef = doc(db, "profiles", user.id);
            await updateDoc(docRef, { photoUrl: photoDataUrl });
            setProfileData({ ...profileData, photoUrl: photoDataUrl });
            toast({ title: t('toast.photo_saved_title'), description: t('toast.photo_saved_desc') });
            setPhotoDataUrl(null);
            setOpenModal(null);
        } catch (error) {
            toast({ variant: "destructive", title: t('toast.error_title'), description: t('toast.photo_save_error_desc') });
        }
    }


    const handleThemeChange = (checked: boolean) => {
        const newTheme = checked ? 'dark' : 'light';
        setTheme(newTheme);
        setIsDarkMode(checked);
    };
    
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && user) {
            const placeholderUrl = `https://placehold.co/800x600.png?text=ID`;
            
            try {
                const docRef = doc(db, "profiles", user.id);
                await updateDoc(docRef, { identityDocumentUrl: placeholderUrl });
                setProfileData(prev => ({ ...prev, identityDocumentUrl: placeholderUrl }));
                toast({
                    title: t('toast.doc_sent_title'),
                    description: t('toast.doc_sent_desc_passenger'),
                });
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
            });
            toast({ title: t('toast.info_saved_title'), description: t('toast.info_saved_desc') });
            setIsEditingProfile(false);
        } catch (error) {
            toast({ variant: "destructive", title: t('toast.error_title'), description: t('toast.info_save_error_desc') });
        }
    };

    const handleSaveAddress = async () => {
        if (!user || !openSheet || openSheet.type !== 'address') return;
    
        const fieldToUpdate = openSheet.addressType === 'home' ? 'homeAddress' : 'workAddress';
    
        try {
            const docRef = doc(db, "profiles", user.id);
            await updateDoc(docRef, { [fieldToUpdate]: addressInput });
            setProfileData(prev => ({ ...prev, [fieldToUpdate]: addressInput }));
            toast({ title: t('toast.address_saved_title') });
            setOpenSheet(null);
        } catch (error) {
            console.error("Error saving address:", error);
            toast({ variant: "destructive", title: t('toast.error_title'), description: t('toast.address_save_error_desc') });
        }
    };
    
    const handleCloseModal = () => {
        setOpenModal(null);
    }
    
    const ModalContent = () => {
        switch(openModal) {
             case 'upload-photo':
                return (
                    <DialogContent>
                        <DialogHeader><DialogTitle>{t('profile.change_photo')}</DialogTitle></DialogHeader>
                        <div className="flex flex-col items-center space-y-4 py-4">
                            <div className="w-full max-w-sm aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center relative">
                                <video ref={videoRef} className={cn("w-full h-full object-cover", photoDataUrl && "hidden")} autoPlay muted playsInline />
                                {photoDataUrl && (
                                    <img src={photoDataUrl} alt={t('profile.your_photo_alt')} className="w-full h-full object-cover"/>
                                )}
                                {hasCameraPermission === false && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
                                        <Alert variant="destructive">
                                            <AlertTitle>{t('profile.camera_unavailable_title')}</AlertTitle>
                                            <AlertDescription>{t('profile.camera_unavailable_desc')}</AlertDescription>
                                        </Alert>
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
                                    <Button onClick={takePhoto} disabled={!hasCameraPermission}>
                                        <Camera className="mr-2"/> {t('profile.take_photo_btn')}
                                    </Button>
                                    <Button variant="outline" onClick={() => galleryInputRef.current?.click()}>
                                        <Library className="mr-2"/> {t('profile.choose_from_gallery')}
                                    </Button>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">{t('common.cancel')}</Button></DialogClose>
                        </DialogFooter>
                    </DialogContent>
                );
            default:
                return null;
        }
    }


    if (!user || isLoading) {
         return <div className="flex h-screen w-full items-center justify-center">{t('common.loading')}</div>;
    }
    
    return (
        <div className="flex flex-col min-h-screen bg-muted/40">
            <header className="sticky top-0 z-10 flex items-center h-16 px-4 border-b bg-background">
                <Button variant="ghost" size="icon" onClick={() => router.push('/passenger/request-ride')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-lg font-semibold mx-auto">Conta</h1>
                <div className="w-8"></div>
            </header>
            <main className="flex-1 py-6 container mx-auto px-4 pb-24">
                <div className="flex flex-col items-center text-center">
                    <div className="relative">
                        <Avatar className="h-28 w-28 border-4 border-background shadow-md">
                            <AvatarImage src={profileData.photoUrl || undefined} data-ai-hint="person avatar" />
                            <AvatarFallback>
                                <User className="h-12 w-12 text-muted-foreground" />
                            </AvatarFallback>
                        </Avatar>
                        <button onClick={() => setOpenModal('upload-photo')} className="absolute bottom-0 right-0 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white border-2 border-background">
                            <Plus className="h-5 w-5" />
                        </button>
                    </div>
                    <h2 className="text-2xl font-bold mt-4">{profileData.name}</h2>
                    <p className="text-sm text-muted-foreground mt-2">{t('profile.member_since', { date: 'Fevereiro 2023' })}</p>
                </div>

                <Card className="mt-8">
                     <CardHeader className="flex flex-row items-center justify-between">
                         <div>
                            <CardTitle>{t('profile.personal_info')}</CardTitle>
                         </div>
                         {isEditingProfile ? (
                            <Button variant="ghost" size="sm" className="gap-1.5 text-primary" onClick={handleSaveProfile}>
                                <Save className="h-4 w-4"/> {t('common.save')}
                            </Button>
                         ) : (
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
                            <Input id="phone" type="tel" value={profileData.phone || ''} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} disabled={!isEditingProfile} className={cn(!isEditingProfile && "bg-muted border-none")} />
                        </div>
                     </CardContent>
                </Card>

                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>{t('profile.address.saved_locations')}</CardTitle>
                        <CardDescription>Adicione ou edite seus locais para viagens rápidas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                       <button onClick={() => handleOpenAddressSheet('home')} className="flex items-center w-full p-3 -ml-3 text-left rounded-lg hover:bg-muted">
                           <Home className="h-5 w-5 mr-4 text-muted-foreground" />
                           <div className="flex-1">
                                <p className="font-semibold">{t('profile.address.home')}</p>
                                <p className={cn("text-sm", profileData.homeAddress ? 'text-muted-foreground' : 'text-primary')}>{profileData.homeAddress || t('profile.address.add_home')}</p>
                           </div>
                           <ChevronRight className="h-5 w-5 text-muted-foreground" />
                       </button>
                        <Separator />
                       <button onClick={() => handleOpenAddressSheet('work')} className="flex items-center w-full p-3 -ml-3 text-left rounded-lg hover:bg-muted">
                           <Briefcase className="h-5 w-5 mr-4 text-muted-foreground" />
                           <div className="flex-1">
                                <p className="font-semibold">{t('profile.address.work')}</p>
                                <p className={cn("text-sm", profileData.workAddress ? 'text-muted-foreground' : 'text-primary')}>{profileData.workAddress || t('profile.address.add_work')}</p>
                           </div>
                           <ChevronRight className="h-5 w-5 text-muted-foreground" />
                       </button>
                    </CardContent>
                </Card>


                <Card className="mt-6">
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
                            <input type="file" ref={idInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,.pdf" />
                            <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => idInputRef.current?.click()}><Upload className="h-4 w-4"/> {t('profile.documents.upload_btn')}</Button>
                        </div>
                    </CardContent>
                </Card>
                
                 <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Configurações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <Moon className="h-6 w-6 text-muted-foreground mt-1" />
                            <div className="flex-1">
                                <p className="font-medium">{t('profile.settings.dark_mode')}</p>
                                <p className="text-sm text-muted-foreground">{t('profile.settings.dark_mode_desc')}</p>
                            </div>
                            <Switch checked={isDarkMode} onCheckedChange={handleThemeChange} />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between gap-4">
                            <Globe className="h-6 w-6 text-muted-foreground" />
                            <div className="flex-1">
                                <p className="font-medium">{t('profile.settings.language')}</p>
                            </div>
                            <Select value={language} onValueChange={(value) => changeLanguage(value as 'pt' | 'en')}>
                                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pt">Português</SelectItem>
                                    <SelectItem value="en">English</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>{t('profile.settings.privacy_title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <Share2 className="h-6 w-6 text-muted-foreground mt-1" />
                            <div className="flex-1">
                                <p className="font-medium">{t('profile.settings.privacy_share_data')}</p>
                                <p className="text-sm text-muted-foreground">{t('profile.settings.privacy_share_data_desc')}</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                    </CardContent>
                </Card>

                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>{t('profile.history.title')}</CardTitle>
                        <CardDescription>{t('profile.history.description')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" className="w-full" onClick={handleOpenHistory}>
                            Ver Histórico de Corridas
                        </Button>
                    </CardContent>
                </Card>
                
                <div className="mt-8">
                     <Button variant="destructive" className="w-full h-12" onClick={logout}>
                        <LogOut className="mr-2 h-5 w-5" />
                        {t('profile.logout_btn')}
                    </Button>
                </div>
            </main>
            
            <Dialog open={!!openModal} onOpenChange={(isOpen) => !isOpen && handleCloseModal()}>
                <ModalContent />
            </Dialog>

            <Sheet open={isHistorySheetOpen} onOpenChange={setIsHistorySheetOpen}>
                <SheetContent className="w-full sm:max-w-md p-0">
                    <SheetHeader className="p-6 border-b">
                        <SheetTitle>{t('profile.history.title')}</SheetTitle>
                        <SheetDescriptionComponent>Exibindo apenas o histórico de hoje. Para corridas anteriores, entre em contato com o suporte.</SheetDescriptionComponent>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100%-80px)]">
                        {isHistoryLoading ? (
                            <p className="text-center text-muted-foreground py-10">Carregando histórico...</p>
                        ) : rideHistory.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10 px-6">
                                <p>Nenhum histórico para hoje.</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {rideHistory.map(ride => (
                                    <div key={ride.id} className="p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <p className="font-semibold">{ride.createdAt.toDate().toLocaleDateString('pt-BR')}</p>
                                            <p className="font-bold text-lg">{ride.fare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            <p><span className="font-medium text-foreground">{t('profile.history.from')}</span> {ride.pickupAddress}</p>
                                            <p><span className="font-medium text-foreground">{t('profile.history.to')}</span> {ride.destinationAddress}</p>
                                        </div>
                                        <Badge variant={ride.status === 'completed' ? "secondary" : "destructive"}>
                                            {t(`profile.history.status.${ride.status}`)}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            <Sheet open={!!openSheet} onOpenChange={(isOpen) => !isOpen && setOpenSheet(null)}>
                <SheetContent side="bottom" className="rounded-t-xl">
                    <SheetHeader>
                        <SheetTitle>{openSheet?.addressType === 'home' ? t('profile.address.edit_home_title') : t('profile.address.edit_work_title')}</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <Label htmlFor="address-input">{t('profile.address.full_address')}</Label>
                            <Input
                                id="address-input"
                                value={addressInput}
                                onChange={(e) => setAddressInput(e.target.value)}
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

             <BottomNavBar role="passenger" />
        </div>
    );
}

export default withAuth(PassengerProfilePage, ["passenger"]);

    

    