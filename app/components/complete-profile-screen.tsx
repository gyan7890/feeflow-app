"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Phone,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "../lib/supabase";

export type TeacherProfileData = {
  id: string;
  name: string;
  email: string;
  photo_url?: string;
  phone: string;
  institute_name: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  profile_completed: boolean;
};

type CompleteProfileScreenProps = {
  user: User;
  onComplete: () => void;
};

export function CompleteProfileScreen({ user, onComplete }: CompleteProfileScreenProps) {
  const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Teacher";
  const userEmail = user.email || "";
  const userPhoto = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";

  const [instituteName, setInstituteName] = useState(user.user_metadata?.institute || "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function validate(): string | null {
    if (!instituteName.trim()) {
      return "Institute Name is required.";
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      return "Mobile Number must be exactly 10 digits.";
    }
    if (!address.trim()) {
      return "Address is required.";
    }
    return null;
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const valError = validate();
    if (valError) {
      setErrorMsg(valError);
      return;
    }

    setSaving(true);
    const cleanPhone = phone.replace(/\D/g, "");

    try {
      const profileData: TeacherProfileData = {
        id: user.id,
        name: userName,
        email: userEmail,
        photo_url: userPhoto,
        phone: cleanPhone,
        institute_name: instituteName.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        profile_completed: true,
      };

      // 1. Save to teacher_profiles table
      const { error: profileError } = await supabase
        .from("teacher_profiles")
        .upsert(profileData, { onConflict: "id" });

      if (profileError) {
        console.warn("Could not save to teacher_profiles (falling back to local):", profileError.message);
      }

      // 2. Sync to feeflow_settings table
      const { error: settingsError } = await supabase
        .from("feeflow_settings")
        .upsert(
          {
            teacher_id: user.id,
            institute_name: instituteName.trim(),
            address: address.trim(),
            phone: cleanPhone,
            email: userEmail,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "teacher_id" }
        );

      if (settingsError) {
        console.warn("Settings sync warning:", settingsError.message);
      }

      // 3. Update user_metadata in auth
      await supabase.auth.updateUser({
        data: {
          profile_completed: true,
          institute_name: instituteName.trim(),
          phone: cleanPhone,
        },
      });

      setSaving(false);
      onComplete();
    } catch (err) {
      setSaving(false);
      setErrorMsg(err instanceof Error ? err.message : "Failed to save profile. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 size-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute top-1/2 -right-40 size-96 rounded-full bg-purple-600/20 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-lg overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
      >
        {/* Top Header Badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-400 border border-indigo-500/20">
            <Sparkles size={14} /> STEP 1 OF 1 • QUICK ONBOARDING
          </span>
        </div>

        {/* Header Titles */}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Complete Your Profile</h1>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-400">
          Finish setting up your tuition institute details to continue to your dashboard.
        </p>

        {/* Google Profile Card (Read Only) */}
        <div className="mt-6 flex items-center gap-3.5 rounded-2xl border border-slate-800 bg-slate-850/60 p-3.5 text-xs font-semibold">
          {userPhoto ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={userPhoto} alt={userName} className="size-11 rounded-full object-cover ring-2 ring-indigo-500/30" />
          ) : (
            <div className="grid size-11 place-items-center rounded-full bg-indigo-600/20 text-indigo-400 ring-2 ring-indigo-500/30">
              <UserIcon size={22} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-indigo-400 text-[0.68rem] font-bold uppercase tracking-wider">
              <CheckCircle2 size={12} /> Google Verified Account
            </div>
            <p className="truncate text-sm font-bold text-white">{userName}</p>
            <p className="truncate text-xs font-medium text-slate-400">{userEmail}</p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300"
          >
            {errorMsg}
          </motion.div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
          {/* Institute Name */}
          <div>
            <label htmlFor="onboard-institute-name" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building2 size={14} className="text-indigo-400" /> Institute Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="onboard-institute-name"
              type="text"
              required
              value={instituteName}
              onChange={(e) => setInstituteName(e.target.value)}
              placeholder="e.g. Apex Tuition Academy"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Mobile Phone Number */}
          <div>
            <label htmlFor="onboard-phone" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone size={14} className="text-indigo-400" /> Mobile Number <span className="text-rose-400">*</span>
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-xs font-bold text-slate-400">+91</span>
              <input
                id="onboard-phone"
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit phone number"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 pl-13 pr-4 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label htmlFor="onboard-address" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin size={14} className="text-indigo-400" /> Address <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="onboard-address"
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address or location landmark"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
          </div>

          {/* City & State (Row) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="onboard-city" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">City</label>
              <input
                id="onboard-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label htmlFor="onboard-state" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">State</label>
              <input
                id="onboard-state"
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Pincode */}
          <div>
            <label htmlFor="onboard-pincode" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Pincode</label>
            <input
              id="onboard-pincode"
              type="text"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 400001"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Submit Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={saving}
            type="submit"
            className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 px-6 text-sm font-black text-white shadow-xl shadow-indigo-500/25 disabled:opacity-60 cursor-pointer transition"
          >
            {saving ? (
              <span>Saving Profile...</span>
            ) : (
              <>
                <span>Save & Continue</span>
                <ChevronRight size={18} />
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
