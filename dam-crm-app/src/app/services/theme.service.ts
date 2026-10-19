import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  public isDark = signal<boolean>(false);

  constructor() {
    this.initTheme();
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    let shouldBeDark = false;
    if (savedTheme) {
      shouldBeDark = savedTheme === 'dark';
    } else if (typeof window !== 'undefined' && window.matchMedia) {
      shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    this.isDark.set(shouldBeDark);
    this.applyTheme(shouldBeDark);
  }

  toggleTheme(): boolean {
    const nextState = !this.isDark();
    this.isDark.set(nextState);
    localStorage.setItem('theme', nextState ? 'dark' : 'light');
    this.applyTheme(nextState);
    return nextState;
  }

  private applyTheme(isDark: boolean): void {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('ion-palette-dark', isDark);
      document.body.classList.toggle('ion-palette-dark', isDark);
    }
  }
}
