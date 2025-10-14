import Skeleton from "@/components/ui/Skeleton";

export default function SignInLoading() {
  return (
    <main className="p-4 max-w-md mx-auto">
      <section className="rounded-app border border-sub overflow-hidden shadow-app p-6">
        <Skeleton className="h-7 w-32 mb-6" />
        <Skeleton className="h-10 w-full rounded-lg mb-4" />
        <Skeleton className="h-10 w-full rounded-lg mb-6" />
        <Skeleton className="h-10 w-full rounded-full" />
      </section>
    </main>
  );
}
