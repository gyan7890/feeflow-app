import Link from "next/link";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-slate-200 text-[#0F172A]">
      <section className="mx-auto flex min-h-screen max-w-[430px] flex-col bg-[#F7F8FC] px-5 pb-10 pt-[calc(1.25rem+env(safe-area-inset-top))] shadow-2xl">
        <Link className="inline-flex min-h-12 w-fit items-center rounded-2xl bg-white px-4 text-sm font-black text-[#5B5FEF] shadow-sm" href="/">Back to app</Link>
        <div className="mt-10 rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/20">
          <p className="text-sm font-black text-cyan-300">Support</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">We help teachers keep fees simple.</h1>
          <p className="mt-4 text-sm font-semibold leading-7 text-white/70">For login help, database setup, data deletion, or billing questions, contact FeeFlow support.</p>
        </div>
        <div className="mt-5 rounded-[1.7rem] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-500">Email</p>
          <a className="mt-2 block text-lg font-black text-[#5B5FEF]" href="mailto:support@feeflow.app">support@feeflow.app</a>
          <p className="mt-5 text-sm font-bold text-slate-500">App</p>
          <p className="mt-2 font-black">FeeFlow Teacher Mobile</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Version 1.0.0</p>
        </div>
      </section>
    </main>
  );
}
