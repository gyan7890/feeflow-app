"use client";

import { type ElementType, type FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Heart, LockKeyhole, Mail, ShieldCheck, X } from "lucide-react";
import { supabase } from "./lib/supabase";
import { getAppOrigin, initAndroidLinkInterceptor } from "./lib/android-native";
import { CompleteProfileScreen } from "./components/complete-profile-screen";
import { TeacherApp } from "./teacher-app";

type PlanName = "Free" | "Basic" | "Pro" | "Enterprise" | "1_month_trial";
type AuthMode = "login" | "signup";

export function FeeFlowLanding() {
  const [showSplash, setShowSplash] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanName>("Free");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authStatus, setAuthStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [authMessage, setAuthMessage] = useState("");
  const [teacher, setTeacher] = useState<User | null>(null);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [isProfileCompleted, setIsProfileCompleted] = useState<boolean | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [showResetSheet, setShowResetSheet] = useState(false);
  const [emailCooldownUntil, setEmailCooldownUntil] = useState(0);
  const [clockNow, setClockNow] = useState(0);

  const emailCooldownSeconds = Math.max(0, Math.ceil((emailCooldownUntil - clockNow) / 1000));

  function syncSelectedPlan(user?: User) {
    const plan = user?.user_metadata?.selected_plan;
    if (plan === "Free" || plan === "Basic" || plan === "Pro" || plan === "Enterprise" || plan === "1_month_trial") {
      setSelectedPlan(plan);
    }
  }

  async function checkTeacherProfile(user: User) {
    if (user.user_metadata?.profile_completed === true) {
      setIsProfileCompleted(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("teacher_profiles")
        .select("profile_completed, phone, institute_name, address")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        if (error.message.includes("schema cache") || error.message.includes("does not exist") || error.code === "42P01") {
          setIsProfileCompleted(true);
          return;
        }
      }

      if (data && data.profile_completed && data.institute_name && data.phone && data.address) {
        setIsProfileCompleted(true);
      } else if (data && (!data.institute_name || !data.phone || !data.address)) {
        setIsProfileCompleted(false);
      } else {
        setIsProfileCompleted(true);
      }
    } catch {
      setIsProfileCompleted(true);
    }
  }

  useEffect(() => {
    let mounted = true;

    // Parallel initialization: Fetch auth session while splash displays for 2.2 seconds
    const initTimer = setTimeout(() => {
      if (mounted) setShowSplash(false);
    }, 2200);

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const currentUser = data.session?.user ?? null;
      setTeacher(currentUser);
      setTeacherEmail(currentUser?.email ?? "");
      syncSelectedPlan(currentUser ?? undefined);
      if (currentUser) {
        void checkTeacherProfile(currentUser);
      } else {
        setIsProfileCompleted(null);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setTeacher(currentUser);
      setTeacherEmail(currentUser?.email ?? "");
      syncSelectedPlan(currentUser ?? undefined);
      if (currentUser) {
        void checkTeacherProfile(currentUser);
      } else {
        setIsProfileCompleted(null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(initTimer);
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const cleanup = initAndroidLinkInterceptor();
    return cleanup;
  }, []);

  useEffect(() => {
    if (emailCooldownUntil <= clockNow) return;

    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setClockNow(currentTime);
      if (emailCooldownUntil <= currentTime) {
        setEmailCooldownUntil(0);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [clockNow, emailCooldownUntil]);

  async function signInWithGoogle() {
    setAuthStatus("loading");
    setAuthMessage("");

    const appOrigin = getAppOrigin();

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: appOrigin,
        },
      });

      if (error) throw error;
    } catch (error) {
      setAuthStatus("error");
      const message = error instanceof Error ? error.message : "Google Sign-In failed.";
      setAuthMessage(friendlyAuthError(message));
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthStatus("loading");
    setAuthMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("fullName") ?? "").trim();
    const institute = String(formData.get("institute") ?? "").trim();

    if (!email || password.length < 6) {
      setAuthStatus("error");
      setAuthMessage("Enter an email and a password with at least 6 characters.");
      return;
    }

    const appOrigin = typeof window !== "undefined" && !window.location.origin.includes("localhost")
      ? window.location.origin
      : "https://iiiii-pi.vercel.app";

    try {
      const result =
        authMode === "signup"
          ? await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: appOrigin,
                data: {
                  full_name: fullName,
                  institute_name: institute,
                  selected_plan: "Free",
                  role: "teacher",
                  product: "FeeFlow",
                },
              },
            })
          : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      setAuthStatus("success");
      if (result.data.session?.user) {
        setTeacher(result.data.session.user);
        setTeacherEmail(result.data.session.user.email ?? email);
        setAuthMessage("Welcome back. Opening FeeFlow...");
        return;
      }

      setTeacher(null);
      setTeacherEmail("");
      setAuthMode("login");
      setAuthMessage("Account created. Confirm your email if required, then log in.");
    } catch (error) {
      setAuthStatus("error");
      const message = error instanceof Error ? error.message : "Authentication failed. Please try again.";
      if (isEmailRateLimit(message)) {
        setEmailCooldownUntil(Date.now() + 60_000);
        setClockNow(Date.now());
      }
      setAuthMessage(friendlyAuthError(message));
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = resetEmail.trim().toLowerCase();

    if (!email) {
      setAuthStatus("error");
      setAuthMessage("Enter your FeeFlow email to receive a reset link.");
      return;
    }

    if (emailCooldownSeconds > 0) {
      setAuthStatus("error");
      setAuthMessage(`Email limit reached. Please wait ${emailCooldownSeconds}s before trying again.`);
      return;
    }

    const appOrigin = getAppOrigin();

    setAuthStatus("loading");
    setAuthMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: appOrigin,
    });
    setAuthStatus(error ? "error" : "success");
    if (error && isEmailRateLimit(error.message)) {
      setEmailCooldownUntil(Date.now() + 60_000);
      setClockNow(Date.now());
    }
    setAuthMessage(error ? friendlyAuthError(error.message) : "Password reset link sent to your email.");
    if (!error) {
      setShowResetSheet(false);
      setResetEmail("");
      setEmailCooldownUntil(Date.now() + 60_000);
      setClockNow(Date.now());
    }
  }

  async function signOutTeacher() {
    await supabase.auth.signOut();
    setTeacher(null);
    setTeacherEmail("");
    setAuthStatus("idle");
    setAuthMessage("");
  }

  return (
    <AnimatePresence mode="wait">
      {/* 1. REDESIGNED NATIVE MOBILE SPLASH SCREEN */}
      {showSplash ? (
        <SplashScreen key="splash-screen" />
      ) : teacher ? (
        isProfileCompleted === false ? (
          <CompleteProfileScreen
            key="complete-profile"
            user={teacher}
            onComplete={() => setIsProfileCompleted(true)}
          />
        ) : (
          /* 2. AUTHENTICATED DASHBOARD */
          <TeacherApp key="teacher-app" email={teacherEmail} plan={selectedPlan} onSignOut={signOutTeacher} />
        )
      ) : (
        /* 3. LANDING / LOGIN SCREEN */
        <motion.main
          key="auth-landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-indigo-500 selection:text-white"
        >
          {/* Mobile Container Frame */}
          <section className="relative mx-auto flex min-h-screen max-w-[430px] flex-col overflow-hidden bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.2rem+env(safe-area-inset-top))] shadow-[0_0_80px_rgba(15,23,42,0.08)] border-x border-slate-100 justify-between">
            
            {/* Soft Ambient Radial Background Blurs */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_15%_0%,rgba(99,102,241,0.12),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.1),transparent_40%),radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.08),transparent_40%)]" />

            <div>
              {/* Top App Icon & Header */}
              <div className="relative mt-6 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="mx-auto flex size-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-2xl shadow-indigo-500/25 ring-8 ring-slate-50"
                >
                  <span
                    className="block size-full rounded-[22px] bg-cover bg-center bg-white shadow-inner"
                    style={{ backgroundImage: "url('/icons/app-icon-192.png')" }}
                    aria-hidden
                  />
                </motion.div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
                  Fee<span className="text-indigo-600">Flow</span>
                </h1>
                <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Tuition Fee Management • Pro
                </p>
              </div>

              {/* White Auth Glass Card */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="relative mt-7 rounded-3xl bg-white p-5 shadow-2xl shadow-slate-900/5 ring-1 ring-slate-100 border border-slate-100/80"
              >
                {/* Header Row */}
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900">
                      {authMode === "signup" ? "Create Teacher Account" : "Welcome Back"}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {authMode === "signup" ? "Start managing your student fees easily" : "Sign in to access your FeeFlow records"}
                    </p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <ShieldCheck size={20} />
                  </span>
                </div>

                {/* Login / Sign Up Toggle Pill Tabs */}
                <div className="relative mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                  {(["login", "signup"] as const).map((mode) => {
                    const isActive = authMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setAuthMode(mode);
                          setAuthMessage("");
                        }}
                        className={`relative min-h-11 rounded-xl text-xs font-black capitalize transition-all duration-200 ${
                          isActive ? "text-white" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="authTabPill"
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md shadow-indigo-500/20"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">{mode === "signup" ? "Sign Up" : "Login"}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Google Sign-In Button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={authStatus === "loading"}
                  className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 text-xs font-black text-slate-800 shadow-sm hover:bg-slate-50/80 transition active:scale-98 disabled:opacity-60 cursor-pointer"
                >
                  <svg className="size-5 shrink-0" viewBox="0 0 24 24">
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
                  <span>Continue with Google</span>
                </motion.button>

                {/* Divider */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="w-full border-t border-slate-100" />
                  <span className="absolute bg-white px-3 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
                    or continue with email
                  </span>
                </div>

                {/* Email / Password Form Fields */}
                <form onSubmit={submitAuth} className="space-y-3.5">
                  {authMode === "signup" && (
                    <>
                      <MobileInput name="fullName" label="Teacher Name" placeholder="Rahul Sharma" />
                      <MobileInput name="institute" label="Institute Name" placeholder="BrightPath Classes" />
                    </>
                  )}

                  <MobileInput name="email" type="email" label="Email Address" placeholder="teacher@classes.com" Icon={Mail} required />
                  <MobileInput name="password" type="password" label="Password" placeholder="Minimum 6 characters" Icon={LockKeyhole} required />

                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.98 }}
                    disabled={authStatus === "loading"}
                    className="mt-2 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-5 text-sm font-black text-white shadow-xl shadow-indigo-500/25 transition disabled:opacity-60 cursor-pointer"
                  >
                    {authStatus === "loading" ? "Please wait..." : authMode === "signup" ? "Create Free Account" : "Sign In to Dashboard"}
                    <ArrowRight size={18} />
                  </motion.button>
                </form>

                {/* Forgot Password Link */}
                <button
                  type="button"
                  onClick={() => {
                    setShowResetSheet(true);
                    setAuthMessage("");
                  }}
                  className="mt-4 min-h-10 w-full text-xs font-black text-indigo-600 hover:underline"
                >
                  {emailCooldownSeconds > 0 ? `Try again in ${emailCooldownSeconds}s` : "Forgot Password?"}
                </button>

                {/* Status Message */}
                {authMessage && (
                  <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-3 rounded-2xl px-4 py-3 text-xs font-bold border ${
                      authStatus === "success"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {authMessage}
                  </motion.p>
                )}
              </motion.div>
            </div>

            {/* Developed by Gyan Ranjan Footer Credit */}
            <div className="mt-8 text-center pb-2">
              <p className="text-xs font-bold text-slate-500 flex items-center justify-center gap-1.5">
                Developed with <Heart size={13} className="text-rose-500 fill-rose-500 inline-block" /> by <span className="font-black text-slate-900">Gyan Ranjan</span>
              </p>
            </div>

            {/* Reset Password Bottom Sheet */}
            <AnimatePresence>
              {showResetSheet && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-slate-900/40 px-4 pb-4 backdrop-blur-sm"
                >
                  <motion.form
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    onSubmit={resetPassword}
                    className="w-full rounded-3xl bg-white p-5 shadow-2xl border border-slate-100"
                  >
                    <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-200" />
                    <div className="flex items-center justify-between">
                      <p className="text-[0.68rem] font-black uppercase tracking-wider text-indigo-600">Account Recovery</p>
                      <button type="button" onClick={() => setShowResetSheet(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={18} />
                      </button>
                    </div>
                    <h2 className="mt-1 text-xl font-black text-slate-900">Reset Password</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Enter your teacher email and FeeFlow will send a secure reset link.
                    </p>

                    <label className="mt-4 block text-xs font-bold text-slate-700">
                      Email Address
                      <span className="mt-1.5 flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-100">
                        <Mail size={18} className="text-slate-400 shrink-0" />
                        <input
                          type="email"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="teacher@classes.com"
                          className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                        />
                      </span>
                    </label>

                    <motion.button
                      type="submit"
                      whileTap={{ scale: 0.98 }}
                      disabled={authStatus === "loading"}
                      className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-xs font-black text-white shadow-md shadow-indigo-500/20 disabled:opacity-60 cursor-pointer"
                    >
                      Send Reset Link
                    </motion.button>
                  </motion.form>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </motion.main>
      )}
    </AnimatePresence>
  );
}

{/* REDESIGNED NATIVE MOBILE SPLASH SCREEN (ANDROID & MATERIAL DESIGN 3 ALIGNED) */}
function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex min-h-screen w-full items-center justify-center bg-slate-950 text-white select-none overflow-hidden"
    >
      {/* Native Mobile Container Shell (430px max width for desktop preview, 100% viewport on mobile devices) */}
      <div className="relative flex min-h-screen w-full max-w-[430px] flex-col justify-between overflow-hidden bg-slate-950 px-6 py-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))] shadow-[0_0_90px_rgba(0,0,0,0.8)] border-x border-slate-900/60">
        
        {/* Animated Multi-Layer Gradient Background (#5B5FEF, #7C3AED, #00D4FF) */}
        <motion.div
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-br from-[#5B5FEF] via-[#7C3AED] to-[#00D4FF] opacity-90 bg-[length:200%_200%]"
        />

        {/* Blurred Floating Ambient Gradient Orbs */}
        <motion.div
          animate={{
            x: [-30, 40, -30],
            y: [-20, 30, -20],
            scale: [1, 1.25, 1],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-20 -top-20 size-80 rounded-full bg-[#00D4FF]/35 blur-[70px]"
        />
        <motion.div
          animate={{
            x: [40, -30, 40],
            y: [30, -20, 30],
            scale: [1.1, 0.9, 1.1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -bottom-20 -right-20 size-96 rounded-full bg-[#7C3AED]/45 blur-[80px]"
        />
        <motion.div
          animate={{
            scale: [0.9, 1.15, 0.9],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute size-72 rounded-full bg-[#5B5FEF]/40 blur-[60px]"
        />

        {/* Top spacer */}
        <div aria-hidden />

        {/* Center Section: Floating 110px Glass Card + Inter Bold Typography */}
        <div className="relative z-10 flex flex-col items-center text-center my-auto">
          {/* Floating Glassmorphic Logo Card (110px) */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: [0, -10, 0] }}
            transition={{
              scale: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.6 },
              y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            }}
            className="group relative flex size-[110px] items-center justify-center rounded-[32px] bg-white/20 p-1 backdrop-blur-2xl border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.25)] ring-1 ring-white/30"
          >
            <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-white/30 to-transparent opacity-60" />
            <span
              className="relative z-10 block size-full rounded-[28px] bg-cover bg-center shadow-inner"
              style={{ backgroundImage: "url('/icons/app-icon-512.png')" }}
            />
          </motion.div>

          {/* FeeFlow Title & Tagline */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
            className="mt-6 font-inter text-[34px] font-black tracking-tight text-white drop-shadow-md"
          >
            Fee<span className="text-[#00D4FF]">Flow</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
            className="mt-1.5 text-xs font-medium text-white/85 tracking-wide max-w-[240px]"
          >
            Manage Tuition Fees Effortlessly
          </motion.p>
        </div>

        {/* Bottom Section: Android Material Design 3 3-Dot Pulse Loading & Developer Credit */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Animated 3-Dot Loading Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex items-center gap-2 rounded-full bg-black/15 px-4 py-2 backdrop-blur-md border border-white/10"
          >
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                animate={{
                  scale: [0.8, 1.3, 0.8],
                  opacity: [0.35, 1, 0.35],
                }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: dot * 0.2,
                  ease: "easeInOut",
                }}
                className="size-2 rounded-full bg-white shadow-xs"
              />
            ))}
          </motion.div>

          {/* Developer Credit */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-[0.68rem] font-bold text-white/70 tracking-wider flex items-center gap-1"
          >
            Developed with <Heart size={11} className="text-rose-400 fill-rose-400 inline-block" /> by Gyan Ranjan
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

function MobileInput({
  name,
  label,
  placeholder,
  type = "text",
  required = false,
  Icon,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  Icon?: ElementType;
}) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}
      <span className="mt-1.5 flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 px-4 transition focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-100">
        {Icon && <Icon size={18} className="text-slate-400 shrink-0" />}
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400"
        />
      </span>
    </label>
  );
}

function isEmailRateLimit(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("rate limit") || lower.includes("email rate limit exceeded") || lower.includes("too many requests");
}

function friendlyAuthError(message: string) {
  if (isEmailRateLimit(message)) {
    return "Security cooldown active: Supabase has paused email requests for 60 seconds. Please wait or log in with password.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Incorrect email or password. Please check your credentials.";
  }
  return message;
}
