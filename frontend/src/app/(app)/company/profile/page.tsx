"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { api } from "@/services/api";
import { JOB_CATEGORIES } from "@/config/constants";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/config/firebase";
import { toast } from "sonner";
import { ICompanyProfile } from "@/types";

const RUBRO_EMOJI: Record<string, string> = {
  gastronomia: "🍳",
  comercio: "🏪",
  construccion: "🏗️",
  limpieza: "🧹",
  transporte: "🚗",
  administracion: "💼",
};

export default function CompanyProfilePage() {
  const router = useRouter();
  const { user, userData, loading, refreshUserData } = useAuth();
  const { setPageConfig } = usePageTitle();

  const isCompany =
    userData?.role === "company" ||
    (userData?.role === "superuser" && !!userData?.impersonating?.companyId);

  const [formData, setFormData] = useState({
    businessName: "",
    contactName: "",
    rubro: "",
    localidad: "",
    description: "",
    address: "",
    phone: "",
  });
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);

  const sub = userData?.companySubscription;

  useEffect(() => {
    setPageConfig({ title: "Mi Empresa", showBack: true, backHref: "/home" });
  }, [setPageConfig]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!loading && user && userData?.role && !isCompany) {
      router.push("/home");
    }
  }, [loading, user, userData, isCompany, router]);

  useEffect(() => {
    if (userData?.profile) {
      const p = userData.profile as ICompanyProfile;
      setFormData({
        businessName: p.businessName || "",
        contactName: p.contactName || "",
        rubro: p.rubro || "",
        localidad: p.localidad || "",
        description: p.description || "",
        address: p.address || "",
        phone: p.phone || "",
      });
      setPhotoUrl(p.photoUrl || "");
    }
  }, [userData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Subí una imagen (PNG/JPG)");
      return;
    }
    setPhotoBlob(file);
    setPhotoUrl("");
  };
  const handlePhotoDeleted = () => {
    setPhotoBlob(null);
    setPhotoUrl("");
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoBlob || !user || !storage) return null;
    const fileName = `photos/${user.uid}/${Date.now()}.jpg`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, photoBlob);
    return getDownloadURL(storageRef);
  };

  const handleSubmit = async () => {
    if (!formData.businessName) {
      toast.error("Completá la razón social");
      return;
    }
    setSaving(true);
    try {
      let finalPhotoUrl = photoUrl;
      if (photoBlob) {
        toast.loading("Subiendo logo...", { id: "upload-photo" });
        const uploaded = await uploadPhoto();
        if (uploaded) finalPhotoUrl = uploaded;
        toast.dismiss("upload-photo");
      }
      await api.updateCompanyProfile({ ...formData, photoUrl: finalPhotoUrl });
      await refreshUserData();
      toast.success("Perfil guardado");
      router.push("/home");
    } catch (error) {
      toast.dismiss("upload-photo");
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Plan / Suscripción (solo lectura) */}
      {sub && (
        <div className="theme-bg-card border theme-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold theme-text-primary">Tu plan</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                sub.expired ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"
              }`}
            >
              {sub.expired ? "Vencido" : "Activo"}
            </span>
          </div>
          <p className="text-lg font-bold theme-text-primary mt-1">
            {sub.planName || "Sin plan"}
          </p>
          <div className="grid grid-cols-2 gap-y-1.5 text-sm mt-2">
            <div className="theme-text-muted">Vence</div>
            <div className="theme-text-secondary">
              {periodEnd ? periodEnd.toLocaleDateString("es-AR") : "—"}
            </div>
            <div className="theme-text-muted">IA análisis de CV</div>
            <div className="theme-text-secondary">{sub.aiCvEnabled ? "Habilitada" : "No incluida"}</div>
            <div className="theme-text-muted">CVs analizados</div>
            <div className="theme-text-secondary">
              {sub.cvAnalysesUsed}
              {sub.maxCvAnalyses === -1 ? " / ∞" : ` / ${sub.maxCvAnalyses}`}
            </div>
          </div>
          {sub.expired && (
            <p className="text-xs text-red-600 mt-2">
              Contactá al administrador para renovar tu plan.
            </p>
          )}
        </div>
      )}

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium theme-text-secondary mb-2">
          Logo de la empresa
        </label>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 theme-border flex items-center justify-center theme-bg-card flex-shrink-0">
            {photoBlob || photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoBlob ? URL.createObjectURL(photoBlob) : photoUrl}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl">🏢</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="px-4 py-2 rounded-xl border-2 theme-border theme-text-secondary text-sm font-medium cursor-pointer hover:theme-text-primary text-center">
              Subir imagen
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            {(photoBlob || photoUrl) && (
              <button
                type="button"
                onClick={handlePhotoDeleted}
                className="px-4 py-2 rounded-xl text-sm theme-text-muted hover:text-red-600"
              >
                Quitar logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Razón social */}
      <div>
        <label className="block text-sm font-medium theme-text-secondary mb-2">Razón social *</label>
        <input
          type="text"
          value={formData.businessName}
          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
          placeholder="Ej: Synergy S.A."
          className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Contacto RRHH */}
      <div>
        <label className="block text-sm font-medium theme-text-secondary mb-2">Contacto de RRHH</label>
        <input
          type="text"
          value={formData.contactName}
          onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
          placeholder="Nombre del responsable"
          className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Rubro */}
      <div>
        <label className="block text-sm font-medium theme-text-secondary mb-2">Rubro principal</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(JOB_CATEGORIES).map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData({ ...formData, rubro: key })}
              className={`p-4 rounded-xl border-2 text-left transition-all active:scale-95 ${
                formData.rubro === key
                  ? "border-[#E10600] bg-[#E10600]/10"
                  : "theme-border theme-bg-card"
              }`}
            >
              <span className="text-2xl block mb-1">{RUBRO_EMOJI[key] || "•"}</span>
              <span className="font-medium theme-text-primary">{value.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Localidad */}
      <div>
        <label className="block text-sm font-medium theme-text-secondary mb-2">Localidad</label>
        <input
          type="text"
          value={formData.localidad}
          onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
          placeholder="Ej: Mar del Plata"
          className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Teléfono */}
      <div>
        <label className="block text-sm font-medium theme-text-secondary mb-2">Teléfono de contacto</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="223-4567890"
          className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Dirección */}
      <div>
        <label className="block text-sm font-medium theme-text-secondary mb-2">Dirección</label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Av. Colón 1234"
          className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium theme-text-secondary mb-2">Sobre la empresa</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Contá sobre tu empresa..."
          rows={3}
          className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none resize-none"
        />
      </div>

      {/* Guardar */}
      <button
        onClick={handleSubmit}
        disabled={saving || !formData.businessName}
        className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
