"use client";

import { type ElementType, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  FileText,
  Gift,
  GraduationCap,
  Heart,
  Home,
  IndianRupee,
  Landmark,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { PricingModal } from "./components/pricing-modal";
import { supabase } from "./lib/supabase";

type PlanName = "Free" | "Basic" | "Pro" | "Enterprise" | "pro_monthly" | "pro_yearly" | "1_month_trial" | "trial";
type ViewName = "Dashboard" | "Students" | "Fee Collection" | "Payments" | "Pending Fees" | "Reports" | "Settings";
type StudentStatus = "active" | "archived";
type PaymentStatus = "paid" | "pending" | "partial" | "overdue";
type PaymentKind = "monthly" | "admission" | "extra" | "advance";
type PaymentMethod = "cash" | "upi" | "bank_transfer" | "card" | "other";
type ReminderKind = "friendly" | "due" | "final";

type TeacherAppProps = {
  email: string;
  plan: PlanName;
  onSignOut: () => void;
};

type Student = {
  id: string;
  teacher_id: string;
  photo_url: string | null;
  name: string;
  parent_name: string;
  mobile: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  class_name: string;
  monthly_fee: number;
  admission_date: string;
  status: StudentStatus;
  notes: string | null;
  created_at: string;
};

type Payment = {
  id: string;
  teacher_id: string;
  student_id: string;
  amount: number;
  discount: number;
  payment_kind: PaymentKind;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  paid_on: string;
  reference_number: string | null;
  collected_by: string;
  receipt_number: string;
  notes: string | null;
  created_at: string;
  student?: Pick<Student, "name" | "parent_name" | "mobile" | "monthly_fee">;
};

type Reminder = {
  id: string;
  teacher_id: string;
  student_id: string;
  reminder_type: ReminderKind;
  channel: "email" | "whatsapp" | "sms";
  message: string;
  status: "opened" | "sent_manually";
  opened_at: string;
  sent_manually_at: string | null;
  created_at: string;
  student?: Pick<Student, "name" | "parent_name" | "mobile">;
};

type InstituteSettings = {
  teacher_id: string;
  institute_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  receipt_template: string;
  reminder_template: string;
  theme: "light" | "dark";
};

type StudentFormState = {
  photo_url: string;
  name: string;
  parent_name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  address: string;
  class_name: string;
  monthly_fee: string;
  admission_date: string;
  notes: string;
};

type PaymentFormState = {
  student_id: string;
  amount: string;
  discount: string;
  payment_kind: PaymentKind;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  reference_number: string;
  collected_by: string;
  notes: string;
};

const defaultStudentForm: StudentFormState = {
  photo_url: "",
  name: "",
  parent_name: "",
  mobile: "",
  whatsapp: "",
  email: "",
  address: "",
  class_name: "",
  monthly_fee: "",
  admission_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

const defaultPaymentForm: PaymentFormState = {
  student_id: "",
  amount: "",
  discount: "0",
  payment_kind: "monthly",
  payment_status: "paid",
  payment_method: "cash",
  reference_number: "",
  collected_by: "",
  notes: "",
};

const cacheKey = (key: string, id: string) => `feeflow_cache_${key}_${id}`;

export function TeacherApp({ email, plan: initialPlan, onSignOut }: TeacherAppProps) {
  const [activeView, setActiveView] = useState<ViewName>("Dashboard");
  const [query, setQuery] = useState("");
  const [teacherId, setTeacherId] = useState("");

  // Stale-while-revalidate instant state initialization
  const [students, setStudents] = useState<Student[]>(() => {
    if (typeof window === "undefined") return [];
    const storedUser = localStorage.getItem("feeflow_last_teacher_id");
    if (!storedUser) return [];
    try {
      const cached = localStorage.getItem(cacheKey("students", storedUser));
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    if (typeof window === "undefined") return [];
    const storedUser = localStorage.getItem("feeflow_last_teacher_id");
    if (!storedUser) return [];
    try {
      const cached = localStorage.getItem(cacheKey("payments", storedUser));
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [reminders, setReminders] = useState<Reminder[]>([]);
  
  const [settings, setSettings] = useState<InstituteSettings | null>(() => {
    if (typeof window === "undefined") return null;
    const storedUser = localStorage.getItem("feeflow_last_teacher_id");
    if (!storedUser) return null;
    try {
      const cached = localStorage.getItem(cacheKey("settings", storedUser));
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [studentForm, setStudentForm] = useState<StudentFormState>(defaultStudentForm);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({ ...defaultPaymentForm, collected_by: email });
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [setupError, setSetupError] = useState("");
  const [pullStart, setPullStart] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  // Supabase Source-of-Truth Subscription State with local storage fallback
  const [activePlan, setActivePlan] = useState<string>(() => {
    if (typeof window === "undefined") return initialPlan || "Free";
    const storedUser = localStorage.getItem("feeflow_last_teacher_id");
    if (!storedUser) return initialPlan || "Free";
    return localStorage.getItem(cacheKey("plan", storedUser)) || initialPlan || "Free";
  });

  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const storedUser = localStorage.getItem("feeflow_last_teacher_id");
    if (!storedUser) return null;
    return localStorage.getItem(cacheKey("expiry", storedUser));
  });

  const [pricingModalOpen, setPricingModalOpen] = useState(false);

  const isProActive = useMemo(() => {
    if (!subscriptionExpiry) {
      return (
        activePlan === "Pro" ||
        activePlan === "pro_monthly" ||
        activePlan === "pro_yearly" ||
        activePlan === "1_month_trial" ||
        activePlan === "trial" ||
        activePlan === "Enterprise"
      );
    }
    const isNotExpired = new Date(subscriptionExpiry) > new Date();
    return (
      isNotExpired &&
      (activePlan === "Pro" ||
        activePlan === "pro_monthly" ||
        activePlan === "pro_yearly" ||
        activePlan === "1_month_trial" ||
        activePlan === "trial" ||
        activePlan === "Enterprise")
    );
  }, [activePlan, subscriptionExpiry]);

  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const filteredStudents = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return students;

    return students.filter((student) =>
      [student.name, student.parent_name, student.mobile, student.whatsapp, student.email, student.class_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, students]);

  const enrichedPayments = useMemo(
    () => payments.map((payment) => ({ ...payment, student: studentById.get(payment.student_id) })),
    [payments, studentById],
  );
  const monthlyCollected = payments
    .filter((payment) => isThisMonth(payment.paid_on) && payment.payment_status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const totalRevenue = payments.filter((payment) => payment.payment_status === "paid").reduce((sum, payment) => sum + payment.amount, 0);
  const todayCollection = payments
    .filter((payment) => payment.paid_on === new Date().toISOString().slice(0, 10) && payment.payment_status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pendingRows = students.map((student) => {
    const paidThisMonth = payments
      .filter((payment) => payment.student_id === student.id && isThisMonth(payment.paid_on) && payment.payment_status === "paid")
      .reduce((sum, payment) => sum + payment.amount + payment.discount, 0);
    return { student, pending: Math.max(student.monthly_fee - paidThisMonth, 0), paidThisMonth };
  });
  const pendingFees = pendingRows.reduce((sum, row) => sum + row.pending, 0);
  const reminderCount = reminders.length;
  const teacherName = useMemo(() => formatTeacherName(email), [email]);
  const pendingByStudentId = useMemo(() => new Map(pendingRows.map((row) => [row.student.id, row.pending])), [pendingRows]);

  const loadWorkspace = useCallback(async () => {
    if (students.length === 0 && payments.length === 0) {
      setLoading(true);
    }
    setSetupError("");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      await onSignOut();
      setLoading(false);
      return;
    }

    const userId = authData.user.id;
    setTeacherId(userId);
    if (typeof window !== "undefined") {
      localStorage.setItem("feeflow_last_teacher_id", userId);
    }

    // Parallel high-performance queries
    const [studentResult, paymentResult, reminderResult, settingsResult, subResult] = await Promise.all([
      supabase.from("feeflow_students").select("*").eq("teacher_id", userId).order("created_at", { ascending: false }),
      supabase.from("feeflow_payments").select("*").eq("teacher_id", userId).order("paid_on", { ascending: false }),
      supabase.from("feeflow_reminders").select("*").eq("teacher_id", userId).order("created_at", { ascending: false }),
      supabase.from("feeflow_settings").select("*").eq("teacher_id", userId).maybeSingle(),
      supabase.from("feeflow_subscriptions").select("*").eq("teacher_id", userId).order("expiry_date", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const firstError = studentResult.error ?? paymentResult.error ?? reminderResult.error ?? settingsResult.error;
    if (firstError) {
      setSetupError(
        firstError.message.includes("schema cache") || firstError.message.includes("does not exist")
          ? "FeeFlow database tables are not ready yet. Run supabase/setup.sql once in your Supabase SQL editor, then refresh the app."
          : firstError.message,
      );
      setLoading(false);
      return;
    }

    if (studentResult.data) {
      setStudents(studentResult.data as Student[]);
      localStorage.setItem(cacheKey("students", userId), JSON.stringify(studentResult.data));
    }
    if (paymentResult.data) {
      setPayments(paymentResult.data as Payment[]);
      localStorage.setItem(cacheKey("payments", userId), JSON.stringify(paymentResult.data));
    }
    if (reminderResult.data) {
      setReminders(reminderResult.data as Reminder[]);
    }
    if (settingsResult.data) {
      setSettings(settingsResult.data as InstituteSettings);
      localStorage.setItem(cacheKey("settings", userId), JSON.stringify(settingsResult.data));
    }

    // Subscription status update
    if (subResult.data) {
      const sub = subResult.data;
      const now = new Date();
      const expiryDate = new Date(sub.expiry_date);
      const isExpired = expiryDate <= now;

      if (sub.subscription_status === "active" && !isExpired) {
        setActivePlan(sub.plan);
        setSubscriptionExpiry(sub.expiry_date);
        setPricingModalOpen(false);
        localStorage.setItem(cacheKey("plan", userId), sub.plan);
        localStorage.setItem(cacheKey("expiry", userId), sub.expiry_date);
      } else {
        if (isExpired && sub.subscription_status === "active") {
          await supabase
            .from("feeflow_subscriptions")
            .update({ subscription_status: "expired", updated_at: now.toISOString() })
            .eq("id", sub.id);
        }
        setActivePlan("Free");
        setSubscriptionExpiry(null);
        localStorage.removeItem(cacheKey("plan", userId));
        localStorage.removeItem(cacheKey("expiry", userId));
        setPricingModalOpen(true);
      }
    } else {
      setActivePlan("Free");
      setSubscriptionExpiry(null);
      setPricingModalOpen(true);
    }

    setLoading(false);
  }, [onSignOut, students.length, payments.length]);

  useEffect(() => {
    void Promise.resolve().then(loadWorkspace);
  }, [loadWorkspace]);

  function checkAddStudentLimit() {
    if (!isProActive) {
      setPricingModalOpen(true);
      showToast("error", "App features locked! Select a plan (1-Month Free Trial available) to activate FeeFlow.");
      return false;
    }
    return true;
  }

  async function handleDeleteAccount() {
    if (!window.confirm("Are you sure you want to request deletion of your account and all associated student data? This action cannot be undone.")) {
      return;
    }

    setSaving(true);
    try {
      await supabase.from("feeflow_students").delete().eq("teacher_id", teacherId);
      await supabase.from("feeflow_payments").delete().eq("teacher_id", teacherId);
      await supabase.from("feeflow_reminders").delete().eq("teacher_id", teacherId);
      await supabase.from("feeflow_settings").delete().eq("teacher_id", teacherId);
      await supabase.from("feeflow_subscriptions").delete().eq("teacher_id", teacherId);
      showToast("success", "Account data deleted successfully.");
      setTimeout(() => {
        onSignOut();
      }, 1500);
    } catch {
      showToast("error", "Failed to erase data. Please contact support.");
    } finally {
      setSaving(false);
    }
  }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teacherId) return showToast("error", "Login session expired. Please sign in again.");

    if (!checkAddStudentLimit()) {
      return;
    }

    setSaving(true);
    const payload = {
      teacher_id: teacherId,
      photo_url: optional(studentForm.photo_url),
      name: studentForm.name.trim(),
      parent_name: studentForm.parent_name.trim(),
      mobile: studentForm.mobile.trim(),
      whatsapp: optional(studentForm.whatsapp),
      email: optional(studentForm.email),
      address: optional(studentForm.address),
      class_name: studentForm.class_name.trim(),
      monthly_fee: Number(studentForm.monthly_fee),
      admission_date: studentForm.admission_date,
      notes: optional(studentForm.notes),
      status: "active" as StudentStatus,
    };

    const result = editingStudentId
      ? await supabase.from("feeflow_students").update(payload).eq("id", editingStudentId).eq("teacher_id", teacherId).select("*").single()
      : await supabase.from("feeflow_students").insert(payload).select("*").single();

    setSaving(false);
    if (result.error) return showToast("error", friendlySupabaseError(result.error.message));

    if (editingStudentId) {
      setStudents((current) => current.map((student) => (student.id === editingStudentId ? (result.data as Student) : student)));
      showToast("success", "Student updated.");
    } else {
      setStudents((current) => [result.data as Student, ...current]);
      showToast("success", "Student added.");
    }
    setStudentForm(defaultStudentForm);
    setEditingStudentId(null);
    setStudentFormOpen(false);
  }

  async function archiveStudent(student: Student) {
    if (!checkAddStudentLimit()) return;
    const { data, error } = await supabase
      .from("feeflow_students")
      .update({ status: "archived" })
      .eq("id", student.id)
      .eq("teacher_id", teacherId)
      .select("*")
      .single();
    if (error) return showToast("error", friendlySupabaseError(error.message));
    setStudents((current) => current.map((item) => (item.id === student.id ? (data as Student) : item)));
    showToast("success", "Student archived.");
  }

  async function deleteStudent(student: Student) {
    if (!checkAddStudentLimit()) return;
    const { error } = await supabase.from("feeflow_students").delete().eq("id", student.id).eq("teacher_id", teacherId);
    if (error) return showToast("error", friendlySupabaseError(error.message));
    setStudents((current) => current.filter((item) => item.id !== student.id));
    showToast("success", "Student deleted.");
  }

  async function collectFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkAddStudentLimit()) return;
    if (!teacherId) return showToast("error", "Login session expired. Please sign in again.");

    const receiptNumber = `FF-${new Date().getFullYear()}-${String(payments.length + 1).padStart(5, "0")}`;
    setSaving(true);
    const { data, error } = await supabase
      .from("feeflow_payments")
      .insert({
        teacher_id: teacherId,
        student_id: paymentForm.student_id,
        amount: Number(paymentForm.amount),
        discount: Number(paymentForm.discount || 0),
        payment_kind: paymentForm.payment_kind,
        payment_status: paymentForm.payment_status,
        payment_method: paymentForm.payment_method,
        paid_on: new Date().toISOString().slice(0, 10),
        reference_number: optional(paymentForm.reference_number),
        collected_by: paymentForm.collected_by.trim() || email,
        receipt_number: receiptNumber,
        notes: optional(paymentForm.notes),
      })
      .select("*")
      .single();
    setSaving(false);

    if (error) return showToast("error", friendlySupabaseError(error.message));
    const payment = data as Payment;
    setPayments((current) => [payment, ...current]);
    setPaymentForm({ ...defaultPaymentForm, collected_by: email });
    setSelectedReceipt(payment);
    showToast("success", "Fee collected and receipt generated.");
  }

  async function sendReminder(student: Student, reminderType: ReminderKind) {
    if (!checkAddStudentLimit()) return;
    if (!teacherId) return showToast("error", "Login session expired. Please sign in again.");
    const message = buildReminder(student, reminderType, settings?.reminder_template);
    const phone = normalizePhoneNumber(student.whatsapp || student.mobile);
    if (!phone) {
      showToast("error", "Add a valid parent WhatsApp or mobile number before sending a reminder.");
      return;
    }

    const { data, error } = await supabase
      .from("feeflow_reminders")
      .insert({
        teacher_id: teacherId,
        student_id: student.id,
        reminder_type: reminderType,
        channel: "whatsapp",
        message,
        status: "opened",
        opened_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) return showToast("error", friendlySupabaseError(error.message));
    setReminders((current) => [data as Reminder, ...current]);
    window.open(buildWhatsAppUrl(phone, message), "_blank", "noopener,noreferrer");
    showToast("success", "WhatsApp Web opened. Review the message and click Send manually.");
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teacherId) return showToast("error", "Login session expired. Please sign in again.");
    const formData = new FormData(event.currentTarget);
    const payload = {
      teacher_id: teacherId,
      institute_name: String(formData.get("institute_name") ?? "").trim(),
      logo_url: optional(String(formData.get("logo_url") ?? "")),
      address: optional(String(formData.get("address") ?? "")),
      phone: optional(String(formData.get("phone") ?? "")),
      email: optional(String(formData.get("email") ?? "")),
      currency: String(formData.get("currency") ?? "INR"),
      receipt_template: String(formData.get("receipt_template") ?? ""),
      reminder_template: String(formData.get("reminder_template") ?? ""),
      theme: "light" as const,
    };
    const { data, error } = await supabase.from("feeflow_settings").upsert(payload).select("*").single();
    if (error) return showToast("error", friendlySupabaseError(error.message));
    setSettings(data as InstituteSettings);
    showToast("success", "Settings saved.");
  }

  function startEdit(student: Student) {
    if (!checkAddStudentLimit()) return;
    setEditingStudentId(student.id);
    setStudentForm({
      photo_url: student.photo_url ?? "",
      name: student.name,
      parent_name: student.parent_name,
      mobile: student.mobile,
      whatsapp: student.whatsapp ?? "",
      email: student.email ?? "",
      address: student.address ?? "",
      class_name: student.class_name,
      monthly_fee: String(student.monthly_fee),
      admission_date: student.admission_date,
      notes: student.notes ?? "",
    });
    setStudentFormOpen(true);
    setActiveView("Students");
  }

  function showToast(tone: "success" | "error", message: string) {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 3500);
  }

  function exportCsv() {
    if (!isProActive) {
      setPricingModalOpen(true);
      showToast("error", "CSV Report Export is a Pro Feature. Select a plan to unlock reports!");
      return;
    }

    const rows = [
      ["Receipt", "Student", "Amount", "Date", "Method", "Status", "Reference"],
      ...enrichedPayments.map((payment) => [
        payment.receipt_number,
        payment.student?.name ?? "",
        String(payment.amount),
        payment.paid_on,
        payment.payment_method,
        payment.payment_status,
        payment.reference_number ?? "",
      ]),
    ];
    downloadText("feeflow-payments.csv", rows.map((row) => row.map(csvCell).join(",")).join("\n"));
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    if (window.scrollY <= 0) {
      setPullStart(event.touches[0].clientY);
    }
  }

  function handleTouchMove(event: React.TouchEvent<HTMLElement>) {
    if (pullStart === null) return;
    const distance = Math.max(event.touches[0].clientY - pullStart, 0);
    setPullDistance(Math.min(distance, 96));
  }

  function handleTouchEnd() {
    if (pullDistance > 68) {
      void loadWorkspace();
    }
    setPullStart(null);
    setPullDistance(0);
  }

  const instituteName = settings?.institute_name || "BrightPath Academy";

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-indigo-600 selection:text-white">
      {/* Outer framing wrapper for desktop preview, 430px mobile shell */}
      <div className="relative mx-auto min-h-screen max-w-[430px] overflow-hidden bg-white shadow-[0_0_80px_rgba(15,23,42,0.08)] border-x border-slate-100">
        
        {/* Soft Ambient Radial Background Glows */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_20%_-10%,rgba(99,102,241,0.08),transparent_55%),radial-gradient(circle_at_80%_15%,rgba(168,85,247,0.06),transparent_50%)]" />

        <section
          className="relative min-h-screen pb-[calc(6.8rem+env(safe-area-inset-bottom))]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Handcrafted Elegant Minimal Header */}
          <header className="sticky top-0 z-30 bg-white/95 px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-5 backdrop-blur-xl border-b border-slate-100/80">
            {/* Top Navigation Row: 56px Circular Profile Image & Action Buttons */}
            <div className="flex items-center justify-between">
              {/* 56px Circular Profile Image */}
              <div className="relative shrink-0">
                {settings?.logo_url ? (
                  <span
                    className="block size-[56px] rounded-full bg-cover bg-center ring-1 ring-slate-200/80 shadow-xs"
                    style={{ backgroundImage: `url(${settings.logo_url})` }}
                    aria-label="Profile Avatar"
                  />
                ) : (
                  <span className="grid size-[56px] place-items-center rounded-full bg-slate-100 ring-1 ring-slate-200/80 text-slate-700 text-lg font-bold shadow-xs">
                    {teacherName[0]}
                  </span>
                )}
              </div>

              {/* Action Buttons: Subscription Badge, Notifications & Settings */}
              <div className="flex items-center gap-2 shrink-0">
                {activePlan === "1_month_trial" || activePlan === "trial" ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.68rem] font-black text-emerald-700 border border-emerald-200 shadow-xs">
                    <Gift size={13} /> 1-Month Trial Active
                  </span>
                ) : isProActive ? (
                  <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[0.68rem] font-black text-indigo-700 border border-indigo-200 shadow-xs">
                    <Crown size={13} /> Pro Active
                  </span>
                ) : (
                  <button
                    onClick={() => setPricingModalOpen(true)}
                    className="flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-black text-white shadow-xs transition active:scale-95"
                  >
                    <Crown size={14} /> Select Plan
                  </button>
                )}

                <button
                  onClick={() => setActiveView("PendingFees")}
                  className="relative grid size-11 place-items-center rounded-full bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60 transition active:scale-95"
                  aria-label="Notifications"
                >
                  <Bell size={20} className="stroke-[1.8]" />
                  {reminderCount > 0 && (
                    <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
                  )}
                </button>

                <button
                  onClick={() => setActiveView("Settings")}
                  className="grid size-11 place-items-center rounded-full bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60 transition active:scale-95"
                  aria-label="Settings"
                >
                  <Settings size={20} className="stroke-[1.8]" />
                </button>

                <button
                  onClick={onSignOut}
                  className="grid size-11 place-items-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 transition active:scale-95"
                  aria-label="Logout"
                >
                  <LogOut size={19} className="stroke-[1.8]" />
                </button>
              </div>
            </div>

            {/* Breathing Space & Greeting + Teacher Name + Institute Name */}
            <div className="mt-4">
              <p className="text-[15px] font-medium text-slate-500">
                {getGreeting()} 👋
              </p>
              <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-slate-900 leading-tight">
                {teacherName} Sir
              </h1>
              <p className="mt-1 text-[15px] font-normal text-slate-500">
                {instituteName}
              </p>
            </div>

            {/* Global Search Bar */}
            {activeView !== "Settings" && (
              <div className="mt-4 flex min-w-0 items-center gap-2.5 rounded-2xl bg-slate-100/80 px-4 py-3 border border-slate-200/60 shadow-inner focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                <Search size={18} className="text-slate-400 shrink-0 stroke-[1.8]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                  placeholder="Search student, parent, mobile number..."
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
          </header>

          {/* Main View Display Area */}
          <div className="px-4 py-4">
            {/* Locked Functions Warning Banner ONLY when unsubscribed */}
            {!isProActive && !loading && (
              <div className="mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 flex items-center justify-between gap-3 text-amber-900">
                <div className="flex items-center gap-2.5">
                  <LockKeyhole size={20} className="text-amber-600 shrink-0" />
                  <div>
                    <p className="text-xs font-black">App Functions Locked</p>
                    <p className="text-[0.68rem] text-amber-700 font-medium">Select a plan (1-Month Free Trial available) to activate FeeFlow.</p>
                  </div>
                </div>
                <button
                  onClick={() => setPricingModalOpen(true)}
                  className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-amber-700 transition"
                >
                  Select Plan
                </button>
              </div>
            )}

            {/* Pull to refresh feedback */}
            <div className="mb-2 text-center">
              <div className="mx-auto h-1 w-12 rounded-full bg-slate-200" aria-hidden />
              {pullDistance > 0 && (
                <p className="mt-1 text-[0.68rem] font-bold text-indigo-600 transition-opacity" style={{ opacity: pullDistance / 96 }}>
                  {pullDistance > 68 ? "Release to refresh workspace" : "Pull down to refresh"}
                </p>
              )}
            </div>

            {setupError && <SetupNotice message={setupError} onRetry={() => void loadWorkspace()} />}
            {loading && <Panel title="Syncing Workspace">Loading FeeFlow secure records...</Panel>}

            {!loading && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  {activeView === "Dashboard" && (
                    <DashboardView
                      students={students}
                      payments={enrichedPayments}
                      monthlyCollected={monthlyCollected}
                      pendingFees={pendingFees}
                      totalRevenue={totalRevenue}
                      todayCollection={todayCollection}
                      pendingRows={pendingRows}
                      onAction={setActiveView}
                      onExport={exportCsv}
                    />
                  )}
                  {activeView === "Students" && (
                    <StudentsView
                      students={filteredStudents}
                      pendingByStudentId={pendingByStudentId}
                      form={studentForm}
                      setForm={setStudentForm}
                      onSubmit={saveStudent}
                      onEdit={startEdit}
                      onArchive={archiveStudent}
                      onDelete={deleteStudent}
                      onReminder={sendReminder}
                      editingStudentId={editingStudentId}
                      formOpen={studentFormOpen}
                      onAdd={() => {
                        if (checkAddStudentLimit()) {
                          setEditingStudentId(null);
                          setStudentForm(defaultStudentForm);
                          setStudentFormOpen(true);
                        }
                      }}
                      onCancel={() => {
                        setEditingStudentId(null);
                        setStudentForm(defaultStudentForm);
                        setStudentFormOpen(false);
                      }}
                      saving={saving}
                      showToast={showToast}
                      teacherId={teacherId}
                    />
                  )}
                  {activeView === "Fee Collection" && (
                    <FeeCollectionView students={students} form={paymentForm} setForm={setPaymentForm} onSubmit={collectFee} saving={saving} checkLock={checkAddStudentLimit} />
                  )}
                  {activeView === "Payments" && <PaymentsView payments={enrichedPayments} onReceipt={setSelectedReceipt} />}
                  {activeView === "Pending Fees" && <PendingFeesView rows={pendingRows} onReminder={sendReminder} />}
                  {activeView === "Reports" && <ReportsView payments={enrichedPayments} pendingRows={pendingRows} onExport={exportCsv} />}
                  {activeView === "Settings" && (
                    <SettingsView
                      settings={settings}
                      email={email}
                      activePlan={activePlan}
                      subscriptionExpiry={subscriptionExpiry}
                      onUpgrade={() => setPricingModalOpen(true)}
                      onDeleteAccount={handleDeleteAccount}
                      onSubmit={saveSettings}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* Modal Receipt Popup */}
        {selectedReceipt && (
          <ReceiptModal
            payment={{ ...selectedReceipt, student: studentById.get(selectedReceipt.student_id) }}
            settings={settings}
            onClose={() => setSelectedReceipt(null)}
          />
        )}

        {/* Plan Selection Modal */}
        <PricingModal
          isOpen={pricingModalOpen}
          teacherId={teacherId}
          currentPlan={activePlan}
          onClose={() => setPricingModalOpen(false)}
          onSuccess={(plan, expiry) => {
            setActivePlan(plan);
            if (expiry) {
              setSubscriptionExpiry(expiry);
            }
            setPricingModalOpen(false);
            showToast("success", plan === "1_month_trial" || plan === "trial" ? "30-Day Free Pro Trial activated! All features unlocked." : `Subscription active (${plan})! All features unlocked.`);
          }}
        />

        {/* Floating Toast Notification */}
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className={`fixed bottom-[calc(6.2rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(380px,calc(100%-2rem))] rounded-2xl px-4 py-3 text-center text-xs font-bold shadow-2xl backdrop-blur-xl border ${
              toast.tone === "success"
                ? "bg-emerald-900/90 text-white border-emerald-500/30 shadow-emerald-950/20"
                : "bg-rose-900/90 text-white border-rose-500/30 shadow-rose-950/20"
            }`}
          >
            {toast.message}
          </motion.div>
        )}

        {/* Floating Action Button - Hidden when Add Student form screen is open */}
        {!studentFormOpen && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              if (activeView === "Students") {
                if (checkAddStudentLimit()) {
                  setEditingStudentId(null);
                  setStudentForm(defaultStudentForm);
                  setStudentFormOpen(true);
                }
                return;
              }
              setActiveView("Students");
            }}
            className="fixed bottom-[calc(5.4rem+env(safe-area-inset-bottom))] left-1/2 z-40 grid size-14 -translate-x-1/2 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white shadow-2xl shadow-indigo-500/35 ring-4 ring-white transition-transform"
            aria-label="Add student"
          >
            <Plus size={26} className="stroke-[2.5]" />
          </motion.button>
        )}

        {/* Floating White Bottom Navigation Bar - Hidden when Add Student form screen is open */}
        {!studentFormOpen && (
          <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2">
            <div className="relative flex items-center justify-between rounded-[28px] bg-white/92 p-2 border border-slate-200/90 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl">
              {([
                ["Dashboard", Home, "Home"],
                ["Students", Users, "Students"],
                ["Fee Collection", WalletCards, "Fees"],
                ["Reports", TrendingUp, "Reports"],
                ["Settings", Settings, "Settings"],
              ] as Array<[ViewName, ElementType, string]>).map(([item, Icon, navLabel]) => {
                const isActive = activeView === item;
                return (
                  <button
                    key={item}
                    onClick={() => setActiveView(item)}
                    className={`relative flex flex-1 flex-col items-center justify-center py-2 rounded-2xl text-[0.66rem] font-bold transition-all duration-200 ${
                      isActive ? "text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="activeTabPill"
                        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md shadow-indigo-500/25"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex flex-col items-center gap-1">
                      <Icon size={18} className={isActive ? "stroke-[2.2] text-white" : "stroke-[1.8]"} />
                      <span>{navLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}

{/* Dashboard View */}
function DashboardView({
  students,
  payments,
  monthlyCollected,
  pendingFees,
  totalRevenue,
  todayCollection,
  pendingRows,
  onAction,
  onExport,
}: {
  students: Student[];
  payments: Payment[];
  monthlyCollected: number;
  pendingFees: number;
  totalRevenue: number;
  todayCollection: number;
  pendingRows: Array<{ student: Student; pending: number; paidThisMonth: number }>;
  onAction: (view: ViewName) => void;
  onExport: () => void;
}) {
  const cards = [
    {
      label: "Active Students",
      value: String(students.length),
      caption: "+12 this month",
      Icon: Users,
      iconGradient: "from-indigo-600 to-purple-600",
    },
    {
      label: "Today Collected",
      value: formatCurrency(todayCollection),
      caption: "Real-time sync",
      Icon: CreditCard,
      iconGradient: "from-emerald-500 to-teal-600",
    },
    {
      label: "Pending Fees",
      value: formatCurrency(pendingFees),
      caption: "Needs reminder",
      Icon: IndianRupee,
      iconGradient: "from-rose-500 to-pink-600",
    },
    {
      label: "Monthly Revenue",
      value: formatCurrency(monthlyCollected || totalRevenue),
      caption: "This month",
      Icon: TrendingUp,
      iconGradient: "from-violet-600 to-indigo-600",
    },
  ];

  const pendingStudents = pendingRows.filter((row) => row.pending > 0).slice(0, 4);

  return (
    <div className="space-y-5">
      {/* 2x2 White Statistics Cards Grid */}
      <section className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <motion.div
            key={card.label}
            whileTap={{ scale: 0.97 }}
            className="group relative h-[128px] w-full rounded-3xl bg-white border border-slate-200/80 p-4 flex flex-col justify-between shadow-xl shadow-slate-900/5 backdrop-blur-xl overflow-hidden transition-all duration-200 hover:border-indigo-500/40"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-slate-50 group-hover:bg-indigo-50 transition-colors" />

            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500 truncate">
                {card.label}
              </span>
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${card.iconGradient} text-white shadow-md shadow-indigo-500/20`}
              >
                <card.Icon size={17} />
              </span>
            </div>

            <div>
              <p className="text-xl font-black tracking-tight text-slate-900 leading-none">
                {card.value}
              </p>
              <p className="mt-1.5 text-[0.66rem] font-bold text-indigo-600 flex items-center gap-1">
                <Sparkles size={11} className="text-indigo-500" />
                {card.caption}
              </p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Tactile White Quick Action Cards */}
      <section className="rounded-3xl bg-white border border-slate-200/80 p-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
        <SectionHeader title="Quick Actions" action="View All" />
        <div className="mt-3.5 grid grid-cols-4 gap-3">
          {[
            { label: "Add Student", view: "Students" as ViewName, Icon: Plus, tone: "from-indigo-600 to-purple-600" },
            { label: "Collect Fee", view: "Fee Collection" as ViewName, Icon: IndianRupee, tone: "from-emerald-500 to-teal-600" },
            { label: "WhatsApp", view: "Pending Fees" as ViewName, Icon: Send, tone: "from-rose-500 to-pink-600" },
            { label: "Reports", view: "Reports" as ViewName, Icon: FileText, tone: "from-violet-600 to-indigo-600" },
          ].map((action) => (
            <motion.button
              key={action.label}
              whileTap={{ scale: 0.94 }}
              type="button"
              onClick={() => onAction(action.view)}
              className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm backdrop-blur-xl transition-all hover:bg-slate-100 hover:border-slate-200"
            >
              <span className={`grid size-11 place-items-center rounded-2xl bg-gradient-to-br ${action.tone} text-white shadow-md shadow-indigo-500/20 group-active:scale-90 transition-transform`}>
                <action.Icon size={19} />
              </span>
              <span className="mt-2 text-[0.68rem] font-bold text-slate-700 text-center tracking-tight leading-tight group-hover:text-slate-900">
                {action.label}
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Pending Preview & Recent Activity */}
      <section className="space-y-4">
        <SectionHeader title="Pending Fees Preview" action="Manage" onAction={() => onAction("Pending Fees")} />
        <PendingPreview rows={pendingStudents} onOpen={() => onAction("Pending Fees")} />

        <SectionHeader title="Recent Payments" action="Export CSV" onAction={onExport} />
        <PaymentsView payments={payments.slice(0, 3)} />

        <ChartCard title="Monthly Collection Overview" values={monthlyBuckets(payments)} compact />
      </section>
    </div>
  );
}

{/* Students View */}
function StudentsView({
  students,
  pendingByStudentId,
  form,
  setForm,
  onSubmit,
  onEdit,
  onArchive,
  onDelete,
  onReminder,
  editingStudentId,
  formOpen,
  onAdd,
  onCancel,
  saving,
  showToast,
  teacherId,
}: {
  students: Student[];
  pendingByStudentId: Map<string, number>;
  form: StudentFormState;
  setForm: React.Dispatch<React.SetStateAction<StudentFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (student: Student) => void;
  onArchive: (student: Student) => void;
  onDelete: (student: Student) => void;
  onReminder: (student: Student, type: ReminderKind) => void;
  editingStudentId: string | null;
  formOpen: boolean;
  onAdd: () => void;
  onCancel: () => void;
  saving: boolean;
  showToast: (tone: "success" | "error", message: string) => void;
  teacherId: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white border border-slate-200/80 p-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 px-1">
          <div>
            <h2 className="text-base font-black text-slate-900">Student Roster</h2>
            <p className="text-xs font-semibold text-slate-500">{students.length} active records</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20"
          >
            <Plus size={16} /> Add Student
          </motion.button>
        </div>

        {students.length === 0 ? (
          <EmptyState title="No students found" body="Tap 'Add Student' above to add your first record." />
        ) : (
          <div className="mt-3.5 space-y-3">
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                pending={pendingByStudentId.get(student.id) ?? 0}
                onEdit={() => onEdit(student)}
                onArchive={() => onArchive(student)}
                onDelete={() => onDelete(student)}
                onReminder={() => onReminder(student, "due")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Full-Screen Page: Add / Edit Student */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-slate-950/60 backdrop-blur-sm"
          >
            <motion.form
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              onSubmit={onSubmit}
              className="relative flex flex-col w-full h-full max-w-[430px] mx-auto bg-white shadow-2xl overflow-hidden text-slate-900"
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-slate-100 bg-white shrink-0 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:scale-95 border border-slate-200/60"
                    aria-label="Back"
                  >
                    <ArrowLeft size={20} className="stroke-[2]" />
                  </button>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                      {editingStudentId ? "Edit Student Profile" : "Add Student"}
                    </h2>
                    <p className="text-xs font-medium text-slate-500">
                      {editingStudentId ? "Update existing student information" : "Create a new student profile"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth p-5 pb-[120px] space-y-4">
                <div className="text-center pt-1 pb-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="student-photo-file-input"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;

                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const dataUrl = e.target?.result as string;
                        if (dataUrl) {
                          setForm((prev) => ({ ...prev, photo_url: dataUrl }));
                          showToast("success", "Profile photo selected!");
                        }
                      };
                      reader.readAsDataURL(file);

                      try {
                        const fileExt = file.name.split(".").pop();
                        const filePath = `${teacherId}/${Date.now()}.${fileExt}`;
                        const { data, error } = await supabase.storage
                          .from("feeflow_photos")
                          .upload(filePath, file, { upsert: true });

                        if (!error && data) {
                          const { data: urlData } = supabase.storage
                            .from("feeflow_photos")
                            .getPublicUrl(data.path);
                          if (urlData?.publicUrl) {
                            setForm((prev) => ({ ...prev, photo_url: urlData.publicUrl }));
                          }
                        }
                      } catch (storageErr) {
                        console.log("Supabase storage fallback:", storageErr);
                      }
                    }}
                  />

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => document.getElementById("student-photo-file-input")?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        document.getElementById("student-photo-file-input")?.click();
                      }
                    }}
                    className="relative mx-auto size-[90px] rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer group hover:border-indigo-600 transition-colors shadow-xs overflow-hidden outline-none focus:ring-4 focus:ring-indigo-100"
                    style={
                      form.photo_url
                        ? { backgroundImage: `url(${form.photo_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                        : {}
                    }
                  >
                    {!form.photo_url && (
                      <span className="grid size-full place-items-center rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600">
                        <User size={40} className="stroke-[1.6]" />
                      </span>
                    )}
                    <span className="absolute bottom-0 right-0 grid size-7 place-items-center rounded-full bg-indigo-600 text-white shadow-md border-2 border-white">
                      <Camera size={14} className="stroke-[2.2]" />
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => document.getElementById("student-photo-file-input")?.click()}
                    className="mt-2 text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    {form.photo_url ? "Change Photo" : "Tap to upload student photo"}
                  </button>
                </div>

                <div className="space-y-3.5">
                  <M3Input
                    label="Student Name"
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                    Icon={User}
                    required
                  />

                  <M3Input
                    label="Parent Name"
                    placeholder="e.g. Vikram Sharma"
                    value={form.parent_name}
                    onChange={(value) => setForm((prev) => ({ ...prev, parent_name: value }))}
                    Icon={Users}
                    required
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <M3Input
                      label="Phone Number"
                      placeholder="9876543210"
                      type="tel"
                      value={form.mobile}
                      onChange={(value) => setForm((prev) => ({ ...prev, mobile: value }))}
                      Icon={Phone}
                      required
                    />
                    <M3Input
                      label="WhatsApp Number"
                      placeholder="9876543210"
                      type="tel"
                      value={form.whatsapp}
                      onChange={(value) => setForm((prev) => ({ ...prev, whatsapp: value }))}
                      Icon={MessageCircle}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <M3Input
                      label="Monthly Fee"
                      placeholder="₹ 1500"
                      type="number"
                      value={form.monthly_fee}
                      onChange={(value) => setForm((prev) => ({ ...prev, monthly_fee: value }))}
                      Icon={IndianRupee}
                      required
                    />
                    <M3Input
                      label="Class"
                      placeholder="e.g. Class 10"
                      value={form.class_name}
                      onChange={(value) => setForm((prev) => ({ ...prev, class_name: value }))}
                      Icon={GraduationCap}
                      required
                    />
                  </div>

                  <M3Input
                    label="Admission Date"
                    type="date"
                    value={form.admission_date}
                    onChange={(value) => setForm((prev) => ({ ...prev, admission_date: value }))}
                    Icon={CalendarDays}
                    required
                  />

                  <M3Input
                    label="Address"
                    placeholder="e.g. Sector 14, Main Road"
                    value={form.address}
                    onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
                    Icon={MapPin}
                  />

                  <M3TextArea
                    label="Notes"
                    placeholder="Add additional details or remarks..."
                    value={form.notes}
                    onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
                    Icon={FileText}
                  />
                </div>
              </div>

              <div className="sticky bottom-0 left-0 right-0 bg-white px-5 pt-3 pb-[calc(1.2rem+env(safe-area-inset-bottom))] border-t border-slate-100 shrink-0 z-50 shadow-2xl flex items-center gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex h-[56px] min-h-[56px] px-5 items-center justify-center rounded-[18px] bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shrink-0"
                >
                  Cancel
                </button>
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.98 }}
                  disabled={saving}
                  className="flex flex-1 h-[56px] min-h-[56px] items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-sm font-black text-white shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-transform disabled:opacity-60 cursor-pointer"
                >
                  <CheckCircle2 size={20} className="stroke-[2.5]" />
                  <span>{saving ? "Saving Profile..." : editingStudentId ? "Save Changes" : "Save Student"}</span>
                </motion.button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function M3Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  Icon,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  Icon?: ElementType;
}) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}
      <span className="mt-1.5 flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 transition-all focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-100 shadow-2xs">
        {Icon && <Icon size={18} className="text-slate-400 shrink-0 stroke-[1.8]" />}
        <input
          type={type}
          value={value || ""}
          required={required}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400"
        />
      </span>
    </label>
  );
}

function M3TextArea({
  label,
  value,
  onChange,
  placeholder,
  Icon,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  Icon?: ElementType;
}) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}
      <span className="mt-1.5 flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 transition-all focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-100 shadow-2xs">
        {Icon && <Icon size={18} className="text-slate-400 shrink-0 stroke-[1.8] mt-0.5" />}
        <textarea
          rows={2}
          value={value || ""}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full min-w-0 resize-none bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400"
        />
      </span>
    </label>
  );
}

function StudentCard({
  student,
  pending,
  onEdit,
  onArchive,
  onDelete,
  onReminder,
}: {
  student: Student;
  pending: number;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onReminder: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 shadow-sm transition hover:border-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar student={student} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-900">{student.name}</h3>
            <p className="truncate text-xs font-semibold text-slate-500">
              {student.parent_name} • {student.mobile}
            </p>
          </div>
        </div>
        <StatusPill status={pending > 0 ? "due" : student.status} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat label="Class" value={student.class_name} />
        <MiniStat label="Fee" value={formatCurrency(student.monthly_fee)} />
        <MiniStat label="Pending" value={formatCurrency(pending)} danger={pending > 0} />
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-200/60 pt-2.5">
        <button
          onClick={onEdit}
          className="flex items-center gap-1 rounded-xl bg-slate-200/80 px-2.5 py-1.5 text-[0.68rem] font-bold text-slate-700 hover:bg-slate-300"
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          onClick={onReminder}
          className="flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[0.68rem] font-bold text-emerald-700 hover:bg-emerald-100"
        >
          <Send size={13} /> WhatsApp
        </button>
        <button
          onClick={student.status === "active" ? onArchive : onDelete}
          className="flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1.5 text-[0.68rem] font-bold text-rose-700 hover:bg-rose-100"
        >
          <Trash2 size={13} /> {student.status === "active" ? "Archive" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function FeeCollectionView({
  students,
  form,
  setForm,
  onSubmit,
  saving,
  checkLock,
}: {
  students: Student[];
  form: PaymentFormState;
  setForm: (form: PaymentFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  checkLock: () => boolean;
}) {
  const selectedStudent = students.find((student) => student.id === form.student_id);

  return (
    <form onSubmit={(e) => { if (checkLock()) onSubmit(e); else e.preventDefault(); }} className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 border border-indigo-200 p-6 text-white shadow-2xl shadow-indigo-500/20">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-3xl" />
        <p className="text-xs font-bold uppercase tracking-wider text-white/80 flex items-center gap-1.5">
          <WalletCards size={15} /> Instant Fee Collector
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
          {formatCurrency(Number(form.amount || selectedStudent?.monthly_fee || 0))}
        </h2>
        <p className="mt-1 text-xs font-semibold text-white/90">
          {selectedStudent ? `${selectedStudent.name} (Class ${selectedStudent.class_name})` : "Select a student to generate receipt"}
        </p>
      </section>

      <section className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
        <div className="space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            Select Student
            <select
              required
              value={form.student_id}
              onChange={(event) =>
                setForm({
                  ...form,
                  student_id: event.target.value,
                  amount: students.find((student) => student.id === event.target.value)?.monthly_fee.toString() || form.amount,
                })
              }
              className="mt-1.5 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
            >
              <option value="">Choose student record</option>
              {students
                .filter((student) => student.status === "active")
                .map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.class_name})
                  </option>
                ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (₹)" type="number" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} required />
            <Input label="Discount (₹)" type="number" value={form.discount} onChange={(value) => setForm({ ...form, discount: value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Payment Kind" value={form.payment_kind} options={["monthly", "admission", "extra", "advance"]} onChange={(value) => setForm({ ...form, payment_kind: value as PaymentKind })} />
            <Select label="Payment Status" value={form.payment_status} options={["paid", "pending", "partial", "overdue"]} onChange={(value) => setForm({ ...form, payment_status: value as PaymentStatus })} />
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 mb-2">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "upi", "bank_transfer"] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setForm({ ...form, payment_method: method })}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition active:scale-95 ${
                    form.payment_method === method
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-500/10"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  {method === "cash" ? <IndianRupee size={20} className="mb-1" /> : method === "upi" ? <Smartphone size={20} className="mb-1" /> : <Landmark size={20} className="mb-1" />}
                  {method.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <Input label="Reference / Transaction ID" value={form.reference_number} onChange={(value) => setForm({ ...form, reference_number: value })} />
          <TextArea label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
        </div>

        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={saving || students.length === 0}
          className="mt-5 min-h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60 cursor-pointer"
        >
          {saving ? "Generating Receipt..." : "Collect Fee & Create Receipt"}
        </motion.button>
      </section>
    </form>
  );
}

function PaymentsView({ payments, onReceipt }: { payments: Payment[]; onReceipt?: (payment: Payment) => void }) {
  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 p-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 px-1">
        <h2 className="text-sm font-black text-slate-900">Payment Transactions</h2>
        <span className="text-xs font-semibold text-slate-500">{payments.length} records</span>
      </div>

      {payments.length === 0 ? (
        <EmptyState title="No transactions yet" body="Collect your first fee to view payment records here." />
      ) : (
        <div className="mt-3 space-y-2.5">
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar student={payment.student ? { ...emptyAvatarStudent, name: payment.student.name, parent_name: payment.student.parent_name, mobile: payment.student.mobile, monthly_fee: payment.student.monthly_fee } : emptyAvatarStudent} />
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-bold text-indigo-600">{payment.receipt_number}</p>
                  <h3 className="truncate text-xs font-black text-slate-900">{payment.student?.name ?? "Student"}</h3>
                  <p className="text-[0.68rem] text-slate-500 capitalize">{payment.payment_method.replace("_", " ")} • {payment.paid_on}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-black text-slate-900">{formatCurrency(payment.amount)}</p>
                {onReceipt && (
                  <button onClick={() => onReceipt(payment)} className="mt-1 text-[0.65rem] font-bold text-indigo-600 hover:underline">
                    Receipt
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingPreview({ rows, onOpen }: { rows: Array<{ student: Student; pending: number }>; onOpen: () => void }) {
  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 p-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-slate-900">Overdue Reminders</h3>
        <button onClick={onOpen} className="text-xs font-bold text-indigo-600 hover:underline">View All</button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-2xl border border-emerald-200 font-semibold">All students are clear for this month!</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {rows.map(({ student, pending }) => (
            <button key={student.id} onClick={onOpen} className="min-w-[200px] shrink-0 rounded-2xl border border-rose-200 bg-rose-50/60 p-3 text-left">
              <span className="text-[0.62rem] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">OVERDUE</span>
              <p className="mt-2 text-xs font-black text-slate-900 truncate">{student.name}</p>
              <p className="text-sm font-black text-rose-600 mt-1">{formatCurrency(pending)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingFeesView({ rows, onReminder }: { rows: Array<{ student: Student; pending: number; paidThisMonth: number }>; onReminder: (student: Student, type: ReminderKind) => void }) {
  const pendingRows = rows.filter((row) => row.pending > 0);
  return (
    <div className="space-y-3">
      {pendingRows.length === 0 ? (
        <EmptyState title="No pending fees" body="Great job! Every student fee is settled." />
      ) : (
        pendingRows.map(({ student, pending }) => (
          <div key={student.id} className="rounded-3xl bg-white border border-rose-200 p-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar student={student} />
                <div>
                  <h3 className="text-sm font-black text-slate-900">{student.name}</h3>
                  <p className="text-xs text-slate-500">{student.mobile}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-rose-600">{formatCurrency(pending)}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onReminder(student, "friendly")} className="flex-1 rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-center text-xs font-bold text-emerald-700">
                Friendly WhatsApp
              </button>
              <button onClick={() => onReminder(student, "final")} className="flex-1 rounded-xl bg-rose-50 border border-rose-200 p-2 text-center text-xs font-bold text-rose-700">
                Final Notice
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ReportsView({ payments, pendingRows, onExport }: { payments: Payment[]; pendingRows: Array<{ student: Student; pending: number }>; onExport: () => void }) {
  const totalPending = pendingRows.reduce((sum, row) => sum + row.pending, 0);
  const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
        <SectionHeader title="Financial Report Summary" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Total Collected" value={formatCurrency(totalRevenue)} />
          <Stat label="Total Outstanding" value={formatCurrency(totalPending)} />
        </div>
        <button onClick={onExport} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition">
          <Download size={16} /> Export Records to CSV (Pro Feature)
        </button>
      </div>
      <ChartCard title="Monthly Trend" values={monthlyBuckets(payments)} />
    </div>
  );
}

function SettingsView({
  settings,
  email,
  activePlan,
  subscriptionExpiry,
  onUpgrade,
  onDeleteAccount,
  onSubmit,
}: {
  settings: InstituteSettings | null;
  email: string;
  activePlan: string;
  subscriptionExpiry: string | null;
  onUpgrade: () => void;
  onDeleteAccount: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isTrial = activePlan === "1_month_trial" || activePlan === "trial";
  const isPro = activePlan === "Pro" || activePlan === "pro_monthly" || activePlan === "pro_yearly" || isTrial || activePlan === "Enterprise";

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-6">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 p-5 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[0.68rem] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
            {isTrial ? <Gift size={14} /> : <Crown size={14} />} Subscription & Trial Status
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-[0.62rem] font-black uppercase ${
            isTrial
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : isPro
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
              : "bg-slate-700 text-slate-300"
          }`}>
            {isTrial ? "30-Day Free Trial" : activePlan}
          </span>
        </div>
        <h3 className="mt-2 text-xl font-black text-white">
          {isTrial ? "1-Month Free Trial Active!" : isPro ? "FeeFlow Pro Unlocked" : "App Features Locked"}
        </h3>
        <p className="mt-1 text-xs text-slate-300">
          {isTrial
            ? `30 days of full Pro access active! • Valid until: ${subscriptionExpiry ? new Date(subscriptionExpiry).toLocaleDateString() : "30 days"}`
            : isPro
            ? `Active Google Play Subscription • Expires: ${subscriptionExpiry ? new Date(subscriptionExpiry).toLocaleDateString() : "Auto-renews"}`
            : "Features locked • Select any plan (1-Month Free Trial available) to unlock FeeFlow."}
        </p>
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-slate-900 shadow-md hover:bg-slate-100 transition"
        >
          <Zap size={15} className="text-indigo-600 fill-indigo-600" />
          {isTrial ? "Subscribe to Keep Pro Access" : isPro ? "Manage Google Play Subscription" : "Select Plan to Unlock App"}
        </button>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
        <h2 className="text-base font-black text-slate-900 mb-3">Institute & App Settings</h2>
        <div className="space-y-3">
          <Input label="Institute Name" name="institute_name" defaultValue={settings?.institute_name ?? ""} required />
          <Input label="Phone Number" name="phone" defaultValue={settings?.phone ?? ""} />
          <Input label="Email Address" type="email" name="email" defaultValue={settings?.email ?? email} />
          <TextArea label="Address" name="address" defaultValue={settings?.address ?? ""} />
        </div>
        <motion.button type="submit" whileTap={{ scale: 0.98 }} className="mt-5 min-h-12 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-xs font-black text-white shadow-md cursor-pointer">
          Save Settings
        </motion.button>
      </div>

      {/* Google Play Console Policy Mandatory Legal & Account Deletion Controls */}
      <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">Legal & Account Governance</h2>
        
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-indigo-600 pt-1">
          <a href="/privacy" target="_blank" className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition flex items-center justify-center gap-1">
            Privacy <ExternalLink size={12} />
          </a>
          <a href="/terms" target="_blank" className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition flex items-center justify-center gap-1">
            Terms <ExternalLink size={12} />
          </a>
          <a href="/support" target="_blank" className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition flex items-center justify-center gap-1">
            Support <ExternalLink size={12} />
          </a>
        </div>

        <button
          type="button"
          onClick={onDeleteAccount}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 text-xs font-bold text-rose-700 border border-rose-100 hover:bg-rose-100 transition"
        >
          <ShieldAlert size={16} /> Delete Account & Erase All Data
        </button>
      </div>

      {/* Developed by Gyan Ranjan Credit */}
      <div className="pt-2 text-center pb-4">
        <p className="text-xs font-bold text-slate-500 flex items-center justify-center gap-1.5">
          FeeFlow v2.0 • Developed with <Heart size={13} className="text-rose-500 fill-rose-500 inline-block" /> by <span className="font-black text-slate-900">Gyan Ranjan</span>
        </p>
      </div>
    </form>
  );
}

function ReceiptModal({ payment, settings, onClose }: { payment: Payment; settings: InstituteSettings | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-100 p-5 shadow-2xl text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-black text-indigo-600">Payment Receipt</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {settings && (
          <div className="mt-3 text-center pb-2 border-b border-slate-100">
            <h3 className="text-xs font-black text-slate-900">{settings.institute_name}</h3>
            {settings.phone && <p className="text-[0.65rem] text-slate-500">{settings.phone}</p>}
          </div>
        )}

        <div className="mt-3 space-y-2 text-xs">
          <p><span className="text-slate-500">Receipt No:</span> {payment.receipt_number}</p>
          <p><span className="text-slate-500">Student:</span> {payment.student?.name ?? "Student"}</p>
          <p><span className="text-slate-500">Amount Paid:</span> <strong className="text-emerald-600">{formatCurrency(payment.amount)}</strong></p>
          <p><span className="text-slate-500">Date:</span> {payment.paid_on}</p>
          <p><span className="text-slate-500">Payment Mode:</span> {payment.payment_method}</p>
        </div>
        <button onClick={onClose} className="mt-5 min-h-11 w-full rounded-2xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200">
          Close Receipt
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-[0.68rem] font-bold text-indigo-600 hover:underline">
          {action}
        </button>
      )}
    </div>
  );
}

function ChartCard({ title, values, compact = false }: { title: string; values: number[]; compact?: boolean }) {
  const max = Math.max(...values, 1);
  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 p-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
      <SectionHeader title={title} />
      <div className={`mt-4 flex items-end gap-2.5 ${compact ? "h-24" : "h-40"}`}>
        {values.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="flex-1 rounded-t-xl bg-gradient-to-t from-indigo-600 via-purple-600 to-pink-500 shadow-sm"
            style={{ height: `${Math.max((value / max) * 100, 10)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function SetupNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <p className="text-xs font-bold">{message}</p>
      <button onClick={onRetry} className="mt-2 text-xs font-black underline text-amber-800">Retry connection</button>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 p-5 text-center">
      <p className="text-xs font-black text-indigo-600">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{children}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-6 text-center">
      <p className="text-xs font-black text-slate-800">{title}</p>
      <p className="text-[0.68rem] text-slate-500 mt-1">{body}</p>
    </div>
  );
}

function Input({ label, value, onChange, name, defaultValue, type = "text", required = false }: { label: string; value?: string; onChange?: (value: string) => void; name?: string; defaultValue?: string; type?: string; required?: boolean }) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        defaultValue={defaultValue}
        required={required}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, name, defaultValue }: { label: string; value?: string; onChange?: (value: string) => void; name?: string; defaultValue?: string }) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}
      <textarea
        name={name}
        rows={2}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600"
      />
    </label>
  );
}

function Select({ label, value, options, onChange, name }: { label: string; value: string; options: string[]; onChange?: (value: string) => void; name?: string }) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}
      <select name={name} value={value} onChange={(event) => onChange?.(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-800 outline-none capitalize focus:border-indigo-600">
        {options.map((option) => (
          <option key={option} value={option}>{option.replace("_", " ")}</option>
        ))}
      </select>
    </label>
  );
}

function Avatar({ student }: { student: Student }) {
  if (student.photo_url) {
    return <span aria-hidden className="block size-[56px] rounded-full bg-cover bg-center ring-1 ring-slate-200/80 shadow-xs" style={{ backgroundImage: `url(${student.photo_url})` }} />;
  }
  return (
    <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-xs font-black text-white shadow-md">
      {student.name ? student.name.split(" ").map((part) => part[0]).join("").slice(0, 2) : "ST"}
    </span>
  );
}

function StatusPill({ status }: { status: StudentStatus | "due" }) {
  const styles = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200",
    due: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-[0.62rem] font-black capitalize border ${styles[status]}`}>{status === "due" ? "Fee Due" : status}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
      <p className="text-[0.65rem] font-bold text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-white px-2 py-1.5 text-center border border-slate-100 shadow-sm">
      <p className="text-[0.62rem] font-bold text-slate-400 uppercase truncate">{label}</p>
      <p className={`text-xs font-black truncate mt-0.5 ${danger ? "text-rose-600" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}

const emptyAvatarStudent: Student = {
  id: "empty",
  teacher_id: "empty",
  photo_url: null,
  name: "Student",
  parent_name: "",
  mobile: "",
  whatsapp: null,
  email: null,
  address: null,
  class_name: "",
  monthly_fee: 0,
  admission_date: "",
  status: "active",
  notes: null,
  created_at: "",
};

function optional(value: string) {
  const clean = value ? value.trim() : "";
  return clean ? clean : null;
}

function isThisMonth(date: string) {
  return date.slice(0, 7) === new Date().toISOString().slice(0, 7);
}

function monthKey(offset: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - offset);
  return date.toISOString().slice(0, 7);
}

function monthlyBuckets(payments: Payment[]) {
  return Array.from({ length: 6 }, (_, index) => {
    const key = monthKey(5 - index);
    return payments.filter((payment) => payment.paid_on.startsWith(key) && payment.payment_status === "paid").reduce((sum, payment) => sum + payment.amount, 0);
  });
}

function buildReminder(student: Student, type: ReminderKind, template?: string) {
  const base = template || "Dear parent, fee for {{student}} is pending. Amount: {{amount}}.";
  const prefix = type === "friendly" ? "Friendly reminder: " : type === "final" ? "Final reminder: " : "Due reminder: ";
  return `${prefix}${base.replace("{{student}}", student.name).replace("{{amount}}", formatCurrency(student.monthly_fee))}`;
}

function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function buildWhatsAppUrl(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatTeacherName(email: string) {
  const raw = email.split("@")[0] || "Rahul";
  const first = raw.split(/[._-]/)[0] || raw;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function friendlySupabaseError(message: string) {
  if (message.includes("schema cache") || message.includes("Could not find the table") || message.includes("does not exist")) {
    return "Database tables are missing. Run supabase/setup.sql in Supabase, then refresh FeeFlow.";
  }
  if (message.toLowerCase().includes("jwt") || message.toLowerCase().includes("session")) {
    return "Login session expired. Please sign in again.";
  }
  return message;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
