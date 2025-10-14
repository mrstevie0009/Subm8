// src/app/[locale]/compose/page.tsx
import { maxUploadMB } from '@/lib/config';
import { createPost } from '@/app/actions/posts';
import ComposeForm from '@/components/compose/ComposeForm';

export default async function ComposePage() {
  const limit = maxUploadMB(); // liest .env serverseitig

  return (
    <div className="mx-auto w-full max-w-[680px] md:max-w-[760px] px-4 py-4">
      <ComposeForm
        maxUploadMB={limit}
        action={createPost}
        returnTo="/"
      />
    </div>
  );
}
