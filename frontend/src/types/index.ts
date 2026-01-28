// ============================================
// User Types
// ============================================

export type UserRole = 'worker' | 'employer' | 'superuser';
export type AppRole = 'worker' | 'employer';

export interface UserData {
  uid: string;
  email: string | null;
  role?: UserRole;
  secondaryRole?: AppRole; // For superusers: their role in the app
  profile?: WorkerProfile | EmployerProfile;
}

// ============================================
// Worker Types
// ============================================

export interface WorkerProfile {
  uid?: string;
  rubro: string;
  puesto: string;
  zona: string;
  videoUrl?: string;
  description?: string;
  experience?: string;
  active?: boolean;
}

// ============================================
// Employer Types
// ============================================

export interface EmployerProfile {
  uid?: string;
  businessName: string;
  rubro: string;
  description?: string;
  address?: string;
  phone?: string;
}

// ============================================
// Job Types
// ============================================

export interface JobOffer {
  id: string;
  employerId?: string;
  rubro: string;
  puesto: string;
  description?: string;
  requirements?: string;
  salary?: string;
  schedule?: string;
  active: boolean;
  createdAt?: string;
}

export interface JobCategory {
  label: string;
  puestos: readonly string[];
}

export type JobCategories = {
  [key: string]: JobCategory;
};

// ============================================
// Match Types
// ============================================

export type MatchStatus = 'pending' | 'accepted' | 'rejected';

export interface Match {
  id: string;
  workerId: string;
  employerId: string;
  offerId: string;
  rubro: string;
  puesto: string;
  status: MatchStatus;
  createdAt: string;
  worker?: WorkerProfile;
  employer?: EmployerProfile;
  jobOffer?: Pick<JobOffer, 'rubro' | 'puesto' | 'description' | 'salary'>;
}

// ============================================
// Chat Types
// ============================================

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  matchId: string;
  workerId: string;
  employerId: string;
  lastMessage?: string;
  lastMessageAt?: string;
  participant?: {
    businessName?: string;
    rubro?: string;
    puesto?: string;
    zona?: string;
  };
}

// ============================================
// API Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateWorkerProfileData {
  rubro: string;
  puesto: string;
  zona?: string;
  description?: string;
  experience?: string;
  videoUrl?: string;
}

export interface CreateEmployerProfileData {
  businessName: string;
  rubro: string;
  description?: string;
  address?: string;
  phone?: string;
}

export interface CreateJobOfferData {
  rubro: string;
  puesto: string;
  description?: string;
  salary?: string;
  schedule?: string;
}

// ============================================
// Admin Types
// ============================================

export interface AdminUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  emailVerified?: boolean;
  authDisabled?: boolean;
  role: UserRole;
  disabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  profile?: WorkerProfile | EmployerProfile | null;
  jobOffers?: JobOffer[];
}

export interface AdminUserDetail {
  user: AdminUser & {
    displayName?: string;
    photoURL?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
  };
  profile: WorkerProfile | EmployerProfile | null;
  stats: {
    matches: number;
    jobOffers: number;
    chats: number;
  };
}

export interface AdminStats {
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

export interface AdminJobOffer extends JobOffer {
  employer?: EmployerProfile;
}

export interface AdminMatch extends Match {
  worker?: WorkerProfile;
  employer?: EmployerProfile;
}

export interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  [key: string]: T[] | number;
}
