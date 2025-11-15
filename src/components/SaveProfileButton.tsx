'use client';

import { toast } from '@/lib/toast';

type Props = {
  label: string;
  toastMessage: string;
};

export default function SaveProfileButton({ label, toastMessage }: Props) {
  function handleClick() {
    // 👉 i18n-Text als Toast verwenden
    toast.success(toastMessage);
  }

  return (
    <button
      type="submit"
      onClick={handleClick}
      className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15"
    >
      {label}
    </button>
  );
}
