import { auth } from '@/config/firebase';
import {
  EUserRole,
  ICreateWorkerProfileData,
  ICreateEmployerProfileData,
  ICreateJobOfferData,
  IJobOffer,
  IWorkerProfile,
  IAdminStats,
  IAdminUser,
  IAdminUserDetail,
  IAdminJobOffer,
  IAdminMatch,
  IOrphanWorker,
  IOrphanOffer,
  IContactRequest,
  IDiscoveryOffersResponse,
  IDiscoveryWorkersResponse,
  IAppNotification,
  IMatch,
  IPlan,
  ICreatePlanData,
  IUpdatePlanData,
  IRubro,
  ICreateRubroData,
  IUpdateRubroData,
  ICity,
  ICreateCityData,
  IUpdateCityData,
  IGeocodeResult,
  ILead,
  ICreateLeadData,
  ILeadStats,
  ITermsAndConditions,
  IAssessCvResponse,
  IPinnedCandidate,
  ICompanyCandidate,
  ICompanyMember,
  ICompanyProfile,
  ICompanyPlan,
  ICreateCompanyPlanData,
  IUpdateCompanyPlanData,
  ICompanySubscriptionSummary,
  IAiError
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  requireAuth?: boolean;
  extraHeaders?: Record<string, string>;
  formData?: FormData;
}

class ApiService {
  private async getAuthToken(): Promise<string | null> {
    if (!auth) return null;
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }

  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, requireAuth = true, extraHeaders, formData } = options;

    const headers: Record<string, string> = {};
    if (!formData) {
      headers['Content-Type'] = 'application/json';
    }

    if (requireAuth) {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: formData ? formData : (body ? JSON.stringify(body) : undefined),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      throw new Error('Invalid JSON response from API');
    }

    if (!response.ok) {
      const err = new Error(data.error || `API request failed with status ${response.status}`) as Error & {
        status?: number; rateLimited?: boolean; rateScope?: string; retryAfter?: number;
      };
      err.status = response.status;
      err.rateLimited = data.rateLimited;
      err.rateScope = data.rateScope;
      err.retryAfter = data.retryAfter;
      throw err;
    }

    return data;
  }

  // Auth
  async registerUser(role: EUserRole) {
    // Obtener referralSource de localStorage si existe
    const referralSource = typeof window !== 'undefined'
      ? localStorage.getItem('referralSource')
      : null;

    const result = await this.request('/auth/register', {
      method: 'POST',
      body: { role, referralSource },
    });

    // Limpiar referralSource después de usarlo
    if (typeof window !== 'undefined' && referralSource) {
      localStorage.removeItem('referralSource');
    }

    return result;
  }

  async checkEmailExists(email: string) {
    return this.request<{ exists: boolean }>('/auth/check-email', {
      method: 'POST',
      body: { email },
      requireAuth: false,
    });
  }

  async updateBasicInfo(data: { firstName: string; lastName: string; phone?: string; age?: number; nickname?: string; businessName?: string; contactName?: string }) {
    return this.request<{ message: string; firstName: string; lastName: string; phone?: string; age?: number; nickname?: string; businessName?: string; contactName?: string }>(
      '/auth/basic-info',
      {
        method: 'PATCH',
        body: data,
      }
    );
  }

  async getCurrentUser() {
    return this.request<{
      user: {
        role: string;
        secondaryRole?: string;
        organizationId?: string;
        impersonatingCompanyId?: string | null;
        firstName?: string;
        lastName?: string;
        age?: number;
        nickname?: string;
        onboardingCompleted?: boolean;
        aiCvEnabled?: boolean;
      };
      profile: unknown;
      impersonating?: { companyId: string; businessName?: string | null };
      companySubscription?: ICompanySubscriptionSummary;
    }>('/auth/me');
  }

  async setSecondaryRole(secondaryRole: 'worker' | 'employer') {
    return this.request<{ message: string; secondaryRole: string }>('/auth/secondary-role', {
      method: 'PATCH',
      body: { secondaryRole },
    });
  }

  // Superuser: entrar/salir de una empresa (impersonación)
  async impersonateCompany(companyId: string) {
    return this.request<{ message: string; companyId: string; businessName?: string | null }>(
      '/auth/impersonate-company',
      { method: 'PATCH', body: { companyId } }
    );
  }

  async stopImpersonatingCompany() {
    return this.request<{ message: string }>('/auth/impersonate-company', {
      method: 'DELETE',
    });
  }

  // Workers
  async createWorkerProfile(data: ICreateWorkerProfileData) {
    return this.request('/workers', {
      method: 'POST',
      body: data,
    });
  }

  async getWorkerProfile() {
    return this.request('/workers/me');
  }

  async updateWorkerStatus(active: boolean) {
    return this.request('/workers/status', {
      method: 'PATCH',
      body: { active },
    });
  }

  // Employers
  async createEmployerProfile(data: ICreateEmployerProfileData) {
    return this.request('/employers', {
      method: 'POST',
      body: data,
    });
  }

  async getEmployerProfile() {
    return this.request('/employers/me');
  }

  async getEmployerDashboard() {
    return this.request<{
      summary: {
        totalOffers: number;
        activeOffers: number;
        totalInterested: number;
        interestedNotContacted: number;
        totalCandidates: number;
        totalMatches: number;
      };
      offers: {
        id: string;
        rubro: string;
        puesto: string;
        description?: string;
        salary?: string;
        schedule?: string;
        zona?: string;
        businessName?: string;
        requiredSkills?: string[];
        active: boolean;
        isExpired: boolean;
        durationDays: number;
        expiresAt?: string;
        createdAt?: string;
        stats: {
          interested: number;
          interestedNotContacted: number;
          candidates: number;
          matches: number;
        };
      }[];
    }>('/employers/dashboard');
  }

  // Job Offers
  async createJobOffer(data: ICreateJobOfferData) {
    return this.request('/job-offers', {
      method: 'POST',
      body: data,
    });
  }

  async getMyJobOffers() {
    return this.request('/job-offers/my-offers');
  }

  async updateJobOffer(id: string, data: Partial<IJobOffer>) {
    return this.request(`/job-offers/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteJobOffer(id: string) {
    return this.request(`/job-offers/${id}`, {
      method: 'DELETE',
    });
  }

  async markOfferNotInterested(offerId: string) {
    return this.request<{ message: string; offerId: string; alreadyMarked?: boolean }>(
      `/job-offers/${offerId}/not-interested`,
      { method: 'POST' }
    );
  }

  async getOfferInterestedWorkers(offerId: string) {
    return this.request<{
      interested: (IWorkerProfile & {
        firstName?: string;
        lastName?: string;
        email?: string;
        hasBeenContacted: boolean;
      })[];
      total: number;
    }>(`/job-offers/${offerId}/interested`);
  }

  // Matches
  async getMatches() {
    return this.request('/matches');
  }

  async updateMatchStatus(id: string, status: 'accepted' | 'rejected') {
    return this.request(`/matches/${id}/status`, {
      method: 'PATCH',
      body: { status },
    });
  }

  // Chats
  async getOrCreateChat(matchId: string) {
    return this.request(`/chats/${matchId}`, {
      method: 'POST',
    });
  }

  async getChatMessages(chatId: string, limit?: number) {
    const params = limit ? `?limit=${limit}` : '';
    return this.request(`/chats/${chatId}/messages${params}`);
  }

  async sendMessage(chatId: string, text: string) {
    return this.request(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: { text },
    });
  }

  async getMyChats() {
    return this.request('/chats');
  }

  // Admin
  async getAdminStats() {
    return this.request<IAdminStats>('/admin/stats');
  }

  async createAdminUser(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    role: 'worker' | 'employer' | 'company';
    plan?: string;
    businessName?: string; // requerido para role 'company'
    companyPlanId?: string; // requerido para role 'company'
    workerProfile?: {
      rubro: string;
      puesto: string;
      zona?: string | null;
      localidad?: string | null;
      description?: string | null;
      experience?: string | null;
      skills?: string[];
    };
  }) {
    return this.request<{
      success: boolean;
      message: string;
      workerProfileCreated?: boolean;
      user: { uid: string; email: string; role: string };
    }>('/admin/users', {
      method: 'POST',
      body: data,
    });
  }

  async getAdminUsers(params?: { role?: EUserRole; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.role) searchParams.set('role', params.role);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.request<{ users: IAdminUser[]; total: number; limit: number; offset: number }>(
      `/admin/users${query ? `?${query}` : ''}`
    );
  }

  async getAdminUser(uid: string) {
    return this.request<IAdminUserDetail>(`/admin/users/${uid}`);
  }

  async updateAdminUser(uid: string, data: { role?: EUserRole; disabled?: boolean; aiCvEnabled?: boolean }) {
    return this.request<{ message: string; user: IAdminUser }>(`/admin/users/${uid}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteAdminUser(uid: string, hard = false) {
    return this.request<{ message: string }>(`/admin/users/${uid}${hard ? '?hard=true' : ''}`, {
      method: 'DELETE',
    });
  }

  async resendAdminUserInvitation(uid: string) {
    return this.request<{ success: boolean; message: string; email: string }>(
      `/admin/users/${uid}/resend-invitation`,
      { method: 'POST' }
    );
  }

  async getAdminJobOffers(params?: { active?: boolean; employerId?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.active !== undefined) searchParams.set('active', params.active.toString());
    if (params?.employerId) searchParams.set('employerId', params.employerId);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.request<{ jobOffers: IAdminJobOffer[]; total: number; limit: number; offset: number }>(
      `/admin/job-offers${query ? `?${query}` : ''}`
    );
  }

  async updateAdminJobOffer(id: string, data: { active?: boolean; durationDays?: number; expiresAt?: string }) {
    return this.request<IAdminJobOffer>(`/admin/job-offers/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async getAdminJobOfferMatches(id: string) {
    return this.request<{
      offerId: string;
      matches: {
        pending: IAdminMatch[];
        accepted: IAdminMatch[];
        rejected: IAdminMatch[];
      };
      total: number;
      counts: { pending: number; accepted: number; rejected: number };
    }>(`/admin/job-offers/${id}/matches`);
  }

  async getAdminMatches(params?: { status?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.request<{ matches: IAdminMatch[]; total: number; limit: number; offset: number }>(
      `/admin/matches${query ? `?${query}` : ''}`
    );
  }

  // Admin - Orphan workers (perfiles de worker sin usuario asociado)
  async getOrphanWorkers() {
    return this.request<{ orphans: IOrphanWorker[]; total: number }>('/admin/orphan-workers');
  }

  async deleteOrphanWorker(uid: string) {
    return this.request<{ message: string }>(`/admin/orphan-workers/${uid}`, {
      method: 'DELETE',
    });
  }

  // Admin - Ofertas para limpiar (huérfanas o creadas por superusers)
  async getOrphanOffers() {
    return this.request<{ offers: IOrphanOffer[]; total: number }>('/admin/orphan-offers');
  }

  async deleteOrphanOffer(id: string) {
    return this.request<{ message: string }>(`/admin/orphan-offers/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin - Plans
  async getAdminPlans(params?: { active?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.active !== undefined) searchParams.set('active', params.active.toString());
    const query = searchParams.toString();
    return this.request<{ plans: IPlan[] }>(`/admin/plans${query ? `?${query}` : ''}`);
  }

  async getAdminPlan(planId: string) {
    return this.request<IPlan>(`/admin/plans/${planId}`);
  }

  async createAdminPlan(data: ICreatePlanData) {
    return this.request<IPlan>('/admin/plans', {
      method: 'POST',
      body: data,
    });
  }

  async updateAdminPlan(planId: string, data: IUpdatePlanData) {
    return this.request<IPlan>(`/admin/plans/${planId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteAdminPlan(planId: string) {
    return this.request<{ message: string }>(`/admin/plans/${planId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Workers - Skills
  // ============================================

  async getSuggestedSkills(rubro: string, puesto: string) {
    return this.request<{ suggested: string[]; allForRubro: string[] }>(
      `/workers/skills/${encodeURIComponent(rubro)}/${encodeURIComponent(puesto)}`,
      { requireAuth: false }
    );
  }

  async getSkillsForRubro(rubro: string) {
    return this.request<{ skills: string[] }>(
      `/workers/skills/${encodeURIComponent(rubro)}`,
      { requireAuth: false }
    );
  }

  // ============================================
  // Contact Requests
  // ============================================

  async sendWorkerToOfferRequest(offerId: string) {
    return this.request<{ message: string; matchCreated: boolean; match?: IMatch; request?: IContactRequest }>(
      '/contact-requests/worker-to-offer',
      {
        method: 'POST',
        body: { offerId },
      }
    );
  }

  async sendEmployerToWorkerRequest(workerId: string, offerId: string) {
    return this.request<{ message: string; matchCreated: boolean; match?: IMatch; request?: IContactRequest }>(
      '/contact-requests/employer-to-worker',
      {
        method: 'POST',
        body: { workerId, offerId },
      }
    );
  }

  async getReceivedContactRequests() {
    return this.request<IContactRequest[]>('/contact-requests/received');
  }

  async getSentContactRequests() {
    return this.request<IContactRequest[]>('/contact-requests/sent');
  }

  async respondToContactRequest(requestId: string, response: 'accepted' | 'rejected') {
    return this.request<{ message: string; matchCreated: boolean; match?: IMatch }>(
      `/contact-requests/${requestId}/respond`,
      {
        method: 'PATCH',
        body: { response },
      }
    );
  }

  async getContactRequestStatus(offerId: string) {
    return this.request<{
      hasSentRequest: boolean;
      sentRequest: { id: string; status: string } | null;
      hasReceivedRequest: boolean;
      receivedRequest: { id: string; status: string } | null;
    }>(`/contact-requests/status/${offerId}`);
  }

  // ============================================
  // Discovery
  // ============================================

  async discoverOffers() {
    return this.request<IDiscoveryOffersResponse>('/discovery/offers');
  }

  async discoverWorkers() {
    return this.request<IDiscoveryWorkersResponse>('/discovery/workers');
  }

  async discoverWorkersForOffer(offerId: string) {
    return this.request<IDiscoveryWorkersResponse & { offerId: string }>(
      `/discovery/workers/for-offer/${offerId}`
    );
  }

  // ============================================
  // Notifications
  // ============================================

  async getNotifications(params?: { limit?: number; unreadOnly?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');
    const query = searchParams.toString();
    return this.request<IAppNotification[]>(`/notifications${query ? `?${query}` : ''}`);
  }

  async getUnreadNotificationCount() {
    return this.request<{ count: number }>('/notifications/unread-count');
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request<{ id: string; read: boolean }>(
      `/notifications/${notificationId}/read`,
      { method: 'PATCH' }
    );
  }

  async markAllNotificationsAsRead() {
    return this.request<{ markedAsRead: number }>(
      '/notifications/read-all',
      { method: 'POST' }
    );
  }

  async registerFcmToken(token: string, deviceType: 'web' | 'android' | 'ios' = 'web') {
    return this.request<{ success: boolean }>(
      '/notifications/fcm-token',
      {
        method: 'POST',
        body: { token, deviceType },
      }
    );
  }

  async removeFcmToken(token: string) {
    return this.request<{ success: boolean }>(
      '/notifications/fcm-token',
      {
        method: 'DELETE',
        body: { token },
      }
    );
  }

  // ============================================
  // Rubros (Public)
  // ============================================

  async getRubros() {
    return this.request<{ rubros: IRubro[] }>('/rubros', { requireAuth: false });
  }

  async getRubro(id: string) {
    return this.request<IRubro>(`/rubros/${id}`, { requireAuth: false });
  }

  // ============================================
  // Cities (Public) + Geocoding
  // ============================================

  async getCities() {
    return this.request<{ cities: ICity[] }>('/cities', { requireAuth: false });
  }

  async geocodeAddress(q: string, city?: string, limit = 5) {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (city) params.set('city', city);
    return this.request<{ results: IGeocodeResult[] }>(`/geocode?${params.toString()}`);
  }

  async reverseGeocode(lat: number, lng: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    return this.request<{ result: IGeocodeResult | null }>(`/geocode/reverse?${params.toString()}`);
  }

  // ============================================
  // Leads (Public - for waitlist)
  // ============================================

  async createLead(data: ICreateLeadData) {
    return this.request<{ success: boolean; message: string; id: string }>('/leads', {
      method: 'POST',
      body: data,
      requireAuth: false,
    });
  }

  // ============================================
  // Admin - Rubros
  // ============================================

  async getAdminRubros() {
    return this.request<{ rubros: IRubro[] }>('/admin/rubros');
  }

  async createAdminRubro(data: ICreateRubroData) {
    return this.request<IRubro>('/admin/rubros', {
      method: 'POST',
      body: data,
    });
  }

  async updateAdminRubro(rubroId: string, data: IUpdateRubroData) {
    return this.request<IRubro>(`/admin/rubros/${rubroId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteAdminRubro(rubroId: string) {
    return this.request<{ message: string }>(`/admin/rubros/${rubroId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Admin - Cities
  // ============================================

  async getAdminCities() {
    return this.request<{ cities: ICity[] }>('/admin/cities');
  }

  async createAdminCity(data: ICreateCityData) {
    return this.request<ICity>('/admin/cities', {
      method: 'POST',
      body: data,
    });
  }

  async updateAdminCity(cityId: string, data: IUpdateCityData) {
    return this.request<ICity>(`/admin/cities/${cityId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteAdminCity(cityId: string) {
    return this.request<{ message: string }>(`/admin/cities/${cityId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Admin - Leads
  // ============================================

  async getAdminLeads(params?: { contacted?: boolean; rubroId?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.contacted !== undefined) searchParams.set('contacted', params.contacted.toString());
    if (params?.rubroId) searchParams.set('rubroId', params.rubroId);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.request<{ leads: ILead[]; total: number; limit: number; offset: number }>(
      `/admin/leads${query ? `?${query}` : ''}`
    );
  }

  async getAdminLeadsStats() {
    return this.request<ILeadStats>('/admin/leads/stats');
  }

  async updateAdminLead(leadId: string, data: { contacted?: boolean; notes?: string }) {
    return this.request<ILead>(`/admin/leads/${leadId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteAdminLead(leadId: string) {
    return this.request<{ message: string }>(`/admin/leads/${leadId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Settings (Public)
  // ============================================

  async getTerms() {
    return this.request<ITermsAndConditions>('/settings/terms', { requireAuth: false });
  }

  // ============================================
  // Admin - Settings
  // ============================================

  async getAdminTerms() {
    return this.request<ITermsAndConditions>('/admin/settings/terms');
  }

  async updateAdminTerms(content: string, confirmUpdate: boolean) {
    return this.request<ITermsAndConditions & { message: string; requireConfirmation?: boolean }>(
      '/admin/settings/terms',
      {
        method: 'PUT',
        body: { content, confirmUpdate },
      }
    );
  }

  // WhatsApp Template
  async getAdminWhatsAppTemplate() {
    return this.request<{ template: string; updatedAt?: string; updatedBy?: string }>(
      '/admin/settings/whatsapp-template'
    );
  }

  async updateAdminWhatsAppTemplate(template: string) {
    return this.request<{ template: string; updatedAt?: string; updatedBy?: string; message: string }>(
      '/admin/settings/whatsapp-template',
      {
        method: 'PUT',
        body: { template },
      }
    );
  }

  // ============================================
  // Geolocation (IP-based, no permission needed)
  // ============================================

  async trackLogin() {
    // La geolocalización por IP se resuelve en el backend (evita Mixed Content:
    // la app es HTTPS y ip-api gratuito solo soporta HTTP). El server deriva la
    // ubicación de la IP del cliente y la persiste. No es crítico: fallar es ok.
    try {
      await this.request<{ message: string }>('/auth/location', {
        method: 'PATCH',
      });
    } catch {
      // Silently fail - not critical
    }
  }

  // ============================================
  // Admin - Security (PIN)
  // ============================================

  async getAdminPinStatus() {
    return this.request<{ isSet: boolean }>('/admin/security/pin-status');
  }

  async setInitialAdminPin(pin: string) {
    return this.request<{ message: string }>('/admin/security/set-initial-pin', {
      method: 'POST',
      body: { pin },
    });
  }

  async changeAdminPin(currentPin: string, newPin: string) {
    return this.request<{ message: string }>('/admin/security/change-pin', {
      method: 'POST',
      body: { currentPin, newPin },
    });
  }

  async verifyAdminPin(pin: string) {
    return this.request<{ token: string; expiresIn: number }>('/admin/security/verify-pin', {
      method: 'POST',
      body: { pin },
    });
  }

  // ============================================
  // Admin - AI Config
  // ============================================

  async getAdminAiConfig() {
    return this.request<{
      provider: 'claude' | 'openai' | 'gemini' | null;
      apiKeyMasked: string | null;
      configured: boolean;
      updatedAt?: string;
      updatedBy?: string;
      supportedProviders: ('claude' | 'openai' | 'gemini')[];
      models: Record<string, string>;
    }>('/admin/ai-config');
  }

  async updateAdminAiConfig(
    pinToken: string,
    data: { provider?: 'claude' | 'openai' | 'gemini'; apiKey?: string }
  ) {
    return this.request<{ message: string; provider: string; apiKeyMasked: string }>(
      '/admin/ai-config',
      {
        method: 'POST',
        body: data,
        extraHeaders: { 'X-Pin-Token': pinToken },
      }
    );
  }

  async revealAdminAiKey(pinToken: string) {
    return this.request<{ apiKey: string }>('/admin/ai-config/reveal', {
      method: 'POST',
      extraHeaders: { 'X-Pin-Token': pinToken },
    });
  }

  // ============================================
  // Admin - AI Prompts
  // ============================================

  async getAdminAiPrompts() {
    return this.request<{
      parse: string;
      assess: string;
      defaults: { parse: string; assess: string };
      isCustom: { parse: boolean; assess: boolean };
    }>('/admin/ai-prompts');
  }

  async updateAdminAiPrompts(
    pinToken: string,
    data: { parsePrompt?: string | null; assessPrompt?: string | null }
  ) {
    return this.request<{
      message: string;
      parse: string;
      assess: string;
      defaults: { parse: string; assess: string };
      isCustom: { parse: boolean; assess: boolean };
    }>('/admin/ai-prompts', {
      method: 'POST',
      body: data,
      extraHeaders: { 'X-Pin-Token': pinToken },
    });
  }

  // ============================================
  // Admin - Errores de IA
  // ============================================

  async getAdminAiErrors(limit = 100) {
    return this.request<{ errors: IAiError[] }>(`/admin/ai-errors?limit=${limit}`);
  }

  async deleteAdminAiError(id: string) {
    return this.request<{ message: string }>(`/admin/ai-errors/${id}`, { method: 'DELETE' });
  }

  async clearAdminAiErrors() {
    return this.request<{ message: string; deleted: number }>('/admin/ai-errors', { method: 'DELETE' });
  }

  // ============================================
  // Admin - Parse CV
  // ============================================

  async adminParseCv(file: File, useAi: boolean) {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('useAi', String(useAi));
    return this.request<{
      mode: 'heuristic' | 'ai';
      rawText: string;
      fields: {
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        phone: string | null;
        rubro?: string | null;
        puesto?: string | null;
        zona?: string | null;
        description?: string | null;
        experience?: string | null;
        skills?: string[];
      };
    }>('/admin/parse-cv', {
      method: 'POST',
      formData,
    });
  }

  async assessOfferCv(offerId: string, file: File) {
    const formData = new FormData();
    formData.append('cv', file);
    return this.request<IAssessCvResponse>(`/job-offers/${offerId}/assess-cv`, {
      method: 'POST',
      formData,
    });
  }

  async setCandidateSelected(offerId: string, id: string, selected: boolean) {
    return this.request<{ id: string; selected: boolean }>(`/job-offers/${offerId}/pinned-candidates/${id}`, {
      method: 'PATCH',
      body: { selected },
    });
  }

  async getPinnedCandidates(offerId: string) {
    return this.request<{ pinned: IPinnedCandidate[] }>(`/job-offers/${offerId}/pinned-candidates`);
  }

  async deletePinnedCandidate(offerId: string, pinId: string) {
    return this.request<{ message: string; id: string }>(`/job-offers/${offerId}/pinned-candidates/${pinId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Prospects (validación de perfil migrado del talent pool) — público
  // ============================================

  async getProspect(token: string) {
    return this.request<{
      prospect: {
        id: string;
        status: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        puesto: string | null;
        skills: string[];
      };
    }>(`/prospects/${token}`, { requireAuth: false });
  }

  async claimProspect(token: string, data: { password: string }) {
    return this.request<{ success: boolean; uid: string; email: string; alreadyHadAccount: boolean }>(
      `/prospects/${token}/claim`,
      { method: 'POST', body: data, requireAuth: false }
    );
  }

  // ============================================
  // Companies - Talent pool
  // ============================================

  async getCompanyTalentPool() {
    return this.request<{ candidates: ICompanyCandidate[]; total: number }>('/companies/talent-pool');
  }

  // Re-puntúa el talent pool guardado contra una oferta (sin re-subir CVs).
  async getCompanyTalentPoolMatch(offerId: string) {
    return this.request<{ offerId: string; candidates: ICompanyCandidate[]; total: number }>(
      `/companies/talent-pool/match?offerId=${encodeURIComponent(offerId)}`
    );
  }

  // ============================================
  // Companies - Equipo (self-service, solo el dueño)
  // ============================================

  async updateCompanyProfile(data: {
    businessName?: string;
    rubro?: string | null;
    localidad?: string | null;
    city?: string | null;
    address?: string | null;
    phone?: string | null;
    description?: string | null;
    photoUrl?: string | null;
    contactName?: string | null;
  }) {
    return this.request<{ message: string; profile: ICompanyProfile }>('/companies/me', {
      method: 'PATCH',
      body: data,
    });
  }

  async getCompanyMembers() {
    return this.request<{ members: ICompanyMember[]; total: number }>('/companies/members');
  }

  async inviteCompanyMember(data: { email: string; firstName?: string; lastName?: string }) {
    return this.request<{ success: boolean; message: string; member: ICompanyMember }>(
      '/companies/members',
      { method: 'POST', body: data }
    );
  }

  async removeCompanyMember(memberUid: string) {
    return this.request<{ success: boolean; message: string }>(
      `/companies/members/${memberUid}`,
      { method: 'DELETE' }
    );
  }

  // ============================================
  // Admin - Empresa: config + equipo (superuser)
  // ============================================

  // Editar config de la empresa: límite de miembros, renovar plan (planId),
  // override de IA y cupo de CVs. maxMembers null = sin límite.
  async updateAdminCompany(
    companyUid: string,
    data: { maxMembers?: number | null; planId?: string; aiCvEnabled?: boolean; maxCvAnalyses?: number }
  ) {
    return this.request<{ message: string; company: ICompanyProfile }>(
      `/admin/companies/${companyUid}`,
      { method: 'PATCH', body: data }
    );
  }

  // ============================================
  // Admin - Planes de empresa (companyPlans)
  // ============================================

  async getAdminCompanyPlans(params?: { active?: boolean }) {
    const q = params?.active !== undefined ? `?active=${params.active}` : '';
    return this.request<{ plans: ICompanyPlan[] }>(`/admin/company-plans${q}`);
  }

  async createAdminCompanyPlan(data: ICreateCompanyPlanData) {
    return this.request<ICompanyPlan>('/admin/company-plans', { method: 'POST', body: data });
  }

  async updateAdminCompanyPlan(planId: string, data: IUpdateCompanyPlanData) {
    return this.request<ICompanyPlan>(`/admin/company-plans/${planId}`, { method: 'PATCH', body: data });
  }

  async deleteAdminCompanyPlan(planId: string) {
    return this.request<{ message: string }>(`/admin/company-plans/${planId}`, { method: 'DELETE' });
  }

  async getAdminCompanyMembers(companyUid: string) {
    return this.request<{ members: ICompanyMember[]; total: number }>(
      `/admin/companies/${companyUid}/members`
    );
  }

  async inviteAdminCompanyMember(
    companyUid: string,
    data: { email: string; firstName?: string; lastName?: string }
  ) {
    return this.request<{ success: boolean; message: string; member: ICompanyMember }>(
      `/admin/companies/${companyUid}/members`,
      { method: 'POST', body: data }
    );
  }

  async removeAdminCompanyMember(companyUid: string, memberUid: string) {
    return this.request<{ success: boolean; message: string }>(
      `/admin/companies/${companyUid}/members/${memberUid}`,
      { method: 'DELETE' }
    );
  }
}

export const api = new ApiService();
