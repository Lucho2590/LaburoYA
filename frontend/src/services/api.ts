import { auth } from '@/config/firebase';
import {
  UserRole,
  CreateWorkerProfileData,
  CreateEmployerProfileData,
  CreateJobOfferData,
  JobOffer,
  AdminStats,
  AdminUser,
  AdminUserDetail,
  AdminJobOffer,
  AdminMatch
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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
  async registerUser(role: UserRole) {
    return this.request('/auth/register', {
      method: 'POST',
      body: { role },
    });
  }

  async getCurrentUser() {
    return this.request<{ user: { role: string; secondaryRole?: string }; profile: unknown }>('/auth/me');
  }

  async setSecondaryRole(secondaryRole: 'worker' | 'employer') {
    return this.request<{ message: string; secondaryRole: string }>('/auth/secondary-role', {
      method: 'PATCH',
      body: { secondaryRole },
    });
  }

  // Workers
  async createWorkerProfile(data: CreateWorkerProfileData) {
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
  async createEmployerProfile(data: CreateEmployerProfileData) {
    return this.request('/employers', {
      method: 'POST',
      body: data,
    });
  }

  async getEmployerProfile() {
    return this.request('/employers/me');
  }

  // Job Offers
  async createJobOffer(data: CreateJobOfferData) {
    return this.request('/job-offers', {
      method: 'POST',
      body: data,
    });
  }

  async getMyJobOffers() {
    return this.request('/job-offers/my-offers');
  }

  async updateJobOffer(id: string, data: Partial<JobOffer>) {
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
    return this.request<AdminStats>('/admin/stats');
  }

  async getAdminUsers(params?: { role?: UserRole; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.role) searchParams.set('role', params.role);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.request<{ users: AdminUser[]; total: number; limit: number; offset: number }>(
      `/admin/users${query ? `?${query}` : ''}`
    );
  }

  async getAdminUser(uid: string) {
    return this.request<AdminUserDetail>(`/admin/users/${uid}`);
  }

  async updateAdminUser(uid: string, data: { role?: UserRole; disabled?: boolean }) {
    return this.request<{ message: string; user: AdminUser }>(`/admin/users/${uid}`, {
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
    return this.request<{ jobOffers: AdminJobOffer[]; total: number; limit: number; offset: number }>(
      `/admin/job-offers${query ? `?${query}` : ''}`
    );
  }

  async getAdminMatches(params?: { status?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.request<{ matches: AdminMatch[]; total: number; limit: number; offset: number }>(
      `/admin/matches${query ? `?${query}` : ''}`
    );
  }
}

export const api = new ApiService();
