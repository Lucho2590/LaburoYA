import { auth } from '@/config/firebase';
import {
  EUserRole,
  ICreateWorkerProfileData,
  ICreateEmployerProfileData,
  ICreateJobOfferData,
  IJobOffer,
  IAdminStats,
  IAdminUser,
  IAdminUserDetail,
  IAdminJobOffer,
  IAdminMatch,
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
  ILead,
  ICreateLeadData,
  ILeadStats,
  ITermsAndConditions
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  requireAuth?: boolean;
}

class ApiService {
  private async getAuthToken(): Promise<string | null> {
    if (!auth) return null;
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }

  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, requireAuth = true } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth) {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }

  // Auth
  async registerUser(role: EUserRole) {
    return this.request('/auth/register', {
      method: 'POST',
      body: { role },
    });
  }

  async checkEmailExists(email: string) {
    return this.request<{ exists: boolean }>('/auth/check-email', {
      method: 'POST',
      body: { email },
      requireAuth: false,
    });
  }

  async updateBasicInfo(data: { firstName: string; lastName: string; phone?: string; age?: number; nickname?: string }) {
    return this.request<{ message: string; firstName: string; lastName: string; phone?: string; age?: number; nickname?: string }>(
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
        firstName?: string;
        lastName?: string;
        age?: number;
        nickname?: string;
        onboardingCompleted?: boolean;
      };
      profile: unknown;
    }>('/auth/me');
  }

  async setSecondaryRole(secondaryRole: 'worker' | 'employer') {
    return this.request<{ message: string; secondaryRole: string }>('/auth/secondary-role', {
      method: 'PATCH',
      body: { secondaryRole },
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

  async createAdminUser(data: { email: string; firstName?: string; lastName?: string; role: 'worker' | 'employer'; plan?: string }) {
    return this.request<{ success: boolean; message: string; user: { uid: string; email: string; role: string } }>(
      '/admin/users',
      {
        method: 'POST',
        body: data,
      }
    );
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

  async updateAdminUser(uid: string, data: { role?: EUserRole; disabled?: boolean }) {
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

  async getIpLocation(): Promise<{ city: string; region: string; country: string; ip: string } | null> {
    try {
      // Using ip-api.com (free, no API key required)
      const response = await fetch('http://ip-api.com/json/?fields=city,regionName,country,query');
      if (!response.ok) return null;

      const data = await response.json();
      return {
        city: data.city || '',
        region: data.regionName || '',
        country: data.country || '',
        ip: data.query || '',
      };
    } catch {
      // Silently fail - location is not critical
      return null;
    }
  }

  async updateUserLocation(location: { city: string; region: string; country: string }) {
    return this.request<{ message: string }>('/auth/location', {
      method: 'PATCH',
      body: location,
    });
  }

  async trackLogin() {
    // Get IP location and send to backend
    const location = await this.getIpLocation();
    if (location) {
      try {
        await this.updateUserLocation({
          city: location.city,
          region: location.region,
          country: location.country,
        });
      } catch {
        // Silently fail - not critical
      }
    }
  }
}

export const api = new ApiService();
