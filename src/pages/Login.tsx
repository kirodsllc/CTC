import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock, Mail, Store, User, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [adminEmail, setAdminEmail] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [storeEmail, setStoreEmail] = useState("");
    const [storePassword, setStorePassword] = useState("");
    const navigate = useNavigate();

    const handleLogin = (role: 'admin' | 'store') => {
        setIsLoading(true);

        // Simulate API call with hardcoded credentials
        setTimeout(() => {
            setIsLoading(false);

            if (role === 'admin') {
                if (adminEmail === "ctc@admin.com" && adminPassword === "ctc123456") {
                    localStorage.setItem("userRole", "admin");
                    toast.success("Login Successful - Administrator Access Granted");
                    navigate("/");
                } else {
                    toast.error("Invalid credentials. Please use the authorized admin account.");
                }
            } else {
                if (storeEmail === "ctc@store.com" && storePassword === "ctc123456") {
                    localStorage.setItem("userRole", "store");
                    toast.success("Login Successful - Store Access Granted");
                    navigate("/store");
                } else {
                    toast.error("Invalid credentials. Please use the authorized store account.");
                }
            }
        }, 1200);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-sans">
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 z-0 scale-105 animate-pulse-slow"
                style={{
                    backgroundImage: 'url("/login-bg.png")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            />
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-950/90 via-slate-900/70 to-primary/20 backdrop-blur-[2px]" />

            {/* Animated Background Shapes */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-float" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] animate-float-delayed" />

            <div className="z-10 w-full max-w-[440px] px-6 py-12">
                <div className="text-center mb-10 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-orange-600 mb-6 shadow-2xl shadow-primary/40 ring-4 ring-white/10 group hover:scale-110 transition-transform duration-500">
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 drop-shadow-md">
                        Dev Koncepts
                    </h1>
                    <div className="h-1 w-20 bg-primary mx-auto rounded-full mb-4 shadow-glow-primary" />
                    <p className="text-slate-300 text-lg font-medium opacity-90">
                        Inventory Management Evolution
                    </p>
                </div>

                <Card className="border-white/10 shadow-3xl bg-slate-900/40 backdrop-blur-2xl backdrop-saturate-150 animate-slide-up overflow-hidden">
                    <Tabs defaultValue="admin" className="w-full">
                        <CardHeader className="pb-0 text-center">
                            <TabsList className="grid w-full grid-cols-2 mb-6 p-1 bg-slate-800/50 border border-white/5 rounded-xl">
                                <TabsTrigger
                                    value="admin"
                                    className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white transition-all duration-300"
                                >
                                    <User className="w-4 h-4 mr-2" />
                                    Admin
                                </TabsTrigger>
                                <TabsTrigger
                                    value="store"
                                    className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white transition-all duration-300"
                                >
                                    <Store className="w-4 h-4 mr-2" />
                                    Store
                                </TabsTrigger>
                            </TabsList>
                            <CardTitle className="text-2xl font-bold text-white mb-1">Welcome back</CardTitle>
                            <CardDescription className="text-slate-400">
                                Please enter your details to continue
                            </CardDescription>
                        </CardHeader>

                        <TabsContent value="admin" className="mt-0">
                            <form onSubmit={(e) => { e.preventDefault(); handleLogin('admin'); }}>
                                <CardContent className="space-y-5 pt-8">
                                    <div className="space-y-2.5">
                                        <Label htmlFor="admin-email" className="text-slate-200 ml-1">Email or Username</Label>
                                        <div className="relative group">
                                            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-primary" />
                                            <Input
                                                id="admin-email"
                                                type="email"
                                                placeholder="admin@koncepts.com"
                                                value={adminEmail}
                                                onChange={(e) => setAdminEmail(e.target.value)}
                                                className="pl-11 h-12 bg-slate-800/40 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary focus-visible:bg-slate-800/60 transition-all rounded-xl"
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between ml-1">
                                            <Label htmlFor="admin-password" title="Password" className="text-slate-200">Password</Label>
                                            <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold">
                                                Forgot password?
                                            </button>
                                        </div>
                                        <div className="relative group">
                                            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-primary" />
                                            <Input
                                                id="admin-password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={adminPassword}
                                                onChange={(e) => setAdminPassword(e.target.value)}
                                                className="pl-11 h-12 bg-slate-800/40 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary focus-visible:bg-slate-800/60 transition-all rounded-xl"
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3 pt-1 ml-1">
                                        <Checkbox id="admin-remember" className="border-white/20 data-[state=checked]:bg-primary" />
                                        <label
                                            htmlFor="admin-remember"
                                            className="text-sm font-medium leading-none text-slate-400 cursor-pointer hover:text-slate-300 transition-colors"
                                        >
                                            Remember me for 30 days
                                        </label>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col pt-4 pb-10">
                                    <Button
                                        type="submit"
                                        className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Authenticating...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                Sign In <ArrowRight className="w-5 h-5" />
                                            </div>
                                        )}
                                    </Button>
                                </CardFooter>
                            </form>
                        </TabsContent>

                        <TabsContent value="store" className="mt-0">
                            <form onSubmit={(e) => { e.preventDefault(); handleLogin('store'); }}>
                                <CardContent className="space-y-5 pt-8">
                                    <div className="space-y-2.5">
                                        <Label htmlFor="store-email" className="text-slate-200 ml-1">Store Email</Label>
                                        <div className="relative group">
                                            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-primary" />
                                            <Input
                                                id="store-email"
                                                type="email"
                                                placeholder="store@koncepts.com"
                                                value={storeEmail}
                                                onChange={(e) => setStoreEmail(e.target.value)}
                                                className="pl-11 h-12 bg-slate-800/40 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary focus-visible:bg-slate-800/60 transition-all rounded-xl"
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between ml-1">
                                            <Label htmlFor="store-password" title="Access PIN" className="text-slate-200">Access PIN</Label>
                                            <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold">
                                                Get PIN Support
                                            </button>
                                        </div>
                                        <div className="relative group">
                                            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-primary" />
                                            <Input
                                                id="store-password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={storePassword}
                                                onChange={(e) => setStorePassword(e.target.value)}
                                                className="pl-11 h-12 bg-slate-800/40 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary focus-visible:bg-slate-800/60 transition-all rounded-xl"
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3 pt-1 ml-1">
                                        <Checkbox id="store-remember" className="border-white/20 data-[state=checked]:bg-primary" />
                                        <label
                                            htmlFor="store-remember"
                                            className="text-sm font-medium leading-none text-slate-400 cursor-pointer hover:text-slate-300 transition-colors"
                                        >
                                            Remember this terminal
                                        </label>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col pt-4 pb-10">
                                    <Button
                                        type="submit"
                                        className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Authenticating...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                Access Store <ArrowRight className="w-5 h-5" />
                                            </div>
                                        )}
                                    </Button>
                                </CardFooter>
                            </form>
                        </TabsContent>
                    </Tabs>
                </Card>

                <div className="text-center mt-10 animate-fade-in delay-500">
                    <p className="text-sm text-slate-400 mb-2">
                        Professional Inventory Solutions
                    </p>
                    <div className="flex items-center justify-center gap-4 text-slate-500 text-xs">
                        <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
                        <div className="w-1 h-1 bg-slate-700 rounded-full" />
                        <a href="#" className="hover:text-slate-300 transition-colors">Terms of Service</a>
                        <div className="w-1 h-1 bg-slate-700 rounded-full" />
                        <a href="#" className="hover:text-slate-300 transition-colors">Support</a>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1.05); opacity: 0.9; }
          50% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(30px) scale(0.95); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-pulse-slow { animation: pulse-slow 20s ease-in-out infinite; }
        .animate-float { animation: float 15s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 18s ease-in-out infinite; }
        .animate-fade-in { animation: fade-in 1s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .shadow-glow-primary { box-shadow: 0 0 15px 2px hsl(var(--primary) / 40%); }
      `}} />
        </div>
    );
};

export default Login;
