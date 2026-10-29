"use client";

import { Bot, Mail, Lock, Eye, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase";

function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    console.log(email, password);

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push("/");
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="view-login"
      className="h-full w-full flex items-center justify-center p-4 bg-[#212121] overflow-y-auto"
    >
      <div className="w-full max-w-md bg-[#171717] border border-dark-border rounded-2xl p-8 shadow-2xl my-auto">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#10a37f] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#10a37f]/10">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Welcome back
          </h2>
          <p className="text-sm text-[#b4b4b4] mt-1">
            Sign in to access your AI Assistant Workspace
          </p>
        </div>

        <form id="login-form" className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#b4b4b4] mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b4b4b4]">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                id="login-email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.smith@example.com"
                className="w-full bg-[#212121] border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#ececec] placeholder-[#676767] focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#b4b4b4]">
                Password
              </label>
              <a
                href="#"
                className="text-xs text-[#10a37f] hover:underline font-medium"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b4b4b4]">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                id="login-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#212121] border border-dark-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#ececec] placeholder-[#676767] focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#b4b4b4] hover:text-white"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="login-btn"
            className="w-full cursor-pointer py-3 px-4 bg-[#10a37f] hover:bg-[#0e8a6c] text-white font-medium rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span id="signup-btn-text">Login</span>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dark-border"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#171717] px-2 text-[#b4b4b4]">
              Or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#212121] hover:bg-[#2f2f2f] border border-dark-border rounded-xl text-xs font-medium text-[#ececec] transition">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google
          </button>
          <button className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#212121] hover:bg-[#2f2f2f] border border-dark-border rounded-xl text-xs font-medium text-[#ececec] transition">
            <i data-lucide="github" className="w-4 h-4"></i>
            GitHub
          </button>
        </div>

        <p className="text-center text-xs text-[#b4b4b4] mt-6">
          Don't have an account?
          <button
            onClick={() => router.push("/signup")}
            className="text-[#10a37f] font-semibold hover:underline ml-1"
          >
            Sign up
          </button>
        </p>
      </div>
    </section>
  );
}

export default LoginPage;
