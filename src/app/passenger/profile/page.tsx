
"use client";

import { useState, useEffect, useRef } from "react";
import { withAuth } from "@/components/with-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, User, Mail, Phone, Edit, FileText, Moon, Bell, MapPin, Globe, Share2, EyeOff, Save, Car, Upload, CheckSquare, Camera, Library, LogOut, Settings, ChevronRight, Plus, Shield, History, ArrowLeft, X } from "lucide-react";
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
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, startOfDay, endOfDay, Timestamp } from "firebase/firestore";
import { useLanguage } from "@/context/language-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { setItem } from "@/lib/storage";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type ModalType = 'upload-photo' | null;

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
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
    const [rideHistory, setRideHistory] = useState<Ride[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    
    const [profileData, setProfileData] = useState<Partial<AuthUser>>({ name: '', email: '', phone: '', photoUrl: '', identityDocumentUrl: '', homeAddress: '', workAddress: '' });
    
    const idInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

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
                homeAddress: profileData.homeAddress,
                workAddress: profileData.workAddress,
            });
            toast({ title: t('toast.info_saved_title'), description: t('toast.info_saved_desc') });
            setIsEditingProfile(false);
        } catch (error) {
            toast({ variant: "destructive", title: t('toast.error_title'), description: t('toast.info_save_error_desc') });
        }
    };

    if (!user || isLoading) {
         return <div className="flex h-screen w-full items-center justify-center">{t('common.loading')}</div>;
    }
    
    return (
        <div className="flex flex-col min-h-screen bg-muted/40">
            <header className="sticky top-0 z-10 flex items-center h-16 px-4 border-b bg-background">
                <Button variant="ghost" size="icon" onClick={() => router.push('/passenger/request-ride')}>
                    <X className="h-5 w-5" />
                </Button>
                <h1 className="text-lg font-semibold mx-auto">Conta</h1>
                <div className="w-8"></div>
            </header>
            <main className="flex-1 py-6 container mx-auto px-4 pb-24">
                <div className="flex flex-col items-center text-center">
                    <Avatar className="h-28 w-28 border-4 border-background shadow-md">
                        <AvatarImage src={profileData.photoUrl || undefined} data-ai-hint="person avatar" />
                        <AvatarFallback>
                            <User className="h-12 w-12 text-muted-foreground" />
                        </AvatarFallback>
                    </Avatar>
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
                        <div>
                            <Label htmlFor="home">{t('profile.address.home')}</Label>
                            <Input id="home" value={profileData.homeAddress || ''} onChange={(e) => setProfileData({...profileData, homeAddress: e.target.value})} placeholder={t('profile.address.add_home')} disabled={!isEditingProfile} className={cn(!isEditingProfile && "bg-muted border-none")} />
                        </div>
                        <div>
                            <Label htmlFor="work">{t('profile.address.work')}</Label>
                            <Input id="work" value={profileData.workAddress || ''} onChange={(e) => setProfileData({...profileData, workAddress: e.target.value})} placeholder={t('profile.address.add_work')} disabled={!isEditingProfile} className={cn(!isEditingProfile && "bg-muted border-none")} />
                        </div>
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
            
            <Sheet open={isHistorySheetOpen} onOpenChange={setIsHistorySheetOpen}>
                <SheetContent className="w-full sm:max-w-md p-0">
                    <SheetHeader className="p-6 border-b">
                        <SheetTitle>{t('profile.history.title')}</SheetTitle>
                        <SheetDescription>Exibindo apenas o histórico de hoje. Para corridas anteriores, entre em contato com o suporte.</SheetDescription>
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
             <BottomNavBar role="passenger" />
        </div>
    );
}

export default withAuth(PassengerProfilePage, ["passenger"]);
