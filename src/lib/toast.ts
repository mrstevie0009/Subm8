export type ToastArgs = {
  message: string;
  title?: string;
  kind?: 'success' | 'error' | 'info';
  duration?: number;
  icon?: 'check' | 'trash' | 'post' | 'info';
};

export function toast(args: ToastArgs) {
  try {
    window.dispatchEvent(new CustomEvent('ui:toast', { detail: args }));
  } catch {}
}

toast.success = (message: string, title = 'Erfolg') =>
  toast({ kind: 'success', title, message, icon: 'check' });

toast.error = (message: string, title = 'Fehler') =>
  toast({ kind: 'error', title, message, icon: 'info' });
