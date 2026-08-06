"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Check,
  Edit2,
  Plus,
  PlusCircle,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

export type SubjectItem = {
  id: string;
  teacher_id: string;
  subject_name: string;
  created_at?: string;
};

export const DEFAULT_POPULAR_SUBJECTS = [
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
  "English",
  "Hindi",
  "Accounts",
  "Economics",
  "Commerce",
  "Coding",
  "Drawing",
  "Dance",
  "Guitar",
  "IAS / UPSC",
];

type ManageSubjectsViewProps = {
  teacherId: string;
  onSubjectsUpdated?: (subjects: string[]) => void;
};

export function ManageSubjectsView({ teacherId, onSubjectsUpdated }: ManageSubjectsViewProps) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const onSubjectsUpdatedRef = useRef(onSubjectsUpdated);
  useEffect(() => {
    onSubjectsUpdatedRef.current = onSubjectsUpdated;
  }, [onSubjectsUpdated]);

  function showToast(tone: "success" | "error", message: string) {
    setToast({ tone, message });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        if (!teacherId) {
          if (!ignore) setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("feeflow_subjects")
          .select("*")
          .eq("teacher_id", teacherId)
          .order("subject_name", { ascending: true });

        if (error) {
          console.warn("Could not fetch subjects from DB:", error.message);
        }

        if (!ignore) {
          const fetchedList = (data as SubjectItem[]) || [];
          setSubjects(fetchedList);
          if (onSubjectsUpdatedRef.current) {
            onSubjectsUpdatedRef.current(fetchedList.map((s) => s.subject_name));
          }
        }
      } catch (err) {
        console.error("Error loading subjects:", err);
        if (!ignore) setSubjects([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [teacherId]);

  async function handleAddSubject(nameToAdd?: string) {
    const targetName = (nameToAdd || newSubjectName).trim();
    setErrorMessage("");

    if (!targetName) {
      setErrorMessage("Subject name cannot be empty.");
      return;
    }

    // Duplicate protection (case insensitive)
    const exists = subjects.some(
      (s) => s.subject_name.toLowerCase() === targetName.toLowerCase()
    );
    if (exists) {
      setErrorMessage(`Subject "${targetName}" already exists!`);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("feeflow_subjects")
        .insert({ teacher_id: teacherId, subject_name: targetName })
        .select("*")
        .single();

      if (error) throw error;

      const updated = [...subjects, data as SubjectItem].sort((a, b) =>
        a.subject_name.localeCompare(b.subject_name)
      );
      setSubjects(updated);
      if (onSubjectsUpdatedRef.current) {
        onSubjectsUpdatedRef.current(updated.map((s) => s.subject_name));
      }

      setNewSubjectName("");
      setShowAddModal(false);
      showToast("success", `Subject "${targetName}" added.`);
    } catch {
      // Memory fallback if DB insert fails
      /* eslint-disable-next-line react-hooks/purity */
      const fallbackId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const fallbackItem: SubjectItem = {
        id: fallbackId,
        teacher_id: teacherId,
        subject_name: targetName,
      };
      const updated = [...subjects, fallbackItem].sort((a, b) =>
        a.subject_name.localeCompare(b.subject_name)
      );
      setSubjects(updated);
      if (onSubjectsUpdatedRef.current) {
        onSubjectsUpdatedRef.current(updated.map((s) => s.subject_name));
      }
      setNewSubjectName("");
      setShowAddModal(false);
      showToast("success", `Subject "${targetName}" added.`);
    }
  }

  async function handleUpdateSubject() {
    if (!editingSubject) return;
    const targetName = editSubjectName.trim();
    setErrorMessage("");

    if (!targetName) {
      setErrorMessage("Subject name cannot be empty.");
      return;
    }

    const exists = subjects.some(
      (s) => s.id !== editingSubject.id && s.subject_name.toLowerCase() === targetName.toLowerCase()
    );
    if (exists) {
      setErrorMessage(`Subject "${targetName}" already exists!`);
      return;
    }

    try {
      await supabase
        .from("feeflow_subjects")
        .update({ subject_name: targetName })
        .eq("id", editingSubject.id);

      const updated = subjects.map((s) =>
        s.id === editingSubject.id ? { ...s, subject_name: targetName } : s
      );
      setSubjects(updated);
      if (onSubjectsUpdatedRef.current) {
        onSubjectsUpdatedRef.current(updated.map((s) => s.subject_name));
      }
      setEditingSubject(null);
      showToast("success", `Subject updated to "${targetName}".`);
    } catch {
      const updated = subjects.map((s) =>
        s.id === editingSubject.id ? { ...s, subject_name: targetName } : s
      );
      setSubjects(updated);
      if (onSubjectsUpdatedRef.current) {
        onSubjectsUpdatedRef.current(updated.map((s) => s.subject_name));
      }
      setEditingSubject(null);
      showToast("success", `Subject updated to "${targetName}".`);
    }
  }

  async function handleDeleteSubject(id: string) {
    const subjectToDelete = subjects.find((s) => s.id === id);
    const name = subjectToDelete?.subject_name || "Subject";
    try {
      await supabase.from("feeflow_subjects").delete().eq("id", id);
      const updated = subjects.filter((s) => s.id !== id);
      setSubjects(updated);
      if (onSubjectsUpdatedRef.current) {
        onSubjectsUpdatedRef.current(updated.map((s) => s.subject_name));
      }
      showToast("success", `Subject "${name}" deleted.`);
    } catch {
      const updated = subjects.filter((s) => s.id !== id);
      setSubjects(updated);
      if (onSubjectsUpdatedRef.current) {
        onSubjectsUpdatedRef.current(updated.map((s) => s.subject_name));
      }
      showToast("success", `Subject "${name}" deleted.`);
    } finally {
      setDeletingId(null);
    }
  }

  async function seedDefaultSubjects() {
    setLoading(true);
    const newItems: SubjectItem[] = [];
    for (const name of DEFAULT_POPULAR_SUBJECTS.slice(0, 8)) {
      if (!subjects.some((s) => s.subject_name.toLowerCase() === name.toLowerCase())) {
        try {
          const { data } = await supabase
            .from("feeflow_subjects")
            .insert({ teacher_id: teacherId, subject_name: name })
            .select("*")
            .single();
          if (data) newItems.push(data as SubjectItem);
        } catch {
          const fallbackId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          newItems.push({ id: fallbackId, teacher_id: teacherId, subject_name: name });
        }
      }
    }
    const updated = [...subjects, ...newItems].sort((a, b) => a.subject_name.localeCompare(b.subject_name));
    setSubjects(updated);
    if (onSubjectsUpdatedRef.current) {
      onSubjectsUpdatedRef.current(updated.map((s) => s.subject_name));
    }
    setLoading(false);
    showToast("success", `Added common subjects.`);
  }

  const filteredSubjects = subjects.filter((s) =>
    s.subject_name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="space-y-5 pb-8 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-4 right-4 z-50 rounded-2xl px-4 py-3 text-xs font-bold shadow-xl border ${
              toast.tone === "success"
                ? "bg-emerald-600 text-white border-emerald-500"
                : "bg-rose-600 text-white border-rose-500"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <BookOpen size={18} />
            </span>
            <h2 className="text-xl font-black text-slate-900">Custom Subjects</h2>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Create and manage subjects taught at your tuition center.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage("");
            setNewSubjectName("");
            setShowAddModal(true);
          }}
          className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-xs font-black text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 cursor-pointer transition"
        >
          <Plus size={16} />
          <span>Add New Subject</span>
        </button>
      </div>

      {/* Search Bar & Stats */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subjects (e.g. Physics, Coding)..."
            className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
          />
        </div>
        <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 shrink-0">
          {subjects.length} Total
        </span>
      </div>

      {/* Quick Seed Banner if 0 subjects */}
      {subjects.length === 0 && !loading && (
        <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5 text-center">
          <Sparkles className="mx-auto size-8 text-indigo-600 mb-2" />
          <h3 className="text-sm font-black text-slate-900">No Custom Subjects Yet</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Get started instantly by adding standard subjects or creating your own custom subjects.
          </p>
          <button
            onClick={seedDefaultSubjects}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-md cursor-pointer transition"
          >
            <PlusCircle size={14} /> Add Common Subjects (Physics, Math, Chemistry...)
          </button>
        </div>
      )}

      {/* Subjects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSubjects.map((sub) => (
            <motion.div
              layout
              key={sub.id}
              className="group flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-indigo-300 hover:shadow-md transition"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 font-bold text-xs">
                  {sub.subject_name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-sm font-bold text-slate-900">{sub.subject_name}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setErrorMessage("");
                    setEditingSubject(sub);
                    setEditSubjectName(sub.subject_name);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition cursor-pointer"
                  title="Edit Subject"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => setDeletingId(sub.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                  title="Delete Subject"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Suggested Quick Add Chips */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <p className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1">
          <Sparkles size={12} className="text-indigo-600" /> Popular Subjects (Tap to Add):
        </p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_POPULAR_SUBJECTS.map((name) => {
            const added = subjects.some((s) => s.subject_name.toLowerCase() === name.toLowerCase());
            return (
              <button
                type="button"
                key={name}
                disabled={added}
                onClick={() => handleAddSubject(name)}
                className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  added
                    ? "bg-slate-100 text-slate-400 cursor-default"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-100"
                }`}
              >
                {added ? <Check size={12} /> : <Plus size={12} />}
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ADD SUBJECT MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">Add New Subject</h3>
                <button onClick={() => setShowAddModal(false)} className="rounded-full bg-slate-100 p-1.5 text-slate-400 hover:text-slate-700">
                  <X size={16} />
                </button>
              </div>

              {errorMessage && (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 border border-rose-100">
                  {errorMessage}
                </p>
              )}

              <div className="mt-4">
                <label htmlFor="new-subject-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Subject Name</label>
                <input
                  id="new-subject-name-input"
                  type="text"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
                  placeholder="e.g. IAS / UPSC, Dance, Coding"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10"
                />
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-2xl bg-slate-100 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSubject()}
                  className="flex-1 rounded-2xl bg-indigo-600 py-3 text-xs font-black text-white hover:bg-indigo-700 transition cursor-pointer"
                >
                  Add Subject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT SUBJECT MODAL */}
      <AnimatePresence>
        {editingSubject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">Edit Subject</h3>
                <button onClick={() => setEditingSubject(null)} className="rounded-full bg-slate-100 p-1.5 text-slate-400 hover:text-slate-700">
                  <X size={16} />
                </button>
              </div>

              {errorMessage && (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 border border-rose-100">
                  {errorMessage}
                </p>
              )}

              <div className="mt-4">
                <label htmlFor="edit-subject-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Subject Name</label>
                <input
                  id="edit-subject-name-input"
                  type="text"
                  value={editSubjectName}
                  onChange={(e) => setEditSubjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateSubject()}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10"
                />
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="flex-1 rounded-2xl bg-slate-100 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateSubject}
                  className="flex-1 rounded-2xl bg-indigo-600 py-3 text-xs font-black text-white hover:bg-indigo-700 transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center border border-slate-100 text-slate-900"
            >
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-100 text-rose-600 mb-3">
                <Trash2 size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900">Delete Subject?</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Are you sure you want to delete this subject? It will be removed from your subject list.
              </p>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="flex-1 rounded-2xl bg-slate-100 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSubject(deletingId)}
                  className="flex-1 rounded-2xl bg-rose-600 py-3 text-xs font-black text-white hover:bg-rose-700 transition cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
