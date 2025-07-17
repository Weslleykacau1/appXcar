
"use client";

import { useState, useEffect, Suspense } from "react";
import { withAuth } from "@/components/with-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, User, HelpCircle, Activity, Wallet, Shield, CreditCard, Newspaper, Download, ChevronRight, X, Plus } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useAuth, User as AuthUser } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/context/language-context";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";


function ProfilePageContent() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const { toast } = useToast();
    const { t } = useLanguage();

    const [profileData, setProfileData] = useState({ name: '', email: '', photoUrl: '' });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) {
            setProfileData({
                name: user.name || '',
                email: user.email || '',
                photoUrl: user.photoUrl || '',
            });
            setIsLoading(false);
        }
    }, [user]);

    if (isLoading || !user) {
        return <div className="flex h-screen w-full items-center justify-center">{t('common.loading')}</div>;
    }

    return (
        <div className="flex flex-col min-h-screen bg-muted/40 text-foreground">
            <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 bg-background">
                <Button variant="ghost" size="icon" onClick={() => router.push('/passenger/request-ride')}>
                    <X className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon">
                    <Plus className="h-5 w-5" />
                </Button>
            </header>
            
            <main className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                           <AvatarImage src={profileData.photoUrl || undefined} data-ai-hint="person avatar" />
                            <AvatarFallback>{profileData.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-xl font-bold">{profileData.name}</h1>
                            <p className="text-sm text-muted-foreground">{profileData.email}</p>
                        </div>
                    </div>
                </div>

                <div className="px-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="p-4 flex flex-col items-start gap-2 cursor-pointer hover:bg-muted/80" onClick={() => router.push('/passenger/profile/account')}>
                            <User className="h-6 w-6 text-primary" />
                            <span className="font-semibold">Minha Conta</span>
                        </Card>
                         <Card className="p-4 flex flex-col items-start gap-2 cursor-pointer hover:bg-muted/80">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/><path d="M18 12h.01"/></svg>
                            <span className="font-semibold">Códigos de Desconto</span>
                        </Card>
                    </div>
                    <Card className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/80">
                        <HelpCircle className="h-6 w-6 text-primary" />
                        <span className="font-semibold">Ajuda</span>
                    </Card>
                </div>

                <div className="mt-6 border-t">
                    <ul className="divide-y">
                        <li className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/80" onClick={() => router.push('/passenger/profile?showHistory=true')}>
                           <div className="flex items-center gap-4">
                             <Activity className="h-6 w-6 text-muted-foreground" />
                             <span className="font-medium">Atividade</span>
                           </div>
                           <ChevronRight className="h-5 w-5 text-muted-foreground/50"/>
                        </li>
                         <li className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/80">
                           <div className="flex items-center gap-4">
                             <Wallet className="h-6 w-6 text-muted-foreground" />
                             <span className="font-medium">Métodos de Pagamento</span>
                           </div>
                           <ChevronRight className="h-5 w-5 text-muted-foreground/50"/>
                        </li>
                         <li className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/80">
                           <div className="flex items-center gap-4">
                             <Shield className="h-6 w-6 text-muted-foreground" />
                             <div>
                                <span className="font-medium">Segurança</span>
                                <div className="flex items-center gap-2">
                                     <p className="text-sm text-primary">Rever todos os recursos</p>
                                     <Badge className="bg-primary/20 text-primary hover:bg-primary/30">NOVO</Badge>
                                </div>
                             </div>
                           </div>
                           <ChevronRight className="h-5 w-5 text-muted-foreground/50"/>
                        </li>
                         <li className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/80">
                           <div className="flex items-center gap-4">
                             <CreditCard className="h-6 w-6 text-muted-foreground" />
                             <span className="font-medium">Crédito</span>
                           </div>
                           <ChevronRight className="h-5 w-5 text-muted-foreground/50"/>
                        </li>
                         <li className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/80">
                           <div className="flex items-center gap-4">
                             <Newspaper className="h-6 w-6 text-muted-foreground" />
                             <span className="font-medium">Notícias</span>
                           </div>
                           <ChevronRight className="h-5 w-5 text-muted-foreground/50"/>
                        </li>
                         <li className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/80">
                           <div className="flex items-center gap-4">
                             <Download className="h-6 w-6 text-muted-foreground" />
                             <span className="font-medium">Baixe o TriDriver para Motoristas</span>
                           </div>
                           <ChevronRight className="h-5 w-5 text-muted-foreground/50"/>
                        </li>
                    </ul>
                </div>
            </main>
            
            <footer className="p-6 text-center text-muted-foreground/60 space-y-2">
                <p className="font-bold text-lg text-primary">TriDriver</p>
                <p className="text-xs">Versão 8.196.0</p>
            </footer>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Carregando...</div>}>
            <ProfilePageContent />
        </Suspense>
    );
}
