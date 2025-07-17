
"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { withAuth } from "@/components/with-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Edit, Save, Plus, X, Trash2, Home, Briefcase, MapPin } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useLanguage } from "@/context/language-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import type { SavedLocation, User as AuthUser } from "@/context/auth-context";
import { v4 as uuidv4 } from 'uuid';

type AddressType = 'home' | 'work';
type SheetState = {
    isOpen: boolean;
    type: AddressType | 'new' | 'edit-saved';
    location?: SavedLocation;
}

function AccountPageContent() {
    const router = useRouter();
    const { user, fetchUserProfile, logout } = useAuth();
    const { t } = useLanguage();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState<Partial<AuthUser>>({});
    const [sheetState, setSheetState] = useState<SheetState>({ isOpen: false, type: 'new' });
    const [addressForm, setAddressForm] = useState({ name: '', address: '' });

    const fetchUserData = async () => {
        if (!user) return;
        setIsLoading(true);
        const fullProfile = await fetchUserProfile(user);
        if (fullProfile) {
            setProfileData(fullProfile);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchUserData();
    }, [user]);
    
    const handleSaveProfile = async () => {
        if (!user) return;
        try {
            const docRef = doc(db, "profiles", user.id);
            await updateDoc(docRef, {
                name: profileData.name,
                email: profileData.email,
                phone: profileData.phone,
                homeAddress: profileData.homeAddress,
                workAddress: profileData.workAddress
            });
            toast({ title: t('toast.info_saved_title'), description: t('toast.info_saved_desc') });
            setIsEditing(false);
        } catch (error) {
            toast({ variant: "destructive", title: t('toast.error_title'), description: t('toast.info_save_error_desc') });
        }
    };
    
    const openAddressSheet = (type: SheetState['type'], location?: SavedLocation) => {
        setSheetState({ isOpen: true, type, location });
        if (type === 'home' && profileData.homeAddress) {
            setAddressForm({ name: 'Casa', address: profileData.homeAddress });
        } else if (type === 'work' && profileData.workAddress) {
            setAddressForm({ name: 'Trabalho', address: profileData.workAddress });
        } else if (type === 'edit-saved' && location) {
             setAddressForm({ name: location.name, address: location.address });
        } else {
            setAddressForm({ name: '', address: '' });
        }
    };
    
    const handleSaveAddress = async () => {
        if (!user || !addressForm.address) return;
        
        let updatePayload: Partial<AuthUser> = {};

        if (sheetState.type === 'home') {
            updatePayload.homeAddress = addressForm.address;
        } else if (sheetState.type === 'work') {
            updatePayload.workAddress = addressForm.address;
        } else if (sheetState.type === 'new') {
            const newLocation = { id: uuidv4(), name: addressForm.name, address: addressForm.address };
            updatePayload.savedLocations = [...(profileData.savedLocations || []), newLocation];
        } else if (sheetState.type === 'edit-saved' && sheetState.location) {
             updatePayload.savedLocations = profileData.savedLocations?.map(loc => 
                loc.id === sheetState.location?.id ? { ...loc, name: addressForm.name, address: addressForm.address } : loc
            );
        }

        try {
            const docRef = doc(db, "profiles", user.id);
            await updateDoc(docRef, updatePayload);
            await fetchUserData(); // Refresh data
            toast({ title: t('toast.address_saved_title') });
            setSheetState({ isOpen: false, type: 'new' });
        } catch (error) {
            toast({ variant: "destructive", title: t('toast.error_title'), description: t('toast.address_save_error_desc') });
        }
    };
    
    const handleRemoveSavedLocation = async (locationId: string) => {
        if (!user) return;
        
        const updatedLocations = profileData.savedLocations?.filter(loc => loc.id !== locationId);

        try {
            const docRef = doc(db, "profiles", user.id);
            await updateDoc(docRef, { savedLocations: updatedLocations });
            await fetchUserData(); // Refresh data
            toast({ title: t('toast.location_removed_title') });
        } catch(e) {
             toast({ variant: "destructive", title: t('toast.error_title'), description: t('toast.location_remove_error_desc') });
        }
    };


    const getSheetTitle = () => {
        switch (sheetState.type) {
            case 'home': return t('profile.address.edit_home_title');
            case 'work': return t('profile.address.edit_work_title');
            case 'new': return t('profile.address.add_new_title');
            case 'edit-saved': return t('profile.address.edit_saved_title');
        }
    }

    if (isLoading || !user) {
        return <div className="flex h-screen w-full items-center justify-center">{t('common.loading')}</div>;
    }

    return (
        <div className="flex flex-col min-h-screen bg-muted/40 text-foreground">
            <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 bg-background">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                 {isEditing ? (
                    <Button variant="ghost" size="sm" className="gap-1.5 text-primary" onClick={handleSaveProfile}>
                        <Save className="h-4 w-4"/> {t('common.save')}
                    </Button>
                 ) : (
                    <Button variant="ghost" size="sm" className="gap-1.5 text-primary" onClick={() => setIsEditing(true)}>
                        <Edit className="h-4 w-4"/> {t('common.edit')}
                    </Button>
                 )}
            </header>

            <main className="flex-1 py-6 container mx-auto px-4 pb-24">
                <Card className="mt-8">
                     <CardHeader>
                        <CardTitle>{t('profile.personal_info')}</CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="name">{t('profile.form.full_name')}</Label>
                            <Input id="name" value={profileData.name || ''} onChange={(e) => setProfileData({...profileData, name: e.target.value})} disabled={!isEditing} className={cn(!isEditing && "bg-muted border-none")} />
                        </div>
                        <div>
                            <Label htmlFor="email">{t('profile.form.email')}</Label>
                            <Input id="email" type="email" value={profileData.email || ''} onChange={(e) => setProfileData({...profileData, email: e.target.value})} disabled={!isEditing} className={cn(!isEditing && "bg-muted border-none")} />
                        </div>
                        <div>
                            <Label htmlFor="phone">{t('profile.form.phone')}</Label>
                            <Input id="phone" type="tel" value={profileData.phone || ''} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} disabled={!isEditing} className={cn(!isEditing && "bg-muted border-none")} />
                        </div>
                        <div>
                            <Label htmlFor="home">{t('profile.address.home')}</Label>
                            <Input id="home" value={profileData.homeAddress || ''} onChange={(e) => setProfileData({...profileData, homeAddress: e.target.value})} placeholder={t('profile.address.add_home')} disabled={!isEditing} className={cn(!isEditing && "bg-muted border-none")} />
                        </div>
                        <div>
                            <Label htmlFor="work">{t('profile.address.work')}</Label>
                            <Input id="work" value={profileData.workAddress || ''} onChange={(e) => setProfileData({...profileData, workAddress: e.target.value})} placeholder={t('profile.address.add_work')} disabled={!isEditing} className={cn(!isEditing && "bg-muted border-none")} />
                        </div>
                     </CardContent>
                </Card>

                <div className="mt-8">
                    <Button variant="destructive" className="w-full h-12" onClick={logout}>
                        {t('profile.logout_btn')}
                    </Button>
                </div>
            </main>
            
            <Sheet open={sheetState.isOpen} onOpenChange={(isOpen) => setSheetState({ ...sheetState, isOpen })}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>{getSheetTitle()}</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 space-y-4">
                         {(sheetState.type === 'new' || sheetState.type === 'edit-saved') && (
                            <div>
                                <Label htmlFor="location-name">{t('profile.address.location_name')}</Label>
                                <Input 
                                    id="location-name"
                                    value={addressForm.name}
                                    onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                                    placeholder={t('profile.address.location_name_placeholder')}
                                />
                            </div>
                         )}
                         <div>
                            <Label htmlFor="full-address">{t('profile.address.full_address')}</Label>
                             <Input 
                                id="full-address"
                                value={addressForm.address}
                                onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                                placeholder={t('profile.address.full_address_placeholder')}
                            />
                         </div>
                    </div>
                    <SheetFooter>
                        <SheetClose asChild>
                            <Button type="button" variant="outline">{t('common.cancel')}</Button>
                        </SheetClose>
                        <Button type="button" onClick={handleSaveAddress}>{t('common.save')}</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}


export default function AccountPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Carregando...</div>}>
            <withAuth>
                <AccountPageContent />
            </withAuth>
        </Suspense>
    );
}

