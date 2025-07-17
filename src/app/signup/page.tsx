
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Car, User, ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, UserRole } from "@/context/auth-context";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor, insira um email válido." }),
  password: z.string().min(8, { message: "A senha deve ter pelo menos 8 caracteres." }),
  role: z.enum(["passenger", "driver"], {
    required_error: "Você precisa selecionar um perfil.",
  }),
  terms: z.boolean().refine(val => val === true, {
    message: "Você deve aceitar os termos e a política de privacidade.",
  }),
});

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      terms: false,
    },
    mode: "onChange",
  });

  const role = form.watch("role");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      
      if (userCredential.user) {
        const user = userCredential.user;
        
        // Create a comprehensive user profile with placeholders
        await setDoc(doc(db, "profiles", user.uid), {
          name: values.name,
          email: values.email,
          role: values.role,
          status: 'Ativo',
          verification: 'Pendente',
          phone: '',
          cpf: '',
          photoUrl: '',
          cnhUrl: '', // for drivers
          crlvUrl: '', // for drivers
          identityDocumentUrl: '', // for passengers
          addressProofUrl: '',
          homeAddress: '',
          workAddress: '',
          savedLocations: [],
          vehicle_model: '',
          vehicle_license_plate: '',
          vehicle_color: '',
          vehicle_year: '',
        });
        
        toast({
          title: "Cadastro realizado!",
          description: "Agora, por favor, envie seus documentos para verificação.",
        });
        router.push(`/signup/documents?role=${values.role}&userId=${user.uid}`);

      }
    } catch (error: any) {
       if (error.code === 'auth/email-already-in-use') {
         toast({
            variant: "destructive",
            title: "Erro no Cadastro",
            description: "Este e-mail já está em uso. Por favor, faça o login.",
        });
        router.push('/login');
       } else {
         toast({
            variant: "destructive",
            title: "Erro no Cadastro",
            description: error.message || "Ocorreu um erro. Por favor, tente novamente.",
          });
       }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={() => router.push('/')}>
            <ArrowLeft />
        </Button>
        <div className="text-center mb-8">
            <Car className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-4xl font-bold text-primary mt-2">Criar Conta</h1>
            <p className="text-muted-foreground">Comece sua jornada com TriDriver.</p>
        </div>
        
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
               <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="space-y-3 pt-2">
                    <FormLabel>Eu sou...</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex gap-4"
                      >
                        <FormItem className="flex-1">
                          <RadioGroupItem value="passenger" id="passenger" className="sr-only" />
                          <FormLabel htmlFor="passenger" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                            <User className="mb-3 h-6 w-6" />
                            Passageiro
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex-1">
                          <RadioGroupItem value="driver" id="driver" className="sr-only" />
                           <FormLabel htmlFor="driver" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                            <Car className="mb-3 h-6 w-6" />
                            Motorista
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {role && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-4 duration-500">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Nome Completo" {...field} className="h-12 text-base" />
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
                        <FormControl>
                          <Input placeholder="Email" {...field} className="h-12 text-base" />
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
                        <FormControl>
                          <Input type="password" placeholder="Senha" {...field} className="h-12 text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="terms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Aceitar termos e condições
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Eu concordo com a nossa{" "}
                            <Link href="#" className="underline hover:text-primary">
                              Política de Privacidade
                            </Link>{" "}
                            e{" "}
                            <Link href="#" className="underline hover:text-primary">
                              Termos de Uso
                            </Link>
                            .
                          </p>
                           <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                   <Button type="submit" className="w-full !mt-6 h-12 text-lg font-bold" disabled={!form.formState.isValid || isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting ? 'Cadastrando...' : 'Continuar com Email'}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        
        <div className="mt-8 text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Entrar
            </Link>
          </div>
      </div>
    </main>
  );
}
