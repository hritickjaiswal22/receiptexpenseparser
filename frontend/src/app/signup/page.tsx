"use client";

import { UserPlus, User, Mail, Lock, Eye, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase";

function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    console.log(email, password);

    try {
      setLoading(true);

      const { error } = await supabase.auth.signUp({
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
      id="view-signup"
      className="h-full w-full flex items-center justify-center p-4 bg-[#212121] overflow-y-auto"
    >
      <div className="w-full max-w-md bg-[#171717] border border-dark-border rounded-2xl p-8 shadow-2xl my-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#10a37f] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#10a37f]/10">
            <UserPlus className="w-6 h-6 text-white"></UserPlus>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Create an account
          </h2>
          <p className="text-sm text-[#b4b4b4] mt-1">
            Get started with your personal AI assistant
          </p>
        </div>

        <form id="signup-form" className="space-y-4" onSubmit={handleSignup}>
          {/* <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#b4b4b4] mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b4b4b4]">
                <User className="w-4 h-4"></User>
              </span>
              <input
                type="text"
                id="signup-name"
                required
                placeholder="Alex Smith"
                className="w-full bg-[#212121] border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#ececec] placeholder-[#676767] focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition"
              />
            </div>
          </div> */}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#b4b4b4] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b4b4b4]">
                <Mail className="w-4 h-4"></Mail>
              </span>
              <input
                type="email"
                id="signup-email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.smith@example.com"
                className="w-full bg-[#212121] border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#ececec] placeholder-[#676767] focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#b4b4b4] mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b4b4b4]">
                <Lock className="w-4 h-4"></Lock>
              </span>
              <input
                type="password"
                id="signup-password"
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
                <Eye id="signup-eye-icon" className="w-4 h-4"></Eye>
              </button>
            </div>

            {/* <div className="mt-2">
              <div className="flex justify-between items-center text-[10px] text-[#b4b4b4] mb-1">
                <span>
                  Strength:
                  <strong id="strength-label" className="text-[#b4b4b4]">
                    None
                  </strong>
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#212121] rounded-full overflow-hidden flex gap-1">
                <div
                  id="str-bar-1"
                  className="h-full w-1/3 bg-[#383838] transition-colors"
                ></div>
                <div
                  id="str-bar-2"
                  className="h-full w-1/3 bg-[#383838] transition-colors"
                ></div>
                <div
                  id="str-bar-3"
                  className="h-full w-1/3 bg-[#383838] transition-colors"
                ></div>
              </div>
            </div> */}
          </div>

          {/* <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#b4b4b4] mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b4b4b4]">
                <ShieldCheck className="w-4 h-4"></ShieldCheck>
              </span>
              <input
                type="password"
                id="signup-confirm-password"
                required
                placeholder="••••••••"
                className="w-full bg-[#212121] border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#ececec] placeholder-[#676767] focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition"
              />
            </div>
          </div> */}

          <button
            type="submit"
            id="signup-btn"
            className="w-full py-3 px-4 cursor-pointer bg-[#10a37f] hover:bg-[#0e8a6c] text-white font-medium rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span id="signup-btn-text">Create Account</span>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#b4b4b4] mt-6">
          Already have an account?
          <button
            onClick={() => router.push("/login")}
            className="text-[#10a37f] font-semibold hover:underline ml-1"
          >
            Log in
          </button>
        </p>
      </div>
    </section>
  );
}

export default SignupPage;
