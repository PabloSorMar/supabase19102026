import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';
import { Client } from '../models/client.model';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonIcon,
  IonButton,
  IonInput,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonToast,
  IonButtons,
  IonBadge,
  AlertController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  createOutline,
  trashOutline,
  refreshOutline,
  logInOutline,
  logOutOutline,
  personCircleOutline,
  imagesOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonIcon,
    IonButton,
    IonInput,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonToast,
    IonButtons,
    IonBadge
  ],
})
export class HomePage implements OnInit {
  public supabaseService = inject(SupabaseService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private alertCtrl = inject(AlertController);

  clients: Client[] = [];
  clientForm: FormGroup;
  editingClientId: string | null = null;
  toastMessage = '';
  isToastOpen = false;

  // Señales reactivas
  currentUser = this.supabaseService.currentUser;
  userRole = this.supabaseService.userRole;

  constructor() {
    addIcons({
      createOutline,
      trashOutline,
      refreshOutline,
      logInOutline,
      logOutOutline,
      personCircleOutline,
      imagesOutline
    });

    this.clientForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      empresa: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async ngOnInit() {
    await this.loadClients();
  }

  async loadClients() {
    try {
      this.clients = await this.supabaseService.getClients();
      this.cdr.detectChanges();
    } catch (e: any) {
      this.showToast('Error cargando clientes: ' + (e.message || e));
    }
  }

  // --- REQUISITO 1: SOLICITAR LOGIN AL INSERTAR O ACTUALIZAR ---
  async saveClient() {
    if (this.clientForm.invalid) return;

    // Si no está autenticado, solicitar login en Supabase
    if (!this.currentUser()) {
      const isLogged = await this.promptLogin(
        this.editingClientId
          ? 'Debes identificarte para actualizar este cliente'
          : 'Debes identificarte para insertar un nuevo cliente'
      );
      if (!isLogged) return;
    }

    try {
      const formValue = this.clientForm.value;
      if (this.editingClientId) {
        await this.supabaseService.updateClient(this.editingClientId, formValue);
        this.showToast('Cliente actualizado con éxito');
      } else {
        await this.supabaseService.createClient(formValue);
        this.showToast('Cliente guardado con éxito');
      }
      this.resetForm();
      await this.loadClients();
      this.cdr.detectChanges();
    } catch (e: any) {
      this.handleSupabaseError(e, this.editingClientId ? 'actualizar' : 'insertar');
    }
  }

  // --- REQUISITO 1: SOLICITAR LOGIN AL EDITAR ---
  async editClient(client: Client) {
    if (!this.currentUser()) {
      const isLogged = await this.promptLogin('Debes identificarte para editar este cliente');
      if (!isLogged) return;
    }

    this.editingClientId = client.id!;
    this.clientForm.patchValue({
      nombre: client.nombre,
      empresa: client.empresa,
      email: client.email
    });
    this.cdr.detectChanges();
    this.showToast('Editando cliente: ' + client.nombre);
  }

  // --- REQUISITO 1: SOLICITAR LOGIN AL ELIMINAR ---
  async deleteClient(id: string) {
    if (!this.currentUser()) {
      const isLogged = await this.promptLogin('Debes identificarte para eliminar este cliente');
      if (!isLogged) return;
    }

    try {
      await this.supabaseService.deleteClient(id);
      this.showToast('Cliente eliminado correctamente');
      await this.loadClients();
      this.cdr.detectChanges();
    } catch (e: any) {
      this.handleSupabaseError(e, 'eliminar');
    }
  }

  // --- DIÁLOGO DE LOGIN CON ALERT CONTROLLER ---
  async promptLogin(reasonMessage: string): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: 'Iniciar Sesión',
      subHeader: reasonMessage,
      message: 'Ingresa las credenciales de tu usuario en Supabase:',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'admin@test.com'
        },
        {
          name: 'password',
          type: 'password',
          placeholder: 'Contraseña'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Acceder',
          handler: (data) => {
            if (!data.email || !data.password) {
              this.showToast('Introduce email y contraseña');
              return false;
            }
            return true;
          }
        }
      ]
    });

    await alert.present();
    const result = await alert.onDidDismiss();

    if (result.role === 'cancel' || !result.data?.values) {
      this.showToast('Operación cancelada. Se requiere login para realizar cambios.');
      return false;
    }

    const { email, password } = result.data.values;
    try {
      await this.supabaseService.login(email, password);
      this.showToast(`Bienvenido: ${email} (${this.userRole() || 'user'})`);
      this.cdr.detectChanges();
      return true;
    } catch (err: any) {
      this.showToast('Error de login: ' + (err.message || err));
      return false;
    }
  }

  async doLogout() {
    try {
      await this.supabaseService.logout();
      this.showToast('Sesión cerrada');
      this.cdr.detectChanges();
    } catch (e: any) {
      this.showToast('Error al cerrar sesión: ' + (e.message || e));
    }
  }

  handleSupabaseError(e: any, actionName: string) {
    console.error('Error Supabase:', e);
    const msg = e?.message || JSON.stringify(e);
    if (e?.code === '42501' || msg.includes('row-level security') || msg.includes('policy')) {
      this.showToast(`[RLS Supabase] Error al ${actionName}: Tu usuario no tiene el rol 'admin' en la tabla 'profiles'.`);
    } else {
      this.showToast(`Error al ${actionName}: ` + msg);
    }
  }

  resetForm() {
    this.clientForm.reset();
    this.editingClientId = null;
    this.cdr.detectChanges();
  }

  setToastOpen(isOpen: boolean) {
    this.isToastOpen = isOpen;
  }

  showToast(msg: string) {
    this.toastMessage = msg;
    this.isToastOpen = true;
  }
}
