import clsx from "clsx";

export default function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-gray-200 bg-white shadow-sm",
        className
      )}
    >
      {title || subtitle || actions ? (
        <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? (
              <h2 className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            ) : null}

            {subtitle ? (
              <p className="mt-1 text-sm text-gray-500">
                {subtitle}
              </p>
            ) : null}
          </div>

          {actions ? (
            <div className="shrink-0">{actions}</div>
          ) : null}
        </div>
      ) : null}

      <div className={clsx("p-6", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
