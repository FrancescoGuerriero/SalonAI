import {
  LoaderCircle,
} from "lucide-react";

export default function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <LoaderCircle
          size={32}
          className="mx-auto animate-spin text-indigo-600"
        />

        <p className="mt-3 text-sm font-semibold text-slate-600">
          Loading SalonAI…
        </p>
      </div>
    </div>
  );
}
