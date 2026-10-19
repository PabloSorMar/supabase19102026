import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Client } from '../models/client.model';

export interface StorageFileItem {
  name: string;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  last_accessed_at?: string | null;
  metadata?: any;
  publicUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  // Señales reactivas para el estado global
  public currentUser = signal<User | null>(null);
  public userRole = signal<'admin' | 'user' | null>(null);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
    this.initSession();

    // Escuchar cambios de estado en la autenticación en tiempo real
    this.supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        this.currentUser.set(session.user);
        await this.loadRole(session.user.id);
      } else {
        this.currentUser.set(null);
        this.userRole.set(null);
      }
    });
  }

  // --- AUTENTICACIÓN Y ROLES ---
  private async initSession() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session?.user) {
      this.currentUser.set(session.user);
      await this.loadRole(session.user.id);
    }
  }

  async login(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      this.currentUser.set(data.user);
      await this.loadRole(data.user.id);
    }
    return data;
  }

  async register(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      this.currentUser.set(data.user);
      await this.loadRole(data.user.id);
    }
    return data;
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    this.currentUser.set(null);
    this.userRole.set(null);
  }

  public async loadRole(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (!error && data) {
      this.userRole.set(data.role);
    }
  }

  // --- CRUD CLIENTES ---
  async getClients(): Promise<Client[]> {
    const { data, error } = await this.supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createClient(client: Client): Promise<void> {
    const { error } = await this.supabase.from('clients').insert([{
      nombre: client.nombre,
      empresa: client.empresa,
      email: client.email
    }]);
    if (error) throw error;
  }

  async updateClient(id: string, client: Partial<Client>): Promise<void> {
    const { error } = await this.supabase.from('clients').update(client).eq('id', id);
    if (error) throw error;
  }

  async deleteClient(id: string): Promise<void> {
    const { error } = await this.supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  }

  // --- STORAGE BUCKET ---
  async listBuckets() {
    const { data, error } = await this.supabase.storage.listBuckets();
    if (error) throw error;
    return data || [];
  }

  async listFiles(bucketName: string): Promise<StorageFileItem[]> {
    const cleanBucket = (bucketName || 'images').trim();
    const { data, error } = await this.supabase.storage.from(cleanBucket).list('', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });
    if (error) throw error;

    const files = (data || []).filter(item => item.name && item.name !== '.emptyFolderPlaceholder');
    const items: StorageFileItem[] = [];

    for (const file of files) {
      let publicUrl = '';
      try {
        const { data: urlData } = this.supabase.storage.from(cleanBucket).getPublicUrl(file.name);
        publicUrl = urlData?.publicUrl || '';
      } catch (uErr) {
        console.warn('Error getPublicUrl:', uErr);
      }

      // Si el bucket es privado o falla la URL publica, intentar generar signed URL
      try {
        const { data: signedData } = await this.supabase.storage.from(cleanBucket).createSignedUrl(file.name, 3600);
        if (signedData?.signedUrl) {
          publicUrl = signedData.signedUrl;
        }
      } catch (sErr) {
        // mantener publicUrl
      }

      items.push({
        ...file,
        publicUrl
      });
    }

    return items;
  }

  getPublicUrl(bucketName: string, path: string): string {
    const { data } = this.supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }

  async uploadFile(bucketName: string, path: string, file: File) {
    const { data, error } = await this.supabase.storage.from(bucketName).upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });
    if (error) throw error;
    return data;
  }

  async deleteFile(bucketName: string, path: string) {
    const { data, error } = await this.supabase.storage.from(bucketName).remove([path]);
    if (error) throw error;
    return data;
  }
}
