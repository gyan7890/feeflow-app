"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Crown,
  ExternalLink,
  Gift,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";
import {
  activateOneMonthTrial,
  checkGooglePaySdkReady,
  launchPlayBillingPurchase,
  PLAY_BILLING_PRODUCTS,
  restorePlayBillingPurchases,
  SubscriptionPlanId,
} from "../lib/play-billing";

type PricingModalProps = {
  isOpen: boolean;
  teacherId: string;
  currentPlan: string;
  onClose: () => void;
  onSuccess: (plan: string, expiryDate?: string) => void;
};

export function PricingModal({
  isOpen,
  teacherId,
  onClose,
  onSuccess,
}: PricingModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>("1_month_trial");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [isGpayReady, setIsGpayReady] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void checkGooglePaySdkReady().then((ready) => setIsGpayReady(ready));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentProduct = PLAY_BILLING_PRODUCTS[selectedPlan] ?? PLAY_BILLING_PRODUCTS["1_month_trial"];

  async function handlePurchase() {
    setLoading(true);
    setStatusMessage(null);

    const result =
      selectedPlan === "1_month_trial"
        ? await activateOneMonthTrial(teacherId)
        : await launchPlayBillingPurchase(selectedPlan, teacherId);

    setLoading(false);

    if (result.status === "success") {
      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
        onSuccess(selectedPlan, result.expiryDate);
        onClose();
      }, 2500);
    } else if (result.status === "pending") {
      setStatusMessage({
        tone: "info",
        text: "Your purchase is pending approval from Google Play.",
      });
    } else if (result.status === "cancelled") {
      setStatusMessage({
        tone: "info",
        text: "Purchase cancelled. Select a plan when you are ready.",
      });
    } else {
      setStatusMessage({
        tone: "error",
        text: result.message || "Action failed. Please try again.",
      });
    }
  }

  async function handleRestore() {
    setRestoring(true);
    setStatusMessage(null);

    const result = await restorePlayBillingPurchases(teacherId);
    setRestoring(false);

    if (result.status === "restored" && result.planId) {
      setStatusMessage({
        tone: "success",
        text: "Active subscription restored!",
      });
      onSuccess(result.planId, result.expiryDate);
    } else {
      setStatusMessage({
        tone: "error",
        text: result.message || "No previous active subscription found.",
      });
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-md p-3 sm:p-4"
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="relative w-full max-w-[420px] max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-[32px] sm:rounded-[32px] bg-white p-5 sm:p-6 shadow-2xl border border-slate-100 text-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Crown size={18} />
              </span>
              <div>
                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                  <Gift size={12} /> 1 MONTH FREE TRIAL INCLUDED
                </span>
                <h2 className="text-base font-black text-slate-900">Unlock FeeFlow Pro</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-slate-100 p-2 text-slate-400 hover:text-slate-700 transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Subtitle */}
          <p className="mt-3 text-xs font-semibold text-slate-500 leading-relaxed">
            Get 30 days of full Pro access 100% free! Unlock unlimited students, automated WhatsApp reminders, and CSV report exports.
          </p>

          {/* Plan Cards Grid */}
          <div className="mt-4 grid gap-3">
            {(["1_month_trial", "pro_yearly", "pro_monthly"] as SubscriptionPlanId[]).map((planId) => {
              const product = PLAY_BILLING_PRODUCTS[planId];
              if (!product) return null;

              const isSelected = selectedPlan === planId;

              return (
                <button
                  type="button"
                  key={planId}
                  onClick={() => setSelectedPlan(planId)}
                  className={`relative w-full text-left cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20 shadow-md"
                      : "border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/50"
                  }`}
                >
                  {product.discountBadge && (
                    <span className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[0.62rem] font-black uppercase text-white shadow-xs ${
                      planId === "1_month_trial"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-500"
                        : "bg-gradient-to-r from-purple-600 to-pink-500"
                    }`}>
                      {product.discountBadge}
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                          }`}
                        >
                          {isSelected && <span className="size-1.5 rounded-full bg-white" />}
                        </span>
                        <h3 className="text-sm font-black text-slate-900">{product.title || product.name}</h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 pl-6">
                        {planId === "1_month_trial"
                          ? "Instant activation • No payment required"
                          : planId === "pro_yearly"
                          ? "Billed annually via Google Play • Best value"
                          : "Billed monthly via Google Play • Cancel anytime"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900">{product.price}</p>
                      <p className="text-[0.65rem] font-bold text-slate-400">{product.period || product.billingPeriod}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Feature Checklist */}
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Included in {currentProduct.title || currentProduct.name}:
            </p>
            <div className="space-y-2">
              {(currentProduct.features ?? []).map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-3 rounded-2xl px-4 py-2.5 text-xs font-bold border ${
                statusMessage.tone === "success"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : statusMessage.tone === "info"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {statusMessage.text}
            </motion.p>
          )}

          {/* Google Pay SDK Status Indicator */}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[0.68rem] font-bold text-slate-600 border border-slate-100">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 size={13} /> Google Play Billing v7.0 Ready
            </span>
            <span className="flex items-center gap-1 text-indigo-600">
              <CheckCircle2 size={13} /> {isGpayReady ? "Google Pay SDK Active" : "Google Pay & UPI Ready"}
            </span>
          </div>

          {/* CTA Action Buttons */}
          <div className="mt-4 space-y-2.5">
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              onClick={handlePurchase}
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-5 text-sm font-black text-white shadow-xl shadow-indigo-500/25 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <span>Activating Pro Access...</span>
              ) : selectedPlan === "1_month_trial" ? (
                <>
                  <Gift size={18} />
                  <span>Start 1-Month Free Trial Now</span>
                </>
              ) : (
                <>
                  <Zap size={18} />
                  <span>Subscribe with Google Play ({currentProduct.price})</span>
                </>
              )}
            </motion.button>

            <button
              disabled={restoring}
              onClick={handleRestore}
              className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-60 transition cursor-pointer"
            >
              <RefreshCw size={14} className={restoring ? "animate-spin" : ""} />
              <span>{restoring ? "Restoring..." : "Restore Previous Subscription"}</span>
            </button>
          </div>

          {/* Mandatory Google Play Disclosures & Legal Links */}
          <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3 text-[0.65rem] text-slate-500 border border-slate-100">
            <p className="font-medium leading-normal">
              Subscriptions automatically renew unless cancelled at least 24 hours before the current period ends. Managed securely by <strong>Google Play Billing</strong>.
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 font-bold text-indigo-600">
              <a
                href="https://play.google.com/store/account/subscriptions"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline flex items-center gap-1"
              >
                Manage Subscriptions <ExternalLink size={10} />
              </a>
              <div className="flex items-center gap-2">
                <a href="/privacy" target="_blank" className="hover:underline">Privacy Policy</a>
                <span>•</span>
                <a href="/terms" target="_blank" className="hover:underline">Terms</a>
              </div>
            </div>
          </div>

          {/* Success Activation Screen Overlay */}
          <AnimatePresence>
            {showSuccessOverlay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/98 p-6 text-center"
              >
                <div className="grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 shadow-xl mb-4">
                  <CheckCircle2 size={48} className="stroke-[2.5]" />
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700 border border-emerald-200">
                  {selectedPlan === "1_month_trial" ? "30-DAY TRIAL ACTIVATED" : "VERIFIED BY GOOGLE PLAY"}
                </span>
                <h3 className="mt-3 text-2xl font-black text-slate-900">
                  {selectedPlan === "1_month_trial" ? "1-Month Free Trial Active!" : "FeeFlow Pro Activated!"}
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500 max-w-xs">
                  {selectedPlan === "1_month_trial"
                    ? "Enjoy 30 days of full FeeFlow Pro features completely free!"
                    : "Your Google Play subscription has been verified. All premium features are unlocked!"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
