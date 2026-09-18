import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";

import StylistCard from "../components/StylistCard.jsx";
import StylistForm from "../components/StylistForm.jsx";
import stylistService from "../Services/stylistService.js";

function requestErrorMessage(
  error,
  fallback
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export default function AdminStylists() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();
  const [
    stylists,
    setStylists,
  ] = useState([]);
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    refreshing,
    setRefreshing,
  ] = useState(false);
  const [
    search,
    setSearch,
  ] = useState("");
  const [
    visibilityFilter,
    setVisibilityFilter,
  ] = useState("all");
  const [
    error,
    setError,
  ] = useState("");
  const [
    success,
    setSuccess,
  ] = useState("");
  const [
    showForm,
    setShowForm,
  ] = useState(false);
  const [
    selectedStylist,
    setSelectedStylist,
  ] = useState(null);

  const loadStylists =
    useCallback(
      async ({
        quiet = false,
      } = {}) => {
        try {
          if (quiet) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError("");

          const response =
            await stylistService.getStylists();

          setStylists(
            Array.isArray(
              response
            )
              ? response
              : response?.stylists ||
                  []
          );
        } catch (
          requestError
        ) {
          setError(
            requestErrorMessage(
              requestError,
              "Unable to load employee profiles."
            )
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadStylists();
  }, [loadStylists]);

  useEffect(() => {
    const editProfileId =
      searchParams.get(
        "edit"
      );

    if (
      !editProfileId ||
      !stylists.length
    ) {
      return;
    }

    const target =
      stylists.find(
        (stylist) =>
          String(
            stylist._id
          ) ===
          String(
            editProfileId
          )
      );

    if (target) {
      setSelectedStylist(
        target
      );
      setShowForm(true);
    } else {
      setError(
        "The requested employee profile could not be found."
      );
    }

    const nextParams =
      new URLSearchParams(
        searchParams
      );

    nextParams.delete(
      "edit"
    );

    setSearchParams(
      nextParams,
      {
        replace: true,
      }
    );
  }, [
    searchParams,
    setSearchParams,
    stylists,
  ]);

  const filteredStylists =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return stylists.filter(
        (stylist) => {
          const searchable =
            [
              stylist.firstName,
              stylist.lastName,
              stylist.email,
              stylist.jobTitle,
              ...(stylist.specialties ||
                []),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          if (
            query &&
            !searchable.includes(
              query
            )
          ) {
            return false;
          }

          if (
            visibilityFilter ===
            "published"
          ) {
            return (
              stylist.profilePublished ===
              true
            );
          }

          if (
            visibilityFilter ===
            "hidden"
          ) {
            return (
              stylist.profilePublished !==
              true
            );
          }

          if (
            visibilityFilter ===
            "bookable"
          ) {
            return (
              stylist.acceptsAppointments ===
              true
            );
          }

          if (
            visibilityFilter ===
            "inactive"
          ) {
            return (
              stylist.isActive ===
              false
            );
          }

          return true;
        }
      );
    }, [
      search,
      stylists,
      visibilityFilter,
    ]);

  function openCreateForm() {
    setError("");
    setSuccess("");
    setSelectedStylist(
      null
    );
    setShowForm(true);
  }

  function handleEditStylist(
    stylist
  ) {
    setError("");
    setSuccess("");
    setSelectedStylist(
      stylist
    );
    setShowForm(true);
  }

  function closeModal() {
    setShowForm(false);
    setSelectedStylist(
      null
    );
  }

  async function handleSaveStylist(
    data
  ) {
    if (
      selectedStylist
    ) {
      await stylistService.updateStylist(
        selectedStylist._id,
        data
      );

      setSuccess(
        "Employee profile updated."
      );
    } else {
      await stylistService.createStylist(
        data
      );

      setSuccess(
        "Employee profile created."
      );
    }

    closeModal();

    await loadStylists({
      quiet: true,
    });
  }

  async function handleDeleteStylist(
    stylist
  ) {
    const name =
      [
        stylist.firstName,
        stylist.lastName,
      ]
        .filter(Boolean)
        .join(" ") ||
      "this employee profile";

    if (
      !window.confirm(
        `Delete ${name}? This permanently removes the stylist profile and should only be used for a genuine duplicate or obsolete profile.`
      )
    ) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await stylistService.deleteStylist(
        stylist._id
      );

      setSuccess(
        `${name} was removed.`
      );

      await loadStylists({
        quiet: true,
      });
    } catch (
      requestError
    ) {
      setError(
        requestErrorMessage(
          requestError,
          "Unable to delete the employee profile."
        )
      );
    }
  }

  async function handleToggleStatus(
    stylist
  ) {
    try {
      setError("");
      setSuccess("");

      await stylistService.toggleStatus(
        stylist._id
      );

      setSuccess(
        stylist.isActive !==
          false
          ? "Employee profile deactivated."
          : "Employee profile activated."
      );

      await loadStylists({
        quiet: true,
      });
    } catch (
      requestError
    ) {
      setError(
        requestErrorMessage(
          requestError,
          "Unable to update the employee profile."
        )
      );
    }
  }

  return (
    <main
      className="space-y-6 p-4 sm:p-6 lg:p-8"
      id="main-content"
      tabIndex="-1"
    >
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-700">
              <UsersRound
                size={20}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                Administration
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-bold text-black sm:text-3xl">
              Employee profiles
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage the professional information shown for salon employees, including photographs, biography, specialties, public visibility and online-booking presentation.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/employees"
              className="inline-flex items-center gap-2 rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50"
            >
              <ArrowLeft
                size={17}
              />
              Employees
            </Link>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadStylists({
                  quiet: true,
                })
              }
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black shadow-sm hover:bg-amber-300"
              onClick={
                openCreateForm
              }
            >
              <Plus
                size={17}
              />
              Add profile
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
          role="status"
        >
          {success}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <label className="relative block">
            <span className="sr-only">
              Search employee profiles
            </span>
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-3 text-slate-500"
            />
            <input
              type="search"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-black outline-none focus:border-black focus:ring-2 focus:ring-amber-300"
              placeholder="Search name, email, job title or specialty..."
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
            />
          </label>

          <label>
            <span className="sr-only">
              Filter employee profiles
            </span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-black outline-none focus:border-black focus:ring-2 focus:ring-amber-300"
              value={
                visibilityFilter
              }
              onChange={(
                event
              ) =>
                setVisibilityFilter(
                  event.target
                    .value
                )
              }
            >
              <option value="all">
                All profiles
              </option>
              <option value="published">
                Published
              </option>
              <option value="hidden">
                Hidden
              </option>
              <option value="bookable">
                Bookable
              </option>
              <option value="inactive">
                Inactive
              </option>
            </select>
          </label>
        </div>

        <p className="mt-3 text-xs font-semibold text-slate-500">
          {filteredStylists.length} of {stylists.length} profiles shown
        </p>
      </section>

      {loading ? (
        <section
          className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"
          aria-live="polite"
        >
          <RefreshCw
            size={24}
            className="mx-auto animate-spin text-amber-600"
          />
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Loading employee profiles...
          </p>
        </section>
      ) : filteredStylists.length ===
        0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <UsersRound
            size={32}
            className="mx-auto text-slate-400"
          />
          <h2 className="mt-3 font-bold text-black">
            No matching profiles
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Change the search or filter to see other employee profiles.
          </p>
        </section>
      ) : (
        <section
          className="grid gap-4 xl:grid-cols-2"
          aria-label="Employee profiles"
        >
          {filteredStylists.map(
            (stylist) => (
              <StylistCard
                key={
                  stylist._id
                }
                stylist={
                  stylist
                }
                onEdit={
                  handleEditStylist
                }
                onDelete={
                  handleDeleteStylist
                }
                onToggleStatus={
                  handleToggleStatus
                }
              />
            )
          )}
        </section>
      )}

      <StylistForm
        show={
          showForm
        }
        stylist={
          selectedStylist
        }
        onClose={
          closeModal
        }
        onSave={
          handleSaveStylist
        }
      />
    </main>
  );
}
