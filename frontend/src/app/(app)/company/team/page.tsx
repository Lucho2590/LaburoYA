"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { api } from "@/services/api";
import { ICompanyMember, ICompanyProfile } from "@/types";

export default function CompanyTeamPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const { setPageConfig } = usePageTitle();

  // Solo el dueño (uid === organizationId) o un superuser impersonando.
  const isOwner =
    (userData?.role === "company" && userData?.uid === userData?.organizationId) ||
    (userData?.role === "superuser" && !!userData?.impersonating?.companyId);

  const [members, setMembers] = useState<ICompanyMember[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "" });

  useEffect(() => {
    setPageConfig({ title: "Mi equipo", showBack: false, onBack: undefined });
  }, [setPageConfig]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!loading && user && userData?.role && !isOwner) {
      router.push("/home");
    }
  }, [loading, user, userData, isOwner, router]);

  const fetchMembers = useCallback(async () => {
    if (!isOwner) return;
    setFetching(true);
    setError(null);
    try {
      const data = await api.getCompanyMembers();
      setMembers(data.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el equipo");
    } finally {
      setFetching(false);
    }
  }, [isOwner]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!form.email) {
      setError("El email es obligatorio");
      return;
    }
    setInviting(true);
    try {
      await api.inviteCompanyMember({
        email: form.email,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
      });
      setForm({ email: "", firstName: "", lastName: "" });
      setNotice("Invitación enviada");
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo invitar al miembro");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberUid: string) => {
    setRemovingId(memberUid);
    setError(null);
    try {
      await api.removeCompanyMember(memberUid);
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar al miembro");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading || (!isOwner && !userData?.role)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]" />
      </div>
    );
  }

  const maxMembers = (userData?.profile as ICompanyProfile | undefined)?.maxMembers ?? null;
  const limitReached = maxMembers != null && members.length >= maxMembers;

  return (
    <div className="space-y-5">
      <p className="theme-text-secondary text-sm">
        Invitá a tu equipo de RRHH. Cada persona entra con su propio email y comparte
        las búsquedas y el talent pool de la empresa.
      </p>

      <p className="text-sm theme-text-muted">
        Cuentas usadas: <span className="theme-text-primary font-medium">{members.length}</span>
        {maxMembers != null ? ` de ${maxMembers}` : " (sin límite)"}
        {limitReached && (
          <span className="ml-2 text-red-600">— límite alcanzado, pedí al admin que lo amplíe.</span>
        )}
      </p>

      {error && <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">{error}</div>}
      {notice && <div className="p-3 rounded-lg bg-green-100 text-green-800 text-sm">{notice}</div>}

      {/* Invitar */}
      <form onSubmit={handleInvite} className="theme-bg-card border theme-border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold theme-text-primary text-sm">Invitar a un miembro</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@empresa.com"
            className="sm:col-span-3 w-full p-3 rounded-lg border-2 theme-border theme-bg-secondary theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none text-sm"
            required
          />
          <input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            placeholder="Nombre (opcional)"
            className="w-full p-3 rounded-lg border-2 theme-border theme-bg-secondary theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none text-sm"
          />
          <input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            placeholder="Apellido (opcional)"
            className="w-full p-3 rounded-lg border-2 theme-border theme-bg-secondary theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none text-sm"
          />
          <button
            type="submit"
            disabled={inviting || limitReached}
            className="w-full p-3 rounded-lg bg-[#E10600] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {inviting ? "Enviando..." : limitReached ? "Límite alcanzado" : "Invitar"}
          </button>
        </div>
      </form>

      {/* Lista */}
      {fetching ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]" />
        </div>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
            return (
              <li
                key={m.uid}
                className="theme-bg-card border theme-border rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium theme-text-primary truncate">
                    {name || m.email || m.uid}
                  </p>
                  {name && m.email && (
                    <p className="text-xs theme-text-muted truncate">{m.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.isOwner ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">
                      Dueño
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRemove(m.uid)}
                      disabled={removingId === m.uid}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {removingId === m.uid ? "Quitando..." : "Quitar"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
