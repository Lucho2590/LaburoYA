// ============================================
// User Types
// ============================================

export enum EUserRole {
  WORKER = 'worker',
  EMPLOYER = 'employer',
  SUPERUSER = 'superuser',
}

export enum EAppRole {
  WORKER = 'worker',
  EMPLOYER = 'employer',
}

export interface IUserData {
  uid: string;
  email: string | null;
  role?: EUserRole;
  secondaryRole?: EAppRole; // For superusers: their role in the app
  profile?: IWorkerProfile | IEmployerProfile;
  // Basic info from onboarding
  firstName?: string;
  lastName?: string;
  age?: number;
  nickname?: string;
  onboardingCompleted?: boolean;
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
  photoUrl?: string;
  videoUrl?: string;
  description?: string;
  experience?: string;
  skills?: string[];
  active?: boolean;
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
  active: boolean;
  durationDays?: number;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
  matchingSkills: string[];
  bonuses: string[];
}

export interface IRelevance {
  score: number;
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
  description?: string;
  experience?: string;
  photoUrl?: string;
  videoUrl?: string;
  skills?: string[];
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
  businessName?: string;
  availability?: 'part-time' | 'full-time';
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
  profile?: IWorkerProfile | IEmployerProfile | null;
  jobOffers?: IJobOffer[];
  // Campos de Firestore (users collection)
  firstName?: string;
  lastName?: string;
  phone?: string; // From Firestore
  age?: number;
  nickname?: string;
  onboardingCompleted?: boolean;
  secondaryRole?: string;
  lastLocation?: {
    city?: string;
    region?: string;
    country?: string;
    updatedAt?: string;
  };
}

export interface IAdminUserDetail {
  user: IAdminUser & {
    displayName?: string;
    photoURL?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
  };
  profile: IWorkerProfile | IEmployerProfile | null;
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
