'use client';


import * as React from 'react';


type Props = {
maxUploadMB: number;
action: (formData: FormData) => Promise<void>;
returnTo: string;
};


export default function ComposeForm({ maxUploadMB, action, returnTo }: Props) {
const [text, setText] = React.useState('');
const [fileName, setFileName] = React.useState<string>('');
const [alt, setAlt] = React.useState('');
const [pending, startTransition] = React.useTransition();


return (
<form
action={(fd: FormData) => {
// Zusätzliche Felder setzen
fd.set('returnTo', returnTo);
startTransition(async () => {
await action(fd);
});
}}
className="bg-card border border-sub rounded-app shadow-app p-4 md:p-5 grid gap-4"
>
{/* Text */}
<div>
<label className="block mb-2 text-sm text-white/80">Text</label>
<textarea
name="text"
value={text}
onChange={(e) => setText(e.target.value)}
rows={5}
className="w-full rounded-xl bg-transparent border border-white/15 px-3 py-2 outline-none focus:ring-[3px] focus:ring-[var(--purple)]/40"
placeholder="Was möchtest du posten?"
/>
</div>


{/* Media Upload */}
<div className="grid gap-2">
<label className="block text-sm text-white/80">Bild (optional)</label>
<input
type="file"
name="media"
accept="image/jpeg,image/png,image/webp,image/gif"
onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? '')}
className="block w-full text-sm file:mr-4 file:rounded-lg file:border file:border-white/15 file:bg-transparent file:px-3 file:py-2 file:text-white/90 hover:file:bg-white/5"
/>
<div className="text-xs text-white/60">Max. {maxUploadMB} MB</div>
<input
type="text"
name="mediaAlt"
value={alt}
onChange={(e) => setAlt(e.target.value)}
placeholder="Alt‑Text / Beschreibung (für Barrierefreiheit)"
className="w-full rounded-xl bg-transparent border border-white/15 px-3 py-2 outline-none focus:ring-[3px] focus:ring-[var(--purple)]/40"
/>
{fileName && <div className="text-xs text-white/60">Ausgewählt: {fileName}</div>}
</div>


{/* Submit */}
<div className="flex justify-end gap-3">
<button
type="submit"
disabled={pending || (!text && !fileName)}
className="px-4 py-2 rounded-xl bg-[var(--purple)] text-white font-medium disabled:opacity-60"
>
{pending ? 'Poste…' : 'Posten'}
</button>
</div>
</form>
);
}