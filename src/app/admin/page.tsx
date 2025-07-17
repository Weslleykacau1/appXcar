
"use client";

import { useState, useEffect, useRef } from "react";
import { withAuth } from "@/components/with-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Car, DollarSign, ShieldCheck, MoreHorizontal, FileCheck2, AlertCircle, X, Check, FileText, Settings, Save, UserPlus, Moon, ThumbsUp, ThumbsDown, Trash2, UserX, Edit, User as UserIcon, Shield, ListVideo, Zap, Upload } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MapGL, { Marker } from 'react-map-gl';
import { useTheme } from 'next-themes';
import { getItem, setItem } from "@/lib/storage";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, writeBatch } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { RideRequestsDrawer } from "@/components/ride-requests-drawer";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { executiveCarImage, viagemCarImage } from "@/lib/images";


type UserRole = "passageiro" | "motorista" | "admin";
type UserStatus = "Ativo" | "Suspenso";
type VerificationStatus = "Verificado" | "Pendente" | "Rejeitado";
type TimePeriod = "total" | "7d" | "15d" | "30d";
type RideCategory = "comfort" | "executive";


interface User {
  id: string; // Firestore document ID (which should be the same as Firebase Auth UID)
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  joined: string;
  verification: VerificationStatus;
  vehicle_model?: string;
  vehicle_license_plate?: string;
  vehicle_color?: string;
  vehicle_year?: string;
}

const userFormSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor, insira um email válido." }),
  password: z.string().min(8, { message: "A senha deve ter pelo menos 8 caracteres." }).optional().or(z.literal('')),
  role: z.enum(["passageiro", "motorista", "admin"], {
    required_error: "Você precisa selecionar um perfil.",
  }),
  vehicleModel: z.string().optional(),
  vehicleLicensePlate: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehicleYear: z.string().optional(),
});


const initialRevenueData = [
  { name: "Jan", total: 0 },
  { name: "Fev", total: 0 },
  { name: "Mar", total: 0 },
  { name: "Abr", total: 0 },
  { name: "Mai", total: 0 },
  { name: "Jun", total: 0 },
  { name: "Jul", total: 0 },
  { name: "Ago", total: 0 },
  { name: "Set", total: 0 },
  { name: "Out", total: 0 },
  { name: "Nov", total: 0 },
  { name: "Dez", total: 0 },
];

const roleTranslations: { [key in UserRole]: string } = {
  passageiro: "Passageiro",
  motorista: "Motorista",
  admin: "Admin",
};

const roleIcons: { [key in UserRole]: React.ReactNode } = {
  passageiro: <UserIcon className="h-5 w-5" />,
  motorista: <Car className="h-5 w-5" />,
  admin: <Shield className="h-5 w-5" />,
};


const verificationIcons: { [key in VerificationStatus]: React.ReactNode } = {
    "Verificado": <FileCheck2 className="h-5 w-5 text-green-500" />,
    "Pendente": <AlertCircle className="h-5 w-5 text-yellow-500" />,
    "Rejeitado": <AlertCircle className="h-5 w-5 text-red-500" />,
};

const ADMIN_FARES_CONFIG_KEY = 'admin_fares_config';

const defaultFares = {
    comfort: {
        baseFare: "3.50",
        costPerMinute: "0.45",
        costPerKm: "1.50",
        bookingFee: "2.00",
        stopFee: "1.00",
        imageUrl: viagemCarImage
    },
    executive: {
        baseFare: "2.50",
        costPerMinute: "0.30",
        costPerKm: "1.20",
        bookingFee: "2.00",
        stopFee: "1.00",
        imageUrl: executiveCarImage
    }
};

function AdminDashboard() {
  const [revenueData, setRevenueData] = useState(initialRevenueData);
  const [users, setUsers] = useState<User[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [isEndRidesDialogOpen, setIsEndRidesDialogOpen] = useState(false);
  const [fares, setFares] = useState(defaultFares);
  const { toast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("total");
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingRidesCount, setPendingRidesCount] = useState(0);

  const comfortFileInputRef = useRef<HTMLInputElement>(null);
  const executiveFileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "passageiro",
      vehicleModel: "",
      vehicleLicensePlate: "",
      vehicleColor: "",
      vehicleYear: "",
    },
  });

  const watchedRole = form.watch("role");

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
        const usersCollection = collection(db, "profiles");
        const usersSnapshot = await getDocs(usersCollection);
        const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(usersList);
    } catch (error) {
        console.error("Error fetching users:", error);
        toast({
            variant: "destructive",
            title: "Erro ao carregar usuários",
            description: "Não foi possível buscar os dados do Firestore.",
        });
    } finally {
        setIsLoading(false);
    }
  };
  
  useEffect(() => {
    setIsDarkMode(theme === 'dark');
    fetchUsers();

    const q = query(collection(db, "rides"), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        setPendingRidesCount(querySnapshot.size);
    });

    const savedFares = getItem(ADMIN_FARES_CONFIG_KEY);
    if (savedFares) {
        setFares(savedFares as any);
    }
    
    return () => unsubscribe();
  }, [theme]);

  useEffect(() => {
    const generateRandomData = (multiplier: number) => {
        return initialRevenueData.map(item => ({
            ...item,
            total: (Math.floor(Math.random() * 5000) + 1000) * multiplier
        }));
    };
    
    let dataMultiplier = 1;
    if (selectedPeriod === '7d') dataMultiplier = 0.25;
    if (selectedPeriod === '15d') dataMultiplier = 0.5;
    if (selectedPeriod === '30d') dataMultiplier = 0.8;
    
    setRevenueData(generateRandomData(dataMultiplier));
    
    const activeDrivers = users
        .filter(u => u.role === 'motorista' && u.status === 'Ativo')
        .map(driver => ({
            id: driver.id,
            name: driver.name,
            lat: -3.7327 + (Math.random() - 0.5) * 0.05,
            lng: -38.5267 + (Math.random() - 0.5) * 0.05,
        }));
    setOnlineDrivers(activeDrivers);

    const interval = setInterval(() => {
        setOnlineDrivers(drivers => 
            drivers.map(driver => ({
                ...driver,
                lat: driver.lat + (Math.random() - 0.5) * 0.001,
                lng: driver.lng + (Math.random() - 0.5) * 0.001,
            }))
        );
    }, 3000);

    return () => clearInterval(interval);

  }, [users, selectedPeriod]);

  const handleThemeChange = (checked: boolean) => {
    const newTheme = checked ? 'dark' : 'light';
    setTheme(newTheme);
    setIsDarkMode(checked);
  };

  const handleOpenDocuments = (user: User) => {
    if (user.role === 'admin') {
         toast({
            variant: "default",
            title: "Não aplicável",
            description: "Administradores não possuem documentos para verificação.",
        });
        return;
    }
    setSelectedUser(user);
    setIsDocsModalOpen(true);
  };
  
  const handleVerification = async (userId: string, newStatus: VerificationStatus) => {
    try {
        const userDocRef = doc(db, "profiles", userId);
        await updateDoc(userDocRef, { verification: newStatus });
        fetchUsers(); // Refresh users list from Firestore
        setIsDocsModalOpen(false);
        toast({
            title: "Status de verificação atualizado!",
            description: `O usuário foi marcado como ${newStatus.toLowerCase()}.`,
        });
    } catch (error) {
        console.error("Error updating verification status:", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar o status." });
    }
  };

  const handleFareChange = (e: React.ChangeEvent<HTMLInputElement>, category: 'comfort' | 'executive', field: string) => {
    setFares(prev => ({
        ...prev,
        [category]: {
            ...prev[category],
            [field]: e.target.value
        }
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, category: RideCategory) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
             setFares(prev => ({
                ...prev,
                [category]: {
                    ...prev[category],
                    imageUrl: reader.result as string
                }
            }));
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSaveFares = () => {
    setItem(ADMIN_FARES_CONFIG_KEY, fares);
    toast({
      title: "Tarifas Salvas!",
      description: `As novas configurações de tarifas foram salvas.`,
    });
  };
  
  const handleAddUserSubmit = async (values: z.infer<typeof userFormSchema>) => {
    if (!values.password) {
        toast({ variant: "destructive", title: "Erro", description: "A senha é obrigatória para novos usuários." });
        return;
    }
    try {
        // This is a temporary auth instance for user creation, to avoid conflicts with logged-in admin
        const { user: newUser } = await createUserWithEmailAndPassword(auth, values.email, values.password);

        const newUserProfile = {
            name: values.name,
            email: values.email,
            role: values.role,
            status: "Ativo",
            joined: new Date().toISOString().split('T')[0],
            verification: "Verificado" // Admin-created users are auto-verified
        };

        await setDoc(doc(db, "profiles", newUser.uid), newUserProfile);
        
        fetchUsers(); // Refresh list from firestore
        setIsAddUserModalOpen(false);
        form.reset();
        toast({
            title: "Usuário Adicionado!",
            description: `${values.name} foi adicionado ao sistema.`,
        });
    } catch (error: any) {
        console.error("Error creating user:", error);
        toast({
            variant: "destructive",
            title: "Erro ao criar usuário",
            description: error.code === 'auth/email-already-in-use' ? "Este e-mail já está em uso." : error.message,
        });
    }
  };

  const handleOpenEditModal = (user: User) => {
    setSelectedUser(user);
    form.reset({
      name: user.name,
      email: user.email,
      role: user.role,
      password: "", // Clear password field
      vehicleModel: user.vehicle_model || "",
      vehicleLicensePlate: user.vehicle_license_plate || "",
      vehicleColor: user.vehicle_color || "",
      vehicleYear: user.vehicle_year || "",
    });
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUserSubmit = async (values: z.infer<typeof userFormSchema>) => {
    if (!selectedUser) return;
    
    try {
        const userDocRef = doc(db, "profiles", selectedUser.id);
        
        const dataToUpdate: any = {
            name: values.name,
            email: values.email,
            role: values.role,
        };

        if (values.role === 'motorista') {
            dataToUpdate.vehicle_model = values.vehicleModel;
            dataToUpdate.vehicle_license_plate = values.vehicleLicensePlate;
            dataToUpdate.vehicle_color = values.vehicleColor;
            dataToUpdate.vehicle_year = values.vehicleYear;
        }

        await updateDoc(userDocRef, dataToUpdate);

        fetchUsers(); // Refresh list from firestore
        setIsEditUserModalOpen(false);
        setSelectedUser(null);
        form.reset();
        toast({
            title: "Usuário Atualizado!",
            description: `Os dados de ${values.name} foram atualizados.`,
        });
    } catch (error) {
        console.error("Error updating user:", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar os dados." });
    }
  };
  
  const handleOpenDeleteModal = (user: User) => {
    setSelectedUser(user);
    setIsDeleteUserModalOpen(true);
  };

  const handleDeleteUser = async () => {
     if (!selectedUser) return;
     try {
        // Note: This only deletes the Firestore profile.
        // Deleting from Firebase Auth requires Admin SDK on a backend.
        const userDocRef = doc(db, "profiles", selectedUser.id);
        await deleteDoc(userDocRef);

        fetchUsers(); // Refresh list from firestore
        setIsDeleteUserModalOpen(false);
        setSelectedUser(null);

        toast({
            title: "Usuário Excluído!",
            description: "O perfil do usuário foi removido do sistema.",
            variant: "destructive",
        });
    } catch (error) {
         console.error("Error deleting user:", error);
         toast({ variant: "destructive", title: "Erro", description: "Não foi possível excluir o perfil." });
    }
  };
  
  const handleToggleSuspendUser = async (user: User) => {
    const newStatus = user.status === "Ativo" ? "Suspenso" : "Ativo";
    try {
        const userDocRef = doc(db, "profiles", user.id);
        await updateDoc(userDocRef, { status: newStatus });
        fetchUsers(); // Refresh list from firestore
        toast({
          title: `Status de ${user.name} atualizado!`,
          description: `O usuário agora está ${newStatus.toLowerCase()}.`,
        });
    } catch (error) {
         console.error("Error updating user status:", error);
         toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar o status." });
    }
  };

  const handleEndAllRides = async () => {
      try {
        const ridesRef = collection(db, 'rides');
        const q = query(ridesRef, where('status', 'in', ['pending', 'accepted', 'arrived']));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({ title: 'Nenhuma corrida ativa', description: 'Não há corridas para encerrar.' });
            setIsEndRidesDialogOpen(false);
            return;
        }

        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => {
            batch.update(doc.ref, { status: 'cancelled' });
        });

        await batch.commit();

        toast({
            title: 'Sucesso!',
            description: `${querySnapshot.size} corridas ativas foram encerradas.`,
        });
      } catch (error) {
        console.error('Error ending all rides:', error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível encerrar as corridas.' });
      } finally {
        setIsEndRidesDialogOpen(false);
      }
  };


  const mapStyle = resolvedTheme === 'dark' 
    ? 'mapbox://styles/mapbox/dark-v11' 
    : 'mapbox://styles/mapbox/streets-v12';

  const totalRevenue = revenueData.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <AppLayout>
      <TooltipProvider>
      <div className="container mx-auto py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Painel do Administrador</h2>
           <RadioGroup
            defaultValue="total"
            onValueChange={(value: string) => setSelectedPeriod(value as TimePeriod)}
            className="grid grid-cols-4 gap-2 rounded-lg bg-muted p-1 text-center text-sm w-full max-w-sm"
            >
                <Label htmlFor="r1" className={`cursor-pointer rounded-md p-2 transition-colors ${selectedPeriod === 'total' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}>Total</Label>
                <RadioGroupItem value="total" id="r1" className="sr-only" />
                
                <Label htmlFor="r2" className={`cursor-pointer rounded-md p-2 transition-colors ${selectedPeriod === '7d' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}>7d</Label>
                <RadioGroupItem value="7d" id="r2" className="sr-only" />

                <Label htmlFor="r3" className={`cursor-pointer rounded-md p-2 transition-colors ${selectedPeriod === '15d' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}>15d</Label>
                <RadioGroupItem value="15d" id="r3" className="sr-only" />

                <Label htmlFor="r4" className={`cursor-pointer rounded-md p-2 transition-colors ${selectedPeriod === '30d' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}>30d</Label>
                <RadioGroupItem value="30d" id="r4" className="sr-only" />
            </RadioGroup>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">Usuários cadastrados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Motoristas Online</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onlineDrivers.length}</div>
              <p className="text-xs text-muted-foreground">Em tempo real</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                 {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-xs text-muted-foreground">Período selecionado</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins Ativos</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.filter(u => u.role === 'admin' && u.status === 'Ativo').length}</div>
              <p className="text-xs text-muted-foreground">Administradores do Sistema</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <CardTitle>Gerenciamento de Usuários</CardTitle>
                        <CardDescription>Visualize, edite e gerencie todos os usuários no sistema.</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full sm:w-auto">
                                    <Zap className="mr-2 h-4 w-4"/>
                                    Ações do Sistema
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                 <DropdownMenuItem onClick={() => setIsEndRidesDialogOpen(true)}>
                                    <X className="mr-2 h-4 w-4" />
                                    Encerrar Corridas Ativas
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                         <Button variant="outline" onClick={() => setIsDrawerOpen(true)} className="w-full sm:w-auto">
                            <ListVideo className="mr-2 h-4 w-4" />
                            Corridas em Tempo Real
                            {pendingRidesCount > 0 && (
                                <Badge variant="destructive" className="ml-2 animate-pulse">{pendingRidesCount}</Badge>
                            )}
                         </Button>
                        <Dialog open={isAddUserModalOpen} onOpenChange={(isOpen) => { setIsAddUserModalOpen(isOpen); if (!isOpen) form.reset(); }}>
                            <DialogTrigger asChild>
                                <Button className="w-full sm:w-auto">
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Adicionar Usuário
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                                    <DialogDescription>
                                        Preencha os detalhes abaixo para criar uma nova conta de usuário.
                                    </DialogDescription>
                                </DialogHeader>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(handleAddUserSubmit)} className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nome Completo</FormLabel>
                                                <FormControl>
                                                <Input placeholder="Ex: João da Silva" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="email"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                <Input type="email" placeholder="Ex: joao.silva@example.com" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="password"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Senha</FormLabel>
                                                <FormControl>
                                                <Input type="password" {...field} required/>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="role"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Função</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Selecione um perfil" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="passageiro">Passageiro</SelectItem>
                                                        <SelectItem value="motorista">Motorista</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                        <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
                                            <DialogClose asChild>
                                                <Button type="button" variant="outline" className="w-full sm:w-auto">Cancelar</Button>
                                            </DialogClose>
                                            <Button type="submit" className="w-full sm:w-auto">Criar Usuário</Button>
                                        </DialogFooter>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Perfil</TableHead>
                        <TableHead className="text-center">Ações Pendentes</TableHead>
                        <TableHead><span className="sr-only">Menu</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                 <AvatarFallback className="bg-muted text-muted-foreground">
                                      {roleIcons[user.role]}
                                 </AvatarFallback>
                              </Avatar>
                              <div>
                                  <div className="font-medium">{user.name}</div>
                                  <div className="text-sm text-muted-foreground">{user.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                                  <TooltipTrigger>
                                      <Badge variant={user.status === 'Ativo' ? 'secondary' : 'destructive'}>
                                          {user.status}
                                      </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p>{user.status}</p>
                                  </TooltipContent>
                              </Tooltip>
                          </TableCell>
                          <TableCell className="text-center">
                              <Badge variant={user.role === 'admin' ? 'default' : user.role === 'motorista' ? 'secondary' : 'outline'}>
                                  {roleTranslations[user.role as UserRole] || user.role}
                              </Badge>
                          </TableCell>
                          <TableCell>
                              {user.verification === 'Pendente' && user.role !== 'admin' ? (
                                  <div className="flex gap-2 justify-center">
                                      <Button size="sm" variant="destructive" onClick={() => handleVerification(user.id, 'Rejeitado')}>
                                          <ThumbsDown className="mr-2 h-4 w-4"/> Rejeitar
                                      </Button>
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleVerification(user.id, 'Verificado')}>
                                        <ThumbsUp className="mr-2 h-4 w-4"/> Aprovar
                                      </Button>
                                  </div>
                              ) : (
                                  <div className="text-center text-muted-foreground">-</div>
                              )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Abrir menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenDocuments(user)}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Ver Documentos
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenEditModal(user)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleToggleSuspendUser(user)}>
                                    <UserX className="mr-2 h-4 w-4" />
                                    <span>{user.status === "Ativo" ? "Suspender" : "Reativar"}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleOpenDeleteModal(user)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Excluir
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                 {/* Mobile Cards */}
                 <div className="grid gap-4 md:hidden">
                    {users.map((user) => (
                        <Card key={user.id} className="p-4 space-y-4">
                             <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarFallback className="bg-muted text-muted-foreground">
                                            {roleIcons[user.role]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-medium">{user.name}</div>
                                        <div className="text-sm text-muted-foreground">{user.email}</div>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Abrir menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleOpenDocuments(user)}>
                                            <FileText className="mr-2 h-4 w-4" />
                                            Ver Documentos
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleOpenEditModal(user)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleToggleSuspendUser(user)}>
                                        <UserX className="mr-2 h-4 w-4" />
                                        <span>{user.status === "Ativo" ? "Suspender" : "Reativar"}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleOpenDeleteModal(user)}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Excluir
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <Separator/>
                             <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">Status:</span>
                                    <Badge variant={user.status === 'Ativo' ? 'secondary' : 'destructive'}>
                                        {user.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                     <span className="font-medium">Perfil:</span>
                                     <Badge variant={user.role === 'admin' ? 'default' : user.role === 'motorista' ? 'secondary' : 'outline'}>
                                        {roleTranslations[user.role as UserRole] || user.role}
                                    </Badge>
                                </div>
                            </div>
                            <Separator/>
                            {user.verification === 'Pendente' && user.role !== 'admin' ? (
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <p className="font-medium text-sm w-full sm:w-auto text-center sm:text-left mb-2 sm:mb-0">Ações Pendentes:</p>
                                    <div className="flex gap-2 w-full">
                                        <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleVerification(user.id, 'Rejeitado')}>
                                            <ThumbsDown className="mr-2 h-4 w-4"/> Rejeitar
                                        </Button>
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 flex-1" onClick={() => handleVerification(user.id, 'Verificado')}>
                                            <ThumbsUp className="mr-2 h-4 w-4"/> Aprovar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground text-sm">- Sem ações pendentes -</div>
                            )}
                        </Card>
                    ))}
                 </div>
              </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <div>
                        <CardTitle>Motoristas Online</CardTitle>
                        <CardDescription>Localização dos motoristas em tempo real.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="h-[460px] w-full relative rounded-b-lg overflow-hidden">
                        {mapboxToken ? (
                            <MapGL
                                mapboxAccessToken={mapboxToken}
                                initialViewState={{
                                longitude: -38.5267,
                                latitude: -3.7327,
                                zoom: 12
                                }}
                                style={{ width: '100%', height: '100%' }}
                                mapStyle={mapStyle}
                            >
                                {onlineDrivers.map(driver => (
                                    <Marker key={driver.id} longitude={driver.lng} latitude={driver.lat}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-lg cursor-pointer">
                                                    <Car className="h-5 w-5 text-primary"/>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{driver.name}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </Marker>
                                ))}
                            </MapGL>
                        ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                                <p className="text-muted-foreground text-center p-4">
                                O token do Mapbox não está configurado.
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Receita Mensal</CardTitle>
                    <CardDescription>Visão geral da receita nos últimos meses.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={revenueData}>
                            <XAxis
                                dataKey="name"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `R$${value / 1000}k`}
                            />
                            <RechartsTooltip
                                cursor={{ fill: 'hsl(var(--muted))' }}
                                contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                                    formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                            />
                            <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Tarifas por Categoria</CardTitle>
                        <CardDescription>Defina os valores e imagem para cada categoria de viagem.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <Accordion type="single" collapsible className="w-full" defaultValue="comfort">
                            <AccordionItem value="comfort">
                                <AccordionTrigger>Comfort</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-4">
                                     <div className="space-y-2">
                                        <Label>Imagem da Categoria</Label>
                                        <div className="flex items-center gap-4">
                                             <Image src={fares.comfort.imageUrl || 'https://placehold.co/100x50.png'} alt="Comfort" width={100} height={50} className="rounded-md border bg-muted aspect-[2/1] object-contain" />
                                             <Input type="file" ref={comfortFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, 'comfort')} />
                                             <Button variant="outline" size="sm" onClick={() => comfortFileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4"/>Alterar</Button>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="comfort-base-fare">Tarifa Base (R$)</Label>
                                        <Input id="comfort-base-fare" type="number" value={fares.comfort.baseFare} onChange={(e) => handleFareChange(e, 'comfort', 'baseFare')} step="0.01" />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="comfort-cost-min">Custo/Min (R$)</Label>
                                        <Input id="comfort-cost-min" type="number" value={fares.comfort.costPerMinute} onChange={(e) => handleFareChange(e, 'comfort', 'costPerMinute')} step="0.01" />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="comfort-cost-km">Custo/KM (R$)</Label>
                                        <Input id="comfort-cost-km" type="number" value={fares.comfort.costPerKm} onChange={(e) => handleFareChange(e, 'comfort', 'costPerKm')} step="0.01" />
                                    </div>
                                     <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="comfort-stop-fee">Taxa/Parada (R$)</Label>
                                        <Input id="comfort-stop-fee" type="number" value={fares.comfort.stopFee} onChange={(e) => handleFareChange(e, 'comfort', 'stopFee')} step="0.01" />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="comfort-booking-fee">Taxa Reserva (R$)</Label>
                                        <Input id="comfort-booking-fee" type="number" value={fares.comfort.bookingFee} onChange={(e) => handleFareChange(e, 'comfort', 'bookingFee')} step="0.01" />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="executive">
                                <AccordionTrigger>Executive</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-4">
                                     <div className="space-y-2">
                                        <Label>Imagem da Categoria</Label>
                                        <div className="flex items-center gap-4">
                                             <Image src={fares.executive.imageUrl || 'https://placehold.co/100x50.png'} alt="Executive" width={100} height={50} className="rounded-md border bg-muted aspect-[2/1] object-contain" />
                                             <Input type="file" ref={executiveFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, 'executive')} />
                                             <Button variant="outline" size="sm" onClick={() => executiveFileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4"/>Alterar</Button>
                                        </div>
                                    </div>
                                    <Separator />
                                     <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="executive-base-fare">Tarifa Base (R$)</Label>
                                        <Input id="executive-base-fare" type="number" value={fares.executive.baseFare} onChange={(e) => handleFareChange(e, 'executive', 'baseFare')} step="0.01" />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="executive-cost-min">Custo/Min (R$)</Label>
                                        <Input id="executive-cost-min" type="number" value={fares.executive.costPerMinute} onChange={(e) => handleFareChange(e, 'executive', 'costPerMinute')} step="0.01" />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="executive-cost-km">Custo/KM (R$)</Label>
                                        <Input id="executive-cost-km" type="number" value={fares.executive.costPerKm} onChange={(e) => handleFareChange(e, 'executive', 'costPerKm')} step="0.01" />
                                    </div>
                                      <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="executive-stop-fee">Taxa/Parada (R$)</Label>
                                        <Input id="executive-stop-fee" type="number" value={fares.executive.stopFee} onChange={(e) => handleFareChange(e, 'executive', 'stopFee')} step="0.01" />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-4">
                                        <Label htmlFor="executive-booking-fee">Taxa Reserva (R$)</Label>
                                        <Input id="executive-booking-fee" type="number" value={fares.executive.bookingFee} onChange={(e) => handleFareChange(e, 'executive', 'bookingFee')} step="0.01" />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        <Button onClick={handleSaveFares} className="w-full mt-4">
                            <Save className="mr-2 h-4 w-4" /> Salvar Tarifas
                        </Button>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Configurações do Painel</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-start justify-between gap-4">
                            <Moon className="h-6 w-6 text-muted-foreground mt-1" />
                            <div className="flex-1">
                                <p className="font-medium">Modo Escuro</p>
                                <p className="text-sm text-muted-foreground">Alterne entre o tema claro e escuro</p>
                            </div>
                            <Switch
                                checked={isDarkMode}
                                onCheckedChange={handleThemeChange}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
       {selectedUser && (
            <Dialog open={isDocsModalOpen} onOpenChange={setIsDocsModalOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Documentos de {selectedUser.name}</DialogTitle>
                        <CardDescription>
                            Verifique os documentos enviados pelo usuário.
                             <Badge variant={selectedUser.verification === 'Verificado' ? 'secondary' : selectedUser.verification === 'Pendente' ? 'default' : 'destructive'} className="ml-2">
                                {selectedUser.verification}
                            </Badge>
                        </CardDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        {selectedUser.role === 'motorista' && (
                            <>
                                <div className="space-y-2">
                                    <h4 className="font-semibold">CNH (Carteira de Motorista)</h4>
                                     <a href="https://placehold.co/800x600.png" target="_blank" rel="noopener noreferrer">
                                        <Image src="https://placehold.co/800x600.png" data-ai-hint="document license" alt="CNH" width={800} height={600} className="rounded-lg border aspect-[4/3] object-cover" />
                                     </a>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold">CRLV (Documento do Veículo)</h4>
                                    <a href="https://placehold.co/800x600.png" target="_blank" rel="noopener noreferrer">
                                        <Image src="https://placehold.co/800x600.png" data-ai-hint="document registration" alt="CRLV" width={800} height={600} className="rounded-lg border aspect-[4/3] object-cover" />
                                    </a>
                                </div>
                            </>
                        )}
                        {selectedUser.role === 'passageiro' && (
                            <div className="space-y-2">
                                <h4 className="font-semibold">Documento de Identidade</h4>
                                 <a href="https://placehold.co/800x600.png" target="_blank" rel="noopener noreferrer">
                                     <Image src="https://placehold.co/800x600.png" data-ai-hint="document id" alt="Documento" width={800} height={600} className="rounded-lg border aspect-[4/3] object-cover" />
                                 </a>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="sm:justify-between flex-col-reverse sm:flex-row gap-2">
                         <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Fechar
                            </Button>
                        </DialogClose>
                       <div className="flex gap-2">
                             <Button type="button" variant="destructive" onClick={() => handleVerification(selectedUser.id, 'Rejeitado')}>
                                <X className="mr-2 h-4 w-4" /> Rejeitar
                            </Button>
                            <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={() => handleVerification(selectedUser.id, 'Verificado')}>
                                <Check className="mr-2 h-4 w-4" /> Aprovar
                            </Button>
                       </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
        <Dialog open={isEditUserModalOpen} onOpenChange={(isOpen) => { setIsEditUserModalOpen(isOpen); if (!isOpen) form.reset(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Editar Usuário</DialogTitle>
                    <DialogDescription>
                        Atualize os detalhes do usuário. A alteração de senha deve ser feita pelo usuário.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleUpdateUserSubmit)} className="space-y-4">
                         <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nome Completo</FormLabel>
                                <FormControl>
                                <Input placeholder="Ex: João da Silva" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                <Input type="email" placeholder="Ex: joao.silva@example.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Função</FormLabel>
                                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um perfil" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="passageiro">Passageiro</SelectItem>
                                        <SelectItem value="motorista">Motorista</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        {watchedRole === 'motorista' && (
                            <>
                                <Separator />
                                <h4 className="font-semibold text-foreground">Detalhes do Veículo</h4>
                                <FormField
                                    control={form.control}
                                    name="vehicleModel"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Modelo do Veículo</FormLabel>
                                        <FormControl>
                                        <Input placeholder="Ex: Toyota Corolla" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="vehicleLicensePlate"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Placa</FormLabel>
                                        <FormControl>
                                        <Input placeholder="Ex: BRA2E19" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="vehicleColor"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cor</FormLabel>
                                        <FormControl>
                                        <Input placeholder="Ex: Prata" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="vehicleYear"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ano</FormLabel>
                                        <FormControl>
                                        <Input placeholder="Ex: 2023" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </>
                        )}
                         <DialogFooter className="pt-4">
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancelar</Button>
                            </DialogClose>
                            <Button type="submit">Salvar Alterações</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
        <Dialog open={isDeleteUserModalOpen} onOpenChange={setIsDeleteUserModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Você tem certeza?</DialogTitle>
                    <DialogDescription>
                        Essa ação não pode ser desfeita. Isso irá excluir permanentemente o perfil de <span className="font-bold">{selectedUser?.name}</span> do banco de dados.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleDeleteUser} variant="destructive">
                        Sim, excluir usuário
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <AlertDialog open={isEndRidesDialogOpen} onOpenChange={setIsEndRidesDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Encerrar todas as corridas ativas?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação definirá o status de todas as corridas 'pending', 'accepted' ou 'arrived' para 'cancelled'. Isso é útil para fins de teste.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEndAllRides} className="bg-destructive hover:bg-destructive/90">
                        Sim, encerrar corridas
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <RideRequestsDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
      </TooltipProvider>
    </AppLayout>
  );
}

export default withAuth(AdminDashboard, ["admin"]);

    

    

