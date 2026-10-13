"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { extractTextFromFile, FileParseError } from "@/lib/fileParsing";
import { useAuth } from "@/lib/auth";
import { Icon } from "@/components/ui/Icon";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { useToast } from "@/hooks/useToast";
import { Modal } from "@/components/ui/Modal";
import { SkeletonGroup, Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import ScoreGauge from "@/components/ScoreGauge";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

interface Skill { id?: number; name: string; proficiency: number; category?: string }
interface Project { id?: number; title: string; description: string; techStack: string; link: string }
interface JobRole { id: number; title: string }
interface Profile {
  id: number; fullName: string; email: string; phone: string | null;
  college: string | null; degree: string | null; branch: string | null;
  graduationYear: number | null; cgpa: number | null;
  targetRoleId: number | null; targetRoleTitle: string | null;
  linkedinUrl: string | null; githubUrl: string | null; preferredCompanies: string | null; experienceLevel: string | null;
  resumeFileName: string | null; resumeText: string | null; resumeUpdatedAt: string | null;
  hasAvatar: boolean; avatarUrl: string | null;
  skills: Skill[]; projects: Project[]; certifications: unknown[];
  profileComplete: boolean; missingRequiredFields: string[];
}

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  fullName: "Full name", email: "Email", phone: "Phone number",
  university: "College / university name", resume: "Resume / CV",
};

const EXPERIENCE_LEVELS = ["Fresher", "0-1 years", "1-3 years", "3+ years"];
const SKILL_SUGGESTIONS = [
  "Java", "Python", "JavaScript", "TypeScript", "C++", "SQL", "React", "Spring Boot", "Node.js",
  "Django", "MongoDB", "MySQL", "PostgreSQL", "Docker", "Kubernetes", "AWS", "Git", "REST API",
  "Kafka", "Redis", "GraphQL", "Microservices",
];

const TABS = ["Personal Info", "Resume", "Account Settings"] as const;
type Tab = (typeof TABS)[number];

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading profile..." />}>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "true";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { push: pushToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("Personal Info");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.get<Profile>("/api/students/profile"), api.get<JobRole[]>("/api/roles")])
      .then(([p, r]) => { setProfile(p); setRoles(r); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="surface-card px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <Skeleton variant="circle" className="w-20 h-20 rounded-2xl" />
              <div className="space-y-2 pt-1">
                <Skeleton variant="line" className="w-48 h-6" />
                <Skeleton variant="line" className="w-32 h-4" />
                <Skeleton variant="line" className="w-64 h-4" />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <SkeletonGroup variant="kpi" className="w-32" />
            </div>
          </div>
        </div>
        <SkeletonGroup variant="card" />
        <SkeletonGroup variant="card" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} />;
  if (!profile) return null;

  async function saveFields(fields: Record<string, unknown>) {
    if (!profile) throw new Error("no profile");
    const updated = await api.put<Profile>("/api/students/profile", {
      phone: null, college: null, degree: null, branch: null, graduationYear: null, cgpa: null,
      targetRoleId: null, linkedinUrl: null, githubUrl: null, preferredCompanies: null, experienceLevel: null,
      ...fields,
    });
    setProfile(updated);
    return updated;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-28">
      {!profile.profileComplete && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            {onboarding ? "Welcome! A few required fields before you can start practicing:" : "A few required fields are still missing:"}
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
            {profile.missingRequiredFields.map((f) => <li key={f}>{REQUIRED_FIELD_LABELS[f] ?? f}</li>)}
          </ul>
          <p className="mt-2 text-xs text-amber-700">Everything else on this page (skills, projects, certifications, target role, links) is optional and can be filled in anytime.</p>
        </div>
      )}

      <HeroSection
        profile={profile}
        user={user}
        onEditClick={() => { setIsEditing(true); setActiveTab("Personal Info"); }}
        onAvatarChosen={async (file) => {
          if (!file) return;
          if (!file.type.startsWith("image/")) { pushToast({ variant: "error", title: "Invalid file", description: "Please choose an image file" }); return; }
          if (file.size > 2 * 1024 * 1024) { pushToast({ variant: "error", title: "File too large", description: "Image must be under 2 MB" }); return; }
          try {
            const form = new FormData();
            form.append("file", file);
            const updated = await api.postForm<Profile>(`/api/students/${user?.userId}/avatar`, form);
            setProfile(updated);
            pushToast({ variant: "success", title: "Profile photo updated" });
          } catch (e) {
            pushToast({ variant: "error", title: "Upload failed", description: e instanceof ApiError ? e.message : "Failed to upload photo" });
          }
        }}
      />

      <div className="section-card">
        <div className="flex border-b border-slate-200/80 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab ? "text-premium-700" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-premium-600 rounded-t" />
              )}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5">
          {activeTab === "Personal Info" && (
            <PersonalInfoTab
              profile={profile}
              roles={roles}
              isEditing={isEditing}
              saving={saving}
              setSaving={setSaving}
              onProfileUpdate={setProfile}
              onSave={saveFields}
              onToast={pushToast}
            />
          )}
          {activeTab === "Resume" && (
            <ResumeTab
              profile={profile}
              onProfileUpdate={setProfile}
              onToast={pushToast}
            />
          )}
          {activeTab === "Account Settings" && (
            <AccountSettingsTab
              profile={profile}
              onToast={pushToast}
              onDeleteClick={() => setDeleteModalOpen(true)}
            />
          )}
        </div>
      </div>

      <StickyActionBar
        visible={isEditing}
        saving={saving}
        onSaveDraft={() => {
          pushToast({ variant: "info", title: "Draft saved" });
        }}
        onSave={() => {
          setSaving(true);
          setTimeout(() => {
            setSaving(false);
            setIsEditing(false);
            pushToast({ variant: "success", title: "Profile saved successfully" });
          }, 800);
        }}
        onCancel={() => {
          setIsEditing(false);
          load();
        }}
      />

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Account"
        description="This action cannot be undone. All your progress, data, and settings will be permanently removed."
        footer={
          <>
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                pushToast({ variant: "info", title: "Account deletion requested", description: "Please contact support to complete this process." });
              }}
              className="btn-danger btn-sm"
            >
              <Icon name="trash-2" size={14} />
              Delete Account
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <Icon name="alert-triangle" size={18} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Danger Zone</p>
              <p className="text-xs text-red-700 mt-0.5">
                Deleting your account will permanently erase all your mock test attempts, coding submissions, skill progress, and interview history.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function HeroSection({ profile, user, onEditClick, onAvatarChosen }: {
  profile: Profile; user: { userId: number } | null;
  onEditClick: () => void;
  onAvatarChosen: (file?: File) => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile.hasAvatar || !profile.avatarUrl) { setAvatarUrl(null); return; }
    let revoke: string | null = null;
    api.getBlob(profile.avatarUrl).then((blob) => {
      const url = URL.createObjectURL(blob);
      revoke = url;
      setAvatarUrl(url);
    }).catch(() => setAvatarUrl(null));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [profile.hasAvatar, profile.avatarUrl]);

  const initials = profile.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="surface-card px-6 py-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-premium-gradient flex items-center justify-center text-2xl font-bold text-white shadow-premium overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile.fullName} className="h-full w-full object-cover" />
              ) : initials}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-md hover:bg-slate-700"
              aria-label="Change profile photo"
            >
              <Icon name="pencil" size={12} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onAvatarChosen(e.target.files?.[0])}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold text-slate-950 tracking-tight">
                {profile.fullName}
              </h1>
              {profile.targetRoleTitle && (
                <span className="badge badge-primary">{profile.targetRoleTitle}</span>
              )}
            </div>
            {profile.college && (
              <p className="text-sm text-slate-600 flex items-center gap-1.5">
                <Icon name="book-open" size={14} />
                {profile.college}
                {profile.graduationYear && <span className="text-slate-400"> · Class of {profile.graduationYear}</span>}
              </p>
            )}
            {profile.experienceLevel && (
              <p className="text-sm text-slate-600 flex items-center gap-1.5">
                <Icon name="briefcase" size={14} />
                {profile.experienceLevel}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Icon name="info" size={12} />
                {profile.email}
              </p>
              {profile.phone && (
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Icon name="bell" size={12} />
                  {profile.phone}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 flex-wrap lg:justify-end">
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <ScoreGauge score={profile.profileComplete ? 78 : 42} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Readiness
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={onEditClick} className="btn-primary btn-sm w-full justify-start">
              <Icon name="pencil" size={14} />
              Edit Profile
            </button>
            <button
              className="btn-secondary btn-sm w-full justify-start"
              onClick={() => window.print()}
            >
              <Icon name="download" size={14} />
              Download Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, error, required, children }: { label: string; htmlFor: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}{required && <span className="ml-0.5 text-red-500" aria-hidden="true"> *</span>}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value || <span className="text-slate-400">Not set</span>}</p>
    </div>
  );
}

function PersonalInfoTab({ profile, roles, isEditing, saving, setSaving, onProfileUpdate, onSave, onToast }: {
  profile: Profile; roles: JobRole[];
  isEditing: boolean; saving: boolean;
  setSaving: (v: boolean) => void;
  onProfileUpdate: (p: Profile) => void;
  onSave: (fields: Record<string, unknown>) => Promise<Profile>;
  onToast: (t: { variant: "success" | "error"; title: string; description?: string }) => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(profile.githubUrl ?? "");
  const [college, setCollege] = useState(profile.college ?? "");
  const [degree, setDegree] = useState(profile.degree ?? "");
  const [branch, setBranch] = useState(profile.branch ?? "");
  const [graduationYear, setGraduationYear] = useState(String(profile.graduationYear ?? ""));
  const [cgpa, setCgpa] = useState(String(profile.cgpa ?? ""));
  const [targetRoleId, setTargetRoleId] = useState(profile.targetRoleId ? String(profile.targetRoleId) : "");
  const [preferredCompanies, setPreferredCompanies] = useState(profile.preferredCompanies ?? "");
  const [experienceLevel, setExperienceLevel] = useState(profile.experienceLevel ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [newSkill, setNewSkill] = useState("");
  const [savingSkill, setSavingSkill] = useState(false);

  const suggestions = SKILL_SUGGESTIONS.filter(
    (s) => s.toLowerCase().includes(newSkill.toLowerCase()) && newSkill.length > 0 &&
      !profile.skills.some((sk) => sk.name.toLowerCase() === s.toLowerCase())
  ).slice(0, 5);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!phone.trim()) next.phone = "Phone number is required";
    else if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) next.phone = "Enter a valid phone number";
    if (linkedinUrl && !/^https?:\/\/.+/i.test(linkedinUrl)) next.linkedinUrl = "Must be a full URL (https://...)";
    if (githubUrl && !/^https?:\/\/.+/i.test(githubUrl)) next.githubUrl = "Must be a full URL (https://...)";
    if (!fullName.trim()) next.fullName = "Name is required";
    if (!college.trim()) next.college = "College / university name is required";
    const cgpaNum = cgpa === "" ? null : Number(cgpa);
    if (cgpaNum != null && (Number.isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10)) next.cgpa = "CGPA must be between 0 and 10";
    const yearNum = graduationYear === "" ? null : Number(graduationYear);
    const currentYear = new Date().getFullYear();
    if (yearNum != null && (Number.isNaN(yearNum) || yearNum < currentYear - 10 || yearNum > currentYear + 10)) {
      next.graduationYear = `Enter a year between ${currentYear - 10} and ${currentYear + 10}`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function saveAll() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (fullName.trim() !== profile.fullName) {
        await api.put("/api/auth/me", { fullName: fullName.trim() });
      }
      const updated = await onSave({
        phone: phone || "", linkedinUrl, githubUrl,
        college, degree, branch,
        graduationYear: graduationYear === "" ? null : Number(graduationYear),
        cgpa: cgpa === "" ? null : Number(cgpa),
        targetRoleId: targetRoleId ? Number(targetRoleId) : null,
        preferredCompanies, experienceLevel,
      });
      onProfileUpdate({ ...updated, fullName: fullName.trim() });
      onToast({ variant: "success", title: "Profile saved successfully" });
    } catch (e) {
      onToast({ variant: "error", title: "Save failed", description: e instanceof ApiError ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function persist(skills: Skill[]) {
    setSavingSkill(true);
    try {
      const updated = await api.put<Skill[]>(`/api/students/${profile.id}/skills`, skills);
      onProfileUpdate({ ...profile, skills: updated });
    } catch (e) {
      onToast({ variant: "error", title: "Failed to update skills", description: e instanceof ApiError ? e.message : undefined });
    } finally {
      setSavingSkill(false);
    }
  }

  async function addSkill(name: string) {
    const trimmed = name.trim();
    if (!trimmed || profile.skills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return;
    await persist([...profile.skills, { name: trimmed, proficiency: 2 }]);
    setNewSkill("");
  }

  async function removeSkill(name: string) {
    await persist(profile.skills.filter((s) => s.name !== name));
  }

  const grouped = profile.skills.reduce<Record<string, Skill[]>>((acc, s) => {
    const cat = s.category || "Other";
    (acc[cat] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {isEditing && (
        <div className="flex justify-end gap-2 -mt-2">
          <button
            onClick={saveAll}
            disabled={saving}
            className="btn-primary btn-sm"
          >
            <Icon name="check" size={14} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      <FieldGroup
        title="Basic Information"
        description="Your core identity and career targeting."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isEditing ? (
            <>
              <Field label="Full Name" htmlFor="fullName" required error={errors.fullName}>
                <input id="fullName" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="email" required>
                <input id="email" className="input bg-slate-50 text-slate-400" value={profile.email} disabled readOnly />
              </Field>
              <Field label="Target Role" htmlFor="targetRole">
                <select id="targetRole" className="input" value={targetRoleId} onChange={(e) => setTargetRoleId(e.target.value)}>
                  <option value="">Select a role</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </Field>
              <Field label="Experience Level" htmlFor="experience">
                <select id="experience" className="input" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                  <option value="">Select...</option>
                  {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Preferred Companies / Domains" htmlFor="companies">
                  <input id="companies" className="input" placeholder="e.g. Google, Amazon, Flipkart" value={preferredCompanies} onChange={(e) => setPreferredCompanies(e.target.value)} />
                </Field>
              </div>
            </>
          ) : (
            <>
              <ReadRow label="Full Name" value={profile.fullName} />
              <ReadRow label="Email" value={profile.email} />
              <ReadRow label="Target Role" value={profile.targetRoleTitle} />
              <ReadRow label="Experience Level" value={profile.experienceLevel} />
              <div className="sm:col-span-2">
                <ReadRow label="Preferred Companies / Domains" value={profile.preferredCompanies} />
              </div>
            </>
          )}
        </div>
      </FieldGroup>

      <FieldGroup
        title="Education Details"
        description="Academic background for personalized recommendations."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isEditing ? (
            <>
              <Field label="College" htmlFor="college" required error={errors.college}>
                <input id="college" className="input" value={college} onChange={(e) => setCollege(e.target.value)} />
              </Field>
              <Field label="Degree" htmlFor="degree">
                <input id="degree" className="input" value={degree} onChange={(e) => setDegree(e.target.value)} />
              </Field>
              <Field label="Branch / Major" htmlFor="branch">
                <input id="branch" className="input" value={branch} onChange={(e) => setBranch(e.target.value)} />
              </Field>
              <Field label="Graduation Year" htmlFor="gradYear" error={errors.graduationYear}>
                <input id="gradYear" className="input" type="number" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} />
              </Field>
              <Field label="CGPA (out of 10)" htmlFor="cgpa" error={errors.cgpa}>
                <input id="cgpa" className="input" type="number" step="0.1" min={0} max={10} value={cgpa} onChange={(e) => setCgpa(e.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <ReadRow label="College" value={profile.college} />
              <ReadRow label="Degree" value={profile.degree} />
              <ReadRow label="Branch / Major" value={profile.branch} />
              <ReadRow label="Graduation Year" value={profile.graduationYear} />
              <ReadRow label="CGPA (out of 10)" value={profile.cgpa} />
            </>
          )}
        </div>
      </FieldGroup>

      <FieldGroup
        title="Contact & Links"
        description="Stay reachable for opportunities."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isEditing ? (
            <>
              <Field label="Phone" htmlFor="phone" required error={errors.phone}>
                <input id="phone" className="input" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <div />
              <Field label="LinkedIn" htmlFor="linkedin" error={errors.linkedinUrl}>
                <input id="linkedin" className="input" placeholder="https://linkedin.com/in/..." value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
              </Field>
              <Field label="GitHub" htmlFor="github" error={errors.githubUrl}>
                <input id="github" className="input" placeholder="https://github.com/..." value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <ReadRow label="Phone" value={profile.phone} />
              <ReadRow label="Email" value={profile.email} />
              <ReadRow label="LinkedIn" value={profile.linkedinUrl && <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="text-premium-700 hover:underline">{profile.linkedinUrl}</a>} />
              <ReadRow label="GitHub" value={profile.githubUrl && <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="text-premium-700 hover:underline">{profile.githubUrl}</a>} />
            </>
          )}
        </div>
      </FieldGroup>

      <FieldGroup
        title="Skills"
        description="Add your technical skills to get personalized recommendations."
      >
        {profile.skills.length === 0 ? (
          <EmptyState
            icon="sparkles"
            title="No skills yet"
            description="Start adding your technical skills to build your profile."
          />
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">{category}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((s) => (
                    <span key={s.name} className="badge badge-primary flex items-center gap-1.5">
                      {s.name}
                      <button
                        onClick={() => removeSkill(s.name)}
                        disabled={savingSkill}
                        aria-label={`Remove ${s.name}`}
                        className="text-premium-400 hover:text-red-500"
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <div className="flex gap-2">
            <label htmlFor="newSkill" className="sr-only">Add a skill</label>
            <input
              id="newSkill"
              className="input"
              placeholder="Add a skill (e.g. Java)"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill(newSkill))}
            />
            <button
              onClick={() => addSkill(newSkill)}
              disabled={savingSkill || !newSkill.trim()}
              className="btn-secondary whitespace-nowrap"
            >
              <Icon name="plus" size={14} />
              Add
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => addSkill(s)}
                  className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </FieldGroup>
    </div>
  );
}

function ResumeTab({ profile, onProfileUpdate, onToast }: {
  profile: Profile;
  onProfileUpdate: (p: Profile) => void;
  onToast: (t: { variant: "success" | "error" | "info"; title: string; description?: string }) => void;
}) {
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<{ fileName: string; text: string; matchedSkills: string[] } | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFileChosen(file?: File) {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setParseWarning(null);
    setPreview(null);
    try {
      const { text, warning } = await extractTextFromFile(file);
      if (warning) setParseWarning(warning);
      const response = await api.post<{ fileName: string; text: string; matchedSkills: string[] }>(
        `/api/students/${profile.id}/resume`, { fileName: file.name, text }
      );
      setPreview(response);
      const missingRequiredFields = profile.missingRequiredFields.filter((f) => f !== "resume");
      onProfileUpdate({
        ...profile, resumeFileName: response.fileName, resumeText: response.text, resumeUpdatedAt: new Date().toISOString(),
        missingRequiredFields, profileComplete: missingRequiredFields.length === 0,
      });
      onToast({ variant: "success", title: "Resume parsed successfully" });
    } catch (e) {
      const message = e instanceof FileParseError ? e.message : e instanceof ApiError ? e.message : "Could not process that file";
      setParseError(message);
      onToast({ variant: "error", title: "Resume processing failed", description: message });
    } finally {
      setParsing(false);
    }
  }

  async function addMatchedSkills(skills: string[]) {
    const existing = new Set(profile.skills.map((s) => s.name.toLowerCase()));
    const toAdd = skills.filter((s) => !existing.has(s.toLowerCase()));
    if (toAdd.length === 0) return;
    const merged = [...profile.skills, ...toAdd.map((name) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), proficiency: 2 }))];
    const updated = await api.put<Skill[]>(`/api/students/${profile.id}/skills`, merged);
    onProfileUpdate({ ...profile, skills: updated });
    onToast({ variant: "success", title: `Added ${toAdd.length} skill(s) from your resume` });
  }

  return (
    <div className="space-y-5">
      <FieldGroup
        title="Resume / CV"
        description={
          !profile.resumeFileName ? (
            <span className="text-red-600">Required to unlock mock tests and AI interviews.</span>
          ) : (
            "Upload a recent copy of your resume. We'll extract skills and fill your profile automatically."
          )
        }
      >
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            onFileChosen(e.dataTransfer.files?.[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            isDragging
              ? "border-premium-400 bg-premium-50/60"
              : "border-slate-200 hover:border-premium-300 hover:bg-slate-50/60"
          } ${parsing ? "pointer-events-none opacity-60" : ""}`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-premium-50 text-premium-600 flex items-center justify-center">
              <Icon name="upload" size={22} />
            </div>
            <div className="font-semibold text-sm text-slate-800">
              {parsing ? "Reading and parsing your file..." : profile.resumeFileName ? "Drop a new resume to replace, or click to browse" : "Drop your resume here, or click to browse"}
            </div>
            <p className="text-xs text-slate-500">
              PDF, DOCX, TXT, or Markdown — max 2 MB.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => onFileChosen(e.target.files?.[0])}
          />
        </div>

        {profile.resumeFileName && !preview && (
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                <Icon name="file-text" size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">{profile.resumeFileName}</p>
                <p className="text-xs text-slate-500">
                  {profile.resumeUpdatedAt ? `Uploaded ${new Date(profile.resumeUpdatedAt).toLocaleDateString()}` : "Uploaded"}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="btn-ghost btn-sm"
              disabled={parsing}
            >
              <Icon name="pencil" size={14} />
              Replace
            </button>
          </div>
        )}

        {parseError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
            <Icon name="alert-circle" size={16} className="shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}
        {parseWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 flex items-start gap-2">
            <Icon name="alert-triangle" size={16} className="shrink-0 mt-0.5" />
            <span>{parseWarning}</span>
          </div>
        )}
      </FieldGroup>

      {preview && (
        <FieldGroup
          title="Extracted Preview"
          description="Here's what we found in your resume. Review the extracted text and suggested skills."
        >
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Extracted text preview</p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                {preview.text.slice(0, 1500)}{preview.text.length > 1500 ? "…" : ""}
              </div>
            </div>
            {preview.matchedSkills.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">Skills found in your resume</p>
                <div className="flex flex-wrap items-center gap-2">
                  {preview.matchedSkills.map((s) => (
                    <span key={s} className="badge badge-accent capitalize">{s}</span>
                  ))}
                  <button
                    onClick={() => addMatchedSkills(preview.matchedSkills)}
                    className="text-xs font-semibold text-premium-700 hover:underline inline-flex items-center gap-1"
                  >
                    <Icon name="plus" size={12} />
                    Add all to my skills
                  </button>
                </div>
              </div>
            )}
          </div>
        </FieldGroup>
      )}
    </div>
  );
}

function AccountSettingsTab({ profile, onToast, onDeleteClick }: {
  profile: Profile;
  onToast: (t: { variant: "success" | "error"; title: string; description?: string }) => void;
  onDeleteClick: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingPwd, setSavingPwd] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!currentPassword) next.currentPassword = "Enter your current password";
    if (newPassword.length < 6) next.newPassword = "New password must be at least 6 characters";
    if (newPassword !== confirmPassword) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function changePassword() {
    if (!validate()) return;
    setSavingPwd(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setErrors({});
      onToast({ variant: "success", title: "Password updated" });
    } catch (e) {
      onToast({ variant: "error", title: "Failed to update password", description: e instanceof ApiError ? e.message : undefined });
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <div className="space-y-5">
      <FieldGroup
        title="Change Password"
        description="Update your account password. Use a strong, unique password."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Current Password" htmlFor="currentPassword" error={errors.currentPassword}>
            <input id="currentPassword" type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <Field label="New Password" htmlFor="newPassword" error={errors.newPassword}>
            <input id="newPassword" type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Confirm New Password" htmlFor="confirmPassword" error={errors.confirmPassword}>
            <input id="confirmPassword" type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>
        </div>
        <div className="pt-2">
          <button onClick={changePassword} disabled={savingPwd} className="btn-primary btn-sm">
            <Icon name="lock" size={14} />
            {savingPwd ? "Updating..." : "Update Password"}
          </button>
        </div>
      </FieldGroup>

      <FieldGroup
        title="Account Email"
        description="This is the email you use to sign in."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadRow label="Email Address" value={profile.email} />
        </div>
      </FieldGroup>

      <FieldGroup
        title="Danger Zone"
        description="Irreversible actions. Be careful before proceeding."
      >
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Icon name="trash-2" size={18} />
            </div>
            <div>
              <p className="font-semibold text-sm text-red-900">Delete my account permanently</p>
              <p className="text-xs text-red-700 mt-0.5">
                All your data, progress, and history will be removed and cannot be restored.
              </p>
            </div>
          </div>
          <button onClick={onDeleteClick} className="btn-danger btn-sm whitespace-nowrap shrink-0">
            <Icon name="trash-2" size={14} />
            Delete Account
          </button>
        </div>
      </FieldGroup>
    </div>
  );
}

function StickyActionBar({ visible, saving, onSaveDraft, onSave, onCancel }: {
  visible: boolean; saving: boolean;
  onSaveDraft: () => void; onSave: () => void; onCancel: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500 hidden sm:block">
          <Icon name="info" size={12} className="inline mr-1" />
          You are editing your profile. Don't forget to save your changes.
        </div>
        <div className="flex gap-2 ml-auto sm:ml-0">
          <button onClick={onCancel} className="btn-secondary btn-sm" disabled={saving}>
            Cancel
          </button>
          <button onClick={onSaveDraft} className="btn-subtle btn-sm" disabled={saving}>
            <Icon name="pencil" size={12} />
            Save Draft
          </button>
          <button onClick={onSave} className="btn-primary btn-sm" disabled={saving}>
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icon name="check" size={14} />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
