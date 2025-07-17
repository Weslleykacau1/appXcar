
"use client";

import Link from "next/link";
import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Car, Loader2, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { useAuth, UserRole } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";


const loginSchema = z.object({
  email: z.string().email({ message: "Por favor, insira um email válido." }),
  password: z.string().min(1, { message: "Senha é obrigatória." }),
  rememberMe: z.boolean().default(false).optional(),
});

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isSubmitting } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      form.setValue('email', rememberedEmail);
      form.setValue('rememberMe', true);
    }
  }, [form]);

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    if (values.rememberMe) {
        localStorage.setItem('rememberedEmail', values.email);
    } else {
        localStorage.removeItem('rememberedEmail');
    }
    const role = searchParams.get('role') as UserRole | undefined;
    login({ email: values.email, password: values.password }, role);
  };
  

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-foreground">
      <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={() => router.push('/')}>
            <ArrowLeft />
      </Button>
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <Car className="h-14 w-14 mb-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo de volta</h1>
        <p className="mt-2 text-muted-foreground">Faça login para continuar</p>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-4 mt-8">
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
              
              <div className="flex items-center justify-between">
                 <FormField
                    control={form.control}
                    name="rememberMe"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <FormLabel className="text-sm !mt-0 cursor-pointer">
                            Lembrar usuário
                        </FormLabel>
                        </FormItem>
                    )}
                 />

                <Link href="https://wa.me/5511912345678" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>

               <Button type="submit" className="w-full !mt-6 h-12 text-base font-semibold" disabled={isSubmitting}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 Entrar
               </Button>
            </form>
        </Form>
        
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Não tem uma conta?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Cadastre-se
          </Link>
        </div>
      </div>
    </main>
  );
}
