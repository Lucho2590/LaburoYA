"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutGrid, Users, Building2, Briefcase, CheckCircle2, UserPlus, MapPin, Tag,
  DollarSign, FileText, Sparkles, ScrollText, Lock, QrCode, Trash2, ChevronDown,
  ListChecks,
} from "lucide-react";
import { EAppRole } from "@/types";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

const NAV_COLLAPSED_KEY = "laburoya:sudoNavCollapsed";

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userData, loading, signOut, setSecondaryRole, stopImpersonatingCompany } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [changingRole, setChangingRole] = useState(false);
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  // Secciones plegadas. Se hidrata en un efecto y no en el useState inicial
  // para no romper la hidratación de Next (el server no tiene localStorage).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      // Ignorar: si no se puede leer, arrancan todas abiertas.
    }
  }, []);

  const isSuperuser = userData?.role === "superuser";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (!loading && user && userData?.role !== "superuser") {
      router.push("/home");
    }
  }, [loading, user, userData, router]);

  if (loading || !isSuperuser) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  // Secciones del panel. Antes era una lista plana de 15 items en orden
  // histórico (entidades, huérfanos, catálogos y config mezclados) con un SVG
  // inline de ~18 líneas cada uno: casi 300 de las 589 líneas del archivo.
  const navSections = [
    {
      id: "comunidad",
      label: "Comunidad",
      items: [
        { href: "/sudo/users", label: "Usuarios", icon: Users },
        { href: "/sudo/companies", label: "Empresas", icon: Building2 },
      ],
    },
    {
      id: "actividad",
      label: "Actividad",
      items: [
        { href: "/sudo/jobs", label: "Ofertas", icon: Briefcase },
        { href: "/sudo/matches", label: "Matches", icon: CheckCircle2 },
        { href: "/sudo/leads", label: "Leads", icon: UserPlus },
      ],
    },
    {
      id: "configuracion",
      label: "Configuración",
      items: [
        { href: "/sudo/cities", label: "Ciudades", icon: MapPin },
        { href: "/sudo/rubros", label: "Rubros", icon: Tag },
        { href: "/sudo/skills", label: "Skills", icon: ListChecks },
        { href: "/sudo/plans", label: "Planes", icon: DollarSign },
        { href: "/sudo/company-plans", label: "Planes Empresa", icon: FileText },
        { href: "/sudo/ai-settings", label: "IA", icon: Sparkles },
        { href: "/sudo/tyc", label: "TyC", icon: ScrollText },
        { href: "/sudo/security", label: "Seguridad", icon: Lock },
      ],
    },
    {
      id: "herramientas",
      label: "Herramientas",
      items: [
        { href: "/sudo/qr", label: "Generador de QR", icon: QrCode },
        { href: "/sudo/limpieza", label: "Limpieza de datos", icon: Trash2 },
      ],
    },
  ];

  // Coincidencia exacta o con "/" al final. El startsWith pelado que había antes
  // marcaba como activa cualquier ruta que empezara igual (/sudo/users-algo).
  const isActiveHref = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Una sección se ve abierta si el usuario la dejó así, o si contiene la ruta
  // actual: entrando por URL directa, el item activo no puede quedar escondido.
  const isSectionOpen = (section: { id: string; items: { href: string }[] }) => {
    if (section.items.some((i) => isActiveHref(i.href))) return true;
    return collapsed[section.id] !== true;
  };

  const toggleSection = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(NAV_COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // Modo privado o storage lleno: no vale romper la navegación por esto.
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleStopImpersonation = async () => {
    setStoppingImpersonation(true);
    try {
      await stopImpersonatingCompany();
    } catch (error) {
      console.error("Error stopping impersonation:", error);
    } finally {
      setStoppingImpersonation(false);
    }
  };

  const handleSecondaryRoleChange = async (role: EAppRole) => {
    setChangingRole(true);
    try {
      await setSecondaryRole(role);
    } catch (error) {
      console.error("Error changing secondary role:", error);
    } finally {
      setChangingRole(false);
    }
  };

  return (
    <div className="h-screen theme-bg-primary flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 theme-bg-secondary border-r theme-border flex flex-col h-screen flex-shrink-0">
        {/* Logo */}
        <div className="p-4 border-b theme-border flex-shrink-0">
          <Link href="/sudo" className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#E10600]">LaburoYA</span>
            <span className="text-xs px-2 py-1 bg-[#E10600] text-white rounded-full font-medium">
              Admin
            </span>
          </Link>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 p-3 overflow-y-auto space-y-1">
          {/* Dashboard queda suelto arriba: es la entrada, no pertenece a
              ninguna sección. */}
          <Link
            href="/sudo"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              pathname === "/sudo"
                ? "bg-[#E10600] text-white"
                : "theme-text-secondary hover:theme-bg-card"
            }`}
          >
            <LayoutGrid className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium text-sm">Dashboard</span>
          </Link>

          {navSections.map((section) => {
            const open = isSectionOpen(section);
            return (
              <div key={section.id} className="pt-2">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 theme-text-muted hover:theme-text-secondary transition-colors cursor-pointer"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {section.label}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
                  />
                </button>

                {open && (
                  <ul className="space-y-1 mt-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isActiveHref(item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                              isActive
                                ? "bg-[#E10600] text-white"
                                : "theme-text-secondary hover:theme-bg-card"
                            }`}
                          >
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            <span className="font-medium text-sm">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t theme-border flex-shrink-0">
          {/* Impersonación activa de una empresa */}
          {userData?.impersonating?.companyId && (
            <div className="px-3 py-2 mb-2 rounded-lg bg-purple-100 border border-purple-300">
              <p className="text-xs text-purple-800 font-medium">
                Viendo como empresa
              </p>
              <p className="text-sm text-purple-900 font-semibold truncate">
                {userData.impersonating.businessName || userData.impersonating.companyId}
              </p>
              <div className="flex gap-2 mt-1.5">
                <Link
                  href="/home"
                  className="flex-1 text-center text-xs py-1 px-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                >
                  Ir a la app
                </Link>
                <button
                  onClick={handleStopImpersonation}
                  disabled={stoppingImpersonation}
                  className="flex-1 text-xs py-1 px-2 rounded-lg bg-white text-purple-700 border border-purple-300 hover:bg-purple-50 disabled:opacity-50"
                >
                  Salir
                </button>
              </div>
            </div>
          )}

          {/* Secondary Role Selector */}
          <div className="px-3 py-2 mb-2 theme-bg-card rounded-lg">
            <label className="block text-xs theme-text-muted mb-1.5">
              Mi rol en la app
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleSecondaryRoleChange(EAppRole.WORKER)}
                disabled={changingRole}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                  userData?.secondaryRole === "worker"
                    ? "bg-blue-500 text-white"
                    : "theme-bg-secondary theme-text-secondary hover:theme-text-primary"
                }`}
              >
                Trabajador
              </button>
              <button
                onClick={() => handleSecondaryRoleChange(EAppRole.EMPLOYER)}
                disabled={changingRole}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                  userData?.secondaryRole === "employer"
                    ? "bg-green-500 text-white"
                    : "theme-bg-secondary theme-text-secondary hover:theme-text-primary"
                }`}
              >
                Empleador
              </button>
            </div>
            {userData?.secondaryRole && (
              <Link
                href="/home"
                className="block mt-1.5 text-center text-xs text-[#E10600] hover:underline"
              >
                Ir a la app como{" "}
                {userData.secondaryRole === "worker"
                  ? "trabajador"
                  : "empleador"}
              </Link>
            )}

            {/* Entrar como empresa: hay que elegir cuál, lleva al listado */}
            {!userData?.impersonating?.companyId && (
              <Link
                href="/sudo/companies"
                className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t theme-border text-xs font-medium text-purple-600 hover:text-purple-700"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-14h.01M11 7h.01M15 7h.01M7 11h.01M11 11h.01M15 11h.01M7 15h.01M11 15h.01M15 15h.01"
                  />
                </svg>
                Ir como empresa
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
            <div className="w-7 h-7 bg-[#E10600] rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
              {userData?.email?.[0]?.toUpperCase() || "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium theme-text-primary truncate">
                {userData?.email || "Superuser"}
              </p>
              <p className="text-xs theme-text-muted">Superuser</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[#667085] hover:text-[#E10600] transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="text-sm">Cerrar sesion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-14 theme-bg-secondary border-b theme-border flex items-center justify-between px-6 flex-shrink-0">
          <h1 className="text-xl font-semibold theme-text-primary">
            {title || "Panel de Administracion"}
          </h1>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg theme-bg-card hover:opacity-80 transition-opacity"
              aria-label={
                theme === "dark"
                  ? "Cambiar a modo claro"
                  : "Cambiar a modo oscuro"
              }
            >
              {theme === "dark" ? (
                <svg
                  className="w-5 h-5 text-[#FFB703]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-[#667085]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Back to App */}
            <Link
              href="/home"
              className="text-sm theme-text-secondary hover:theme-text-primary transition-colors"
            >
              Volver a la app
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
