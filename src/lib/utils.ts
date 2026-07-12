import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return toUpper(new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
  }).format(amount));
}

export function formatDate(date: string | Date): string {
  return toUpper(new Intl.DateTimeFormat('fr-DZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date)));
}

export function formatDateTime(date: string | Date): string {
  return toUpper(new Intl.DateTimeFormat('fr-DZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date)));
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.charAt(0)?.toUpperCase() || ''}${lastName?.charAt(0)?.toUpperCase() || ''}`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-success/10 text-success',
    expired: 'bg-destructive/10 text-destructive',
    cancelled: 'bg-muted text-muted-foreground',
    pending: 'bg-warning/10 text-warning',
    pending_payment: 'bg-warning/10 text-warning',
    completed: 'bg-success/10 text-success',
    open: 'bg-primary/10 text-primary',
    closed: 'bg-muted text-muted-foreground',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
}

export function getDaysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function toUpper(str: string | null | undefined): string {
  if (!str) return str ?? "";
  return str.toUpperCase();
}

const DZ_PHONE_REGEX = /^(05|06|07)\d{8}$/;

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('213') && digits.length === 12) return '0' + digits.slice(3)
  if (digits.startsWith('00213') && digits.length === 14) return '0' + digits.slice(5)
  if (digits.startsWith('0') && digits.length === 10) return digits
  return phone
}

export function isValidDzPhone(phone: string): boolean {
  return DZ_PHONE_REGEX.test(formatPhone(phone))
}

export function displayPhone(phone: string | null | undefined): string {
  const f = formatPhone(phone)
  if (!f) return '-'
  return `${f.slice(0, 2)} ${f.slice(2, 4)} ${f.slice(4, 6)} ${f.slice(6, 8)} ${f.slice(8)}`
}
