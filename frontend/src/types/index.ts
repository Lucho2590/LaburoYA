// ============================================
// User Types
// ============================================

export enum EUserRole {
  WORKER = 'worker',
  EMPLOYER = 'employer',
  COMPANY = 'company',
  SUPERUSER = 'superuser',
}

export enum EAppRole {
  WORKER = 'worker',
  EMPLOYER = 'employer',
}

// Estado de impersonación: un superuser "entrando" a una empresa concreta.
export interface IImpersonation {
  companyId: string;
  businessName?: string | null;
}

export interface IUserData {
  uid: string;
  email: string | null;
  role?: EUserRole;
  secondaryRole?: EAppRole; // For superusers: their role in the app
  organizationId?: string; // Para cuentas empresa: uid de la organización (dueño)
  profile?: IWorkerProfile | IEmployerProfile | ICompanyProfile;
  // Estado de suscripción (solo cuentas empresa)
  companySubscription?: ICompanySubscriptionSummary | null;
  // Active company impersonation (superuser viendo como una empresa)
  impersonating?: IImpersonation | null;
  // Basic info from onboarding
  firstName?: string;
  lastName?: string;
  age?: number;
  nickname?: string;
  onboardingCompleted?: boolean;
  aiCvEnabled?: boolean; // Admin-controlled: AI CV-assessment module enabled
}

// ============================================
// Shared Types
// ============================================

export interface IGeoLocation {
  lat: number;
  lng: number;
}

// ============================================
// Worker Types
// ============================================

export interface IWorkerProfile {
  uid?: string;
  rubro: string;
  puesto: string;
  zona: string;
  localidad?: string;
  city?: string | null;
  photoUrl?: string;
  videoUrl?: string;
  description?: string;
  experience?: string;
  skills?: string[];
  active?: boolean;
  location?: IGeoLocation | null;
}

// ============================================
// Employer Types
// ============================================

export interface IEmployerProfile {
  uid?: string;
  businessName: string;
  rubro: string;
  localidad?: string;
  photoUrl?: string;
  description?: string;
  address?: string;
  phone?: string;
}

// ============================================
// Company Types (cuenta empresa multiusuario)
// ============================================

export interface ICompanySubscription {
  planId?: string | null;
  planName?: string | null;
  durationMonths?: number | null;
  startedAt?: string | null;
  currentPeriodEnd?: string | null;
  aiCvEnabled?: boolean;
  maxCvAnalyses?: number; // -1 = ilimitado
  cvAnalysesUsed?: number;
  status?: 'active' | 'expired' | 'inactive';
}

// Resumen de suscripción que devuelve /auth/me para la empresa actual.
export interface ICompanySubscriptionSummary {
  active: boolean;
  expired: boolean;
  currentPeriodEnd: string | null;
  planId: string | null;
  planName: string | null;
  aiCvEnabled: boolean;
  maxCvAnalyses: number;
  cvAnalysesUsed: number;
}

// Plan de empresa (vigencia + IA + cupo de CVs).
export interface ICompanyPlan {
  id: string;
  name: string;
  description?: string;
  durationMonths: number;
  aiCvEnabled: boolean;
  maxCvAnalyses: number; // -1 = ilimitado
  price?: number;
  isDefault?: boolean;
  active: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICreateCompanyPlanData {
  name: string;
  description?: string;
  durationMonths: number;
  aiCvEnabled: boolean;
  maxCvAnalyses: number;
  price?: number;
  isDefault?: boolean;
  active?: boolean;
  order?: number;
}

export interface IUpdateCompanyPlanData extends Partial<ICreateCompanyPlanData> {}

export interface ICompanyKpis {
  totalOffers: number;
  totalCandidatesEvaluated: number;
  totalHires: number;
  talentPoolSize: number;
  updatedAt?: string | null;
}

export interface ICompanyProfile {
  uid?: string;
  organizationId?: string;
  businessName: string;
  contactName?: string | null;
  rubro?: string | null;
  localidad?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  active?: boolean;
  maxMembers?: number | null; // límite de cuentas del equipo (incluye al dueño); null = sin límite
  subscription?: ICompanySubscription;
  kpis?: ICompanyKpis;
  onboarding?: { completed: boolean; steps?: Record<string, unknown> };
}

// Miembro del equipo de una cuenta empresa.
export interface ICompanyMember {
  uid: string;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isOwner: boolean;
  createdAt?: string | null;
}

// Entrada del talent pool de la empresa (CV analizado y guardado).
export interface ICompanyCandidate {
  id: string;
  candidate: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    puesto?: string | null;
    zona?: string | null;
    city?: string | null;
    skills?: string[];
  };
  fileUrl?: string | null;
  sourceOfferIds?: string[];
  lastAssessment?: {
    score: number;
    stars: number;
    recommendation?: string | null;
    summary?: string | null;
    offerId?: string | null;
    assessedAt?: string;
  } | null;
  relevance?: IRelevance;
}

// ============================================
// Job Types
// ============================================

export interface IJobOffer {
  id: string;
  employerId?: string;
  rubro: string;
  puesto: string;
  description?: string;
  requirements?: string;
  salary?: string;
  schedule?: string;
  requiredSkills?: string[];
  zona?: string;
  city?: string | null;
  radiusKm?: number | null;
  location?: IGeoLocation | null;
  active: boolean;
  durationDays?: number;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  aiAssessEnabled?: boolean; // Per-offer toggle: use AI for CV assessment (default true)
}

export interface IJobCategory {
  label: string;
  puestos: readonly string[];
}

export type TJobCategories = {
  [key: string]: IJobCategory;
};

// ============================================
// Match Types
// ============================================

export type TMatchStatus = 'pending' | 'accepted' | 'rejected';

export interface IMatch {
  id: string;
  workerId: string;
  employerId: string;
  offerId: string;
  rubro: string;
  puesto: string;
  status: TMatchStatus;
  createdAt: string;
  worker?: IWorkerProfile;
  employer?: IEmployerProfile;
  jobOffer?: Pick<IJobOffer, 'rubro' | 'puesto' | 'description' | 'salary'>;
}

// ============================================
// Chat Types
// ============================================

export interface IMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface IChat {
  id: string;
  matchId: string;
  workerId: string;
  employerId: string;
  lastMessage?: string;
  lastMessageAt?: string;
  participant?: {
    // Employer fields
    businessName?: string;
    // Worker fields
    puesto?: string;
    // Common fields
    rubro?: string;
    zona?: string;
    photoUrl?: string;
    // User info
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

// ============================================
// Contact Request Types
// ============================================

export type TContactRequestStatus = 'pending' | 'accepted' | 'rejected' | 'matched';

export interface IContactRequest {
  id: string;
  fromUid: string;
  fromType: 'worker' | 'employer';
  toUid: string;
  toType: 'worker' | 'employer';
  workerId: string;
  employerId: string;
  offerId: string;
  status: TContactRequestStatus;
  matchId?: string;
  createdAt: string;
  expiresAt?: string;
  worker?: IWorkerProfile;
  employer?: IEmployerProfile;
  jobOffer?: IJobOffer;
}

// ============================================
// Discovery Types
// ============================================

export type TMatchType = 'full_match' | 'partial_match' | 'skills_match';

export interface IRelevanceDetails {
  rubroMatch: boolean;
  puestoMatch: boolean;
  zonaMatch: boolean;
  distanceKm?: number | null;
  approximate?: boolean; // distancia estimada vía centroide de zona (no GPS preciso)
  matchingSkills: string[];
  bonuses: string[];
}

export interface IRelevance {
  score: number;
  stars?: number; // 1-5 derived from score (backend is the source of truth)
  matchType: TMatchType | null;
  details: IRelevanceDetails;
}

export interface IRelevantOffer extends IJobOffer {
  employer?: IEmployerProfile;
  relevance: IRelevance;
  hasRequested?: boolean;
}

export interface IRelevantWorker extends IWorkerProfile {
  relevance: IRelevance;
  bestScore?: number;
  bestStars?: number;
  bestMatchType?: TMatchType;
  bestOffer?: IJobOffer;
  hasRequested?: boolean;
  // User info (from users collection)
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface IDiscoveryOffersResponse {
  fullMatch: IRelevantOffer[];
  partialMatch: IRelevantOffer[];
  skillsMatch: IRelevantOffer[];
  total: number;
}

export interface IDiscoveryWorkersResponse {
  fullMatch: IRelevantWorker[];
  partialMatch: IRelevantWorker[];
  skillsMatch: IRelevantWorker[];
  total: number;
}

// ============================================
// Notification Types
// ============================================

export type TNotificationType =
  | 'contact_request_received'
  | 'contact_request_accepted'
  | 'contact_request_rejected'
  | 'match_created'
  | 'new_message';

export interface IAppNotification {
  id: string;
  userId: string;
  type: TNotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

// ============================================
// API Types
// ============================================

export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ICreateWorkerProfileData {
  rubro: string;
  puesto: string;
  zona?: string;
  localidad?: string;
  city?: string | null;
  description?: string;
  experience?: string;
  photoUrl?: string;
  videoUrl?: string;
  skills?: string[];
  location?: IGeoLocation | null;
}

export interface ICreateEmployerProfileData {
  businessName: string;
  rubro: string;
  localidad?: string;
  photoUrl?: string;
  description?: string;
  address?: string;
  phone?: string;
}

export interface ICreateJobOfferData {
  rubro: string;
  puesto: string;
  description?: string;
  salary?: string;
  schedule?: string;
  requiredSkills?: string[];
  zona?: string;
  city?: string | null;
  radiusKm?: number | null;
  businessName?: string;
  availability?: 'part-time' | 'full-time';
  location?: IGeoLocation | null;
}

// ============================================
// Admin Types
// ============================================

export interface IAdminUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string; // From Firebase Auth
  emailVerified?: boolean;
  authDisabled?: boolean;
  role: EUserRole;
  disabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  profile?: IWorkerProfile | IEmployerProfile | ICompanyProfile | null;
  jobOffers?: IJobOffer[];
  // Campos de Firestore (users collection)
  firstName?: string;
  lastName?: string;
  phone?: string; // From Firestore
  age?: number;
  nickname?: string;
  onboardingCompleted?: boolean;
  secondaryRole?: string;
  organizationId?: string;
  aiCvEnabled?: boolean; // Admin-controlled: AI CV-assessment module enabled
  lastLocation?: {
    city?: string;
    region?: string;
    country?: string;
    updatedAt?: string;
  };
}

export type TLocationStatus = 'in_zone' | 'out_of_zone' | 'unknown';

export interface ICvCandidate {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  rubro: string | null;
  puesto: string | null;
  zona: string | null;
  city: string | null;
  description: string | null;
  experience: string | null;
  skills: string[];
}

export interface IAssessCvResponse {
  mode: 'basic' | 'ai';
  source?: 'text' | 'ocr'; // ai mode only
  id?: string; // ranking entry id (persisted automatically)
  duplicate?: 'file' | 'person'; // 'file' = mismo archivo; 'person' = misma persona
  existingId?: string; // id de la entrada ya existente (para comparar/avisar)
  candidate: Partial<ICvCandidate> & {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
  assessment: {
    score: number;
    stars?: number; // 1-5 derived from score (backend)
    matchingSkills: string[];
    missingSkills: string[];
    // ai mode (recruiter verdict)
    recommendation?: 'yes' | 'maybe' | 'no';
    summary?: string;
    strengths?: string[];
    gaps?: string[];
    // basic mode (structural match)
    matchType?: 'full_match' | 'partial_match' | 'skills_match' | null;
    rubroMatch?: boolean;
    puestoMatch?: boolean;
    zonaMatch?: boolean;
    // ubicación del candidato respecto a la oferta
    locationStatus?: TLocationStatus;
    distanceKm?: number | null;
  };
}

export interface IPinnedCandidate {
  id: string;
  selected?: boolean;
  fileHash?: string;
  candidate: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    puesto?: string | null;
    zona?: string | null;
    city?: string | null;
    skills?: string[];
  };
  assessment: {
    mode: 'basic' | 'ai';
    source?: 'text' | 'ocr';
    score: number;
    stars: number;
    matchType?: 'full_match' | 'partial_match' | 'skills_match' | null;
    recommendation?: 'yes' | 'maybe' | 'no';
    summary?: string | null;
    strengths?: string[];
    gaps?: string[];
    matchingSkills: string[];
    missingSkills: string[];
    locationStatus?: TLocationStatus;
    distanceKm?: number | null;
  };
  createdAt?: string;
}

export interface IAdminUserDetail {
  user: IAdminUser & {
    displayName?: string;
    photoURL?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
  };
  profile: IWorkerProfile | IEmployerProfile | ICompanyProfile | null;
  stats: {
    matches: number;
    jobOffers: number;
    chats: number;
  };
}

export interface IAdminStats {
  totalUsers: number;
  usersByRole: {
    worker: number;
    employer: number;
    superuser: number;
  };
  totalMatches: number;
  matchesByStatus: {
    pending: number;
    accepted: number;
    rejected: number;
  };
  totalJobOffers: number;
  activeJobOffers: number;
  inactiveJobOffers: number;
}

export interface IAdminJobOffer extends IJobOffer {
  employer?: IEmployerProfile;
}

export interface IAdminMatch extends IMatch {
  worker?: IWorkerProfile;
  employer?: IEmployerProfile;
}

// Perfil de worker "huérfano": existe en `workers` pero no en `users`.
export interface IOrphanWorker {
  uid: string;
  puesto: string | null;
  rubro: string | null;
  zona: string | null;
  active: boolean;
  hasVideo: boolean;
  createdAt: string | null;
}

export interface IPaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  [key: string]: T[] | number;
}

// ============================================
// Plan Types (Monetización)
// ============================================

export interface IPlan {
  id: string;
  name: string;
  description?: string;
  price: number; // en pesos, 0 = gratis
  maxOffers: number; // -1 = ilimitado
  visibleCandidatesPerOffer: number; // -1 = ilimitado
  offerDurationDays: number;
  isDefault?: boolean; // Plan para primera oferta gratis
  active: boolean;
  order?: number; // Para ordenar en la UI
  createdAt?: string;
  updatedAt?: string;
}

export interface ICreatePlanData {
  name: string;
  description?: string;
  price: number;
  maxOffers: number;
  visibleCandidatesPerOffer: number;
  offerDurationDays: number;
  isDefault?: boolean;
  active?: boolean;
  order?: number;
}

export interface IUpdatePlanData extends Partial<ICreatePlanData> {}

// ============================================
// Rubro Types (Dynamic job categories)
// ============================================

export interface IRubro {
  id: string;
  nombre: string;
  icono: string;
  activo: boolean;
  orden: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICreateRubroData {
  nombre: string;
  icono?: string;
  activo?: boolean;
  orden?: number;
}

export interface IUpdateRubroData extends Partial<ICreateRubroData> {}

// ============================================
// City Types (Ciudades donde opera la app)
// ============================================

export interface ICity {
  id: string;
  nombre: string;
  center: IGeoLocation;
  radiusKm: number;
  zonas: string[];
  activo: boolean;
  orden: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICreateCityData {
  nombre: string;
  center: IGeoLocation;
  radiusKm: number;
  zonas?: string[];
  activo?: boolean;
  orden?: number;
}

export interface IUpdateCityData extends Partial<ICreateCityData> {}

export interface IGeocodeResult {
  lat: number;
  lng: number;
  displayName: string | null;
  city?: string | null;
}

// ============================================
// Lead Types (Waitlist)
// ============================================

export interface ILead {
  id: string;
  nombre: string;
  telefono: string;
  rubroId: string;
  rubroNombre?: string;
  contacted: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICreateLeadData {
  nombre: string;
  telefono: string;
  rubroId: string;
}

export interface ILeadStats {
  total: number;
  contacted: number;
  pending: number;
  byRubro: Record<string, number>;
}

// ============================================
// Settings Types
// ============================================

export interface ITermsAndConditions {
  content: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface IWhatsAppTemplate {
  template: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ============================================
// AI Error Log Types
// ============================================

export interface IAiError {
  id: string;
  employerId?: string | null;
  employerEmail?: string | null;
  offerId?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  type?: string | null;
  status?: number | null;
  rateLimited?: boolean;
  rateScope?: string | null;
  message?: string | null;
  cause?: string | null;
  createdAt?: string;
}
