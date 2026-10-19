import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService, StorageFileItem } from '../services/supabase.service';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonBadge,
  IonSpinner,
  IonToast,
  IonItem,
  IonLabel,
  IonInput,
  IonChip,
  AlertController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { ThemeService } from '../services/theme.service';
import {
  imagesOutline,
  cloudUploadOutline,
  refreshOutline,
  openOutline,
  trashOutline,
  copyOutline,
  alertCircleOutline,
  arrowBackOutline,
  folderOutline,
  logInOutline,
  logOutOutline,
  searchOutline,
  moonOutline,
  sunnyOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-storage',
  templateUrl: './storage.page.html',
  styleUrls: ['./storage.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonButtons,
    IonBackButton,
    IonSpinner,
    IonToast,
    IonChip,
    IonItem,
    IonInput
  ],
})
export class StoragePage implements OnInit {
  public supabaseService = inject(SupabaseService);
  public themeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);
  private alertCtrl = inject(AlertController);

  // Bucket por defecto configurado a 'galeria' donde está la foto guardada
  currentBucket = 'galeria';
  availableBuckets: string[] = ['galeria', 'images', 'storage', 'fotos', 'public', 'dam', 'clientes', 'bucket'];

  images: StorageFileItem[] = [];
  isLoading = false;
  isUploading = false;
  toastMessage = '';
  isToastOpen = false;

  currentUser = this.supabaseService.currentUser;

  constructor() {
    addIcons({
      imagesOutline,
      cloudUploadOutline,
      refreshOutline,
      openOutline,
      trashOutline,
      copyOutline,
      alertCircleOutline,
      arrowBackOutline,
      folderOutline,
      logInOutline,
      logOutOutline,
      searchOutline,
      moonOutline,
      sunnyOutline
    });
  }

  async ngOnInit() {
    await this.loadImages();
  }

  async selectBucket(bucketName: string) {
    this.currentBucket = bucketName;
    await this.loadImages();
  }

  async loadImages() {
    this.isLoading = true;
    this.cdr.detectChanges();
    try {
      this.images = await this.supabaseService.listFiles(this.currentBucket);
    } catch (e: any) {
      console.warn('Error al cargar imágenes del bucket:', e);
      this.images = [];
      this.showToast(`Aviso: No se pudieron leer imágenes de '${this.currentBucket}' (${e.message || e}). Verifica que el bucket existe y tiene política de lectura.`);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar si es imagen
    if (!file.type.startsWith('image/')) {
      this.showToast('Por favor selecciona un archivo de imagen válido');
      return;
    }

    // Si se requiere login para subir según RLS
    if (!this.currentUser()) {
      const isLogged = await this.promptLogin('Debes iniciar sesión para subir imágenes al bucket');
      if (!isLogged) {
        event.target.value = '';
        return;
      }
    }

    this.isUploading = true;
    this.cdr.detectChanges();

    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    try {
      await this.supabaseService.uploadFile(this.currentBucket, fileName, file);
      this.showToast('¡Imagen subida exitosamente!');
      await this.loadImages();
    } catch (e: any) {
      console.error('Error al subir:', e);
      if (e?.statusCode === '403' || e?.message?.includes('security') || e?.message?.includes('policy')) {
        this.showToast('[RLS Storage] Error de permisos: Verifica que la política de INSERT en storage.objects esté habilitada.');
      } else {
        this.showToast('Error al subir imagen: ' + (e.message || e));
      }
    } finally {
      this.isUploading = false;
      event.target.value = '';
      this.cdr.detectChanges();
    }
  }

  async deleteImage(file: StorageFileItem) {
    if (!this.currentUser()) {
      const isLogged = await this.promptLogin('Debes iniciar sesión para eliminar imágenes');
      if (!isLogged) return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Confirmar eliminación',
      message: `¿Deseas eliminar la imagen "${file.name}" de Supabase Storage?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.supabaseService.deleteFile(this.currentBucket, file.name);
              this.showToast('Imagen eliminada');
              await this.loadImages();
            } catch (e: any) {
              this.showToast('Error al eliminar: ' + (e.message || e));
            }
          }
        }
      ]
    });

    await alert.present();
  }

  copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Enlace público copiado al portapapeles');
    }).catch(() => {
      this.showToast('URL: ' + url);
    });
  }

  formatSize(bytes?: number): string {
    if (!bytes) return 'Tamaño desconocido';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  async promptLogin(reasonMessage: string): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: 'Iniciar Sesión',
      subHeader: reasonMessage,
      inputs: [
        { name: 'email', type: 'email', placeholder: 'correo@ejemplo.com' },
        { name: 'password', type: 'password', placeholder: 'Contraseña' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
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
      return false;
    }

    const { email, password } = result.data.values;
    try {
      await this.supabaseService.login(email, password);
      this.showToast(`Bienvenido ${email}`);
      this.cdr.detectChanges();
      return true;
    } catch (err: any) {
      this.showToast('Error de login: ' + (err.message || err));
      return false;
    }
  }

  showToast(msg: string) {
    this.toastMessage = msg;
    this.isToastOpen = true;
  }
}
