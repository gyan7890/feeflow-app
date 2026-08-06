import Link from "next/link";

export default function TermsPage() {
  return (
    <PolicyShell eyebrow="Terms" title="FeeFlow Terms">
      <p>FeeFlow is provided for tuition teachers to manage student fee operations. There is no student app and no parent login.</p>
      <h2>Teacher Responsibility</h2>
      <p>Teachers are responsible for entering accurate student, parent, fee, and payment information and for getting any required consent before storing parent contact details.</p>
      <h2>Payments And Receipts</h2>
      <p>FeeFlow records payment history and generates receipt information. It does not process money directly unless a teacher connects an external payment workflow outside the app.</p>
      <h2>WhatsApp Usage</h2>
      <p>FeeFlow only opens WhatsApp Click-to-Chat links with prefilled reminder text. The teacher must review and send each message manually.</p>
      <h2>Availability</h2>
      <p>The app depends on internet access and Supabase services. Keep your account credentials secure and sign out on shared devices.</p>
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
