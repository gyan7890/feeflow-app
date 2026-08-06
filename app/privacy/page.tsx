import Link from "next/link";

export default function PrivacyPage() {
  return (
    <PolicyShell eyebrow="Privacy Policy" title="FeeFlow Privacy">
      <p>FeeFlow is a teacher-only mobile application for managing tuition students, fees, receipts, reports, and WhatsApp fee reminders.</p>
      <h2>Data We Collect</h2>
      <p>We store teacher account details, institute settings, student records, parent contact details, fee payments, receipt data, reminder messages, and reminder history needed to run the app.</p>
      <h2>How Data Is Used</h2>
      <p>Your data is used to authenticate teachers, manage fee collection, calculate pending fees, generate receipts, export reports, and open WhatsApp with teacher-approved reminder messages.</p>
      <h2>WhatsApp Reminders</h2>
      <p>FeeFlow does not send WhatsApp messages automatically and does not use the WhatsApp Business API. The app opens WhatsApp with a prefilled message so the teacher can review and send it manually.</p>
      <h2>Storage And Security</h2>
      <p>FeeFlow uses Supabase authentication and database access controls. Teachers can only access their own workspace data when the database policies in the provided setup SQL are enabled.</p>
      <h2>Data Deletion</h2>
      <p>Teachers can request account and workspace data deletion by contacting support from the app support page.</p>
    </PolicyShell>
  );
}

function PolicyShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-200 text-[#0F172A]">
      <article className="mx-auto min-h-screen max-w-[430px] bg-[#F7F8FC] px-5 pb-10 pt-[calc(1.25rem+env(safe-area-inset-top))] shadow-2xl">
        <Link className="inline-flex min-h-12 items-center rounded-2xl bg-white px-4 text-sm font-black text-[#5B5FEF] shadow-sm" href="/">Back to app</Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-[#5B5FEF]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{title}</h1>
        <section className="mt-6 space-y-5 rounded-[1.7rem] bg-white p-5 text-sm font-semibold leading-7 text-slate-600 shadow-sm">
          {children}
        </section>
      </article>
    </main>
  );
}
