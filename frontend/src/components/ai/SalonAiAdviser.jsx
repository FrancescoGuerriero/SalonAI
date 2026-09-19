import {
  Bot,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  askSalonAiAdviser,
  submitSalonAiAdviserFeedback,
} from "../../Services/aiAdviserService.js";
import useModalFocusTrap from "../../hooks/useModalFocusTrap.js";

function errorMessage(
  error
) {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    "SalonAI Adviser could not answer this question."
  );
}

function modelEvidenceItems(
  result
) {
  return (
    result?.evidence
      ?.domainContext
      ?.sections ||
    []
  ).flatMap(
    (section) =>
      Object.values(
        section
          .modelEvidence ||
          {}
      )
  )
    .filter(Boolean);
}

function modelMetric(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number.toFixed(3)
    : "n/a";
}

export default function SalonAiAdviser({
  contextPath = "",
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const triggerRef =
    useRef(null);
  const panelRef =
    useRef(null);
  const [
    question,
    setQuestion,
  ] = useState("");
  const [
    result,
    setResult,
  ] = useState(null);
  const [
    loading,
    setLoading,
  ] = useState(false);
  const [
    error,
    setError,
  ] = useState("");
  const [
    feedbackRating,
    setFeedbackRating,
  ] = useState(null);
  const [
    feedbackLoading,
    setFeedbackLoading,
  ] = useState(false);
  const [
    feedbackError,
    setFeedbackError,
  ] = useState("");

  const modelEvidence =
    modelEvidenceItems(
      result
    );

  useModalFocusTrap({
    open,
    containerRef:
      panelRef,
    returnFocusRef:
      triggerRef,
    setOpen,
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const prior =
      document.body.style
        .overflow;
    document.body.style
      .overflow = "hidden";

    return () => {
      document.body.style
        .overflow = prior;
    };
  }, [open]);

  async function ask(
    event
  ) {
    event.preventDefault();

    const value =
      question.trim();

    if (
      value.length < 3
    ) {
      setError(
        "Enter a question for SalonAI."
      );
      return;
    }

    setLoading(true);
    setError("");
    setFeedbackRating(
      null
    );
    setFeedbackError("");

    try {
      const response =
        await askSalonAiAdviser({
          question:
            value,
          contextPath,
        });

      setResult(
        response
      );
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function rateAnswer(
    rating
  ) {
    if (
      !result?.inferenceId ||
      feedbackLoading
    ) {
      return;
    }

    setFeedbackLoading(
      true
    );
    setFeedbackError("");

    try {
      await submitSalonAiAdviserFeedback({
        inferenceId:
          result.inferenceId,
        rating,
      });

      setFeedbackRating(
        rating
      );
    } catch (
      requestError
    ) {
      setFeedbackError(
        errorMessage(
          requestError
        )
      );
    } finally {
      setFeedbackLoading(
        false
      );
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-[70] inline-flex min-h-11 items-center gap-2 rounded-full border border-black bg-amber-400 px-4 py-3 text-sm font-black text-black shadow-xl hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        onClick={() =>
          setOpen(true)
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="salonai-adviser-dialog"
      >
        <Sparkles
          size={18}
          aria-hidden="true"
        />
        Ask SalonAI
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-end bg-black/35 p-3 sm:p-5"
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false);
            }
          }}
        >
          <section
            ref={panelRef}
            id="salonai-adviser-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="salonai-adviser-title"
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-stone-200 p-4 sm:p-5">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-black">
                  <Bot
                    size={20}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <h2
                    id="salonai-adviser-title"
                    className="text-lg font-black text-black"
                  >
                    SalonAI Adviser
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Evidence-grounded, read-only management advice.
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close SalonAI Adviser"
                onClick={() =>
                  setOpen(false)
                }
                className="min-h-11 min-w-11 rounded-xl border border-stone-300 p-2 text-black hover:border-amber-400"
              >
                <X
                  size={18}
                />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {result?.answer ? (
                <article className="rounded-2xl bg-stone-100 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-black">
                    {result.answer}
                  </p>

                  <div className="mt-4 border-t border-stone-300 pt-3 text-xs text-stone-600">
                    <strong className="text-black">
                      Evidence:
                    </strong>{" "}
                    {result.evidence
                      ?.periodLabel ||
                      "Current SalonAI data"}
                    {result.evidence
                      ?.knowledge
                      ?.length
                      ? ` · ${result.evidence.knowledge.length} reviewed knowledge source(s)`
                      : ""}
                    {" · "}
                    {result.adviser
                      ?.provider ===
                    "remote"
                      ? "AI-generated"
                      : "Local grounded response"}
                  </div>

                  {modelEvidence.length ? (
                    <div className="mt-3 space-y-2">
                      {modelEvidence.map(
                        (item) => (
                          <div
                            key={`${item.modelName}-${item.modelVersion}`}
                            className="rounded-xl border border-stone-300 bg-white p-3 text-xs text-stone-700"
                          >
                            <div className="font-bold text-black">
                              Model evidence ·{" "}
                              {item.modelName}{" "}
                              {item.modelVersion}
                            </div>
                            <div className="mt-1">
                              {item.productionActive
                                ? "Production active"
                                : `${item.lifecycle || "experiment"} · not active in production`}
                            </div>
                            <div className="mt-1">
                              Test PR-AUC{" "}
                              {modelMetric(
                                item.testMetrics
                                  ?.prAuc
                              )}
                              {" · "}
                              Rules PR-AUC{" "}
                              {modelMetric(
                                item.rulesBaseline
                                  ?.metrics
                                  ?.prAuc
                              )}
                              {" · "}
                              Test Brier{" "}
                              {modelMetric(
                                item.testMetrics
                                  ?.brierScore
                              )}
                              {" · "}
                              Rules Brier{" "}
                              {modelMetric(
                                item.rulesBaseline
                                  ?.metrics
                                  ?.brierScore
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : null}

                  {result.inferenceId ? (
                    <div className="mt-4 border-t border-stone-300 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-xs font-bold text-black">
                          Was this useful?
                        </span>

                        <button
                          type="button"
                          aria-label="Mark SalonAI answer useful"
                          aria-pressed={
                            feedbackRating ===
                            1
                          }
                          disabled={
                            feedbackLoading
                          }
                          onClick={() =>
                            rateAnswer(
                              1
                            )
                          }
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-300 bg-white p-2 text-black hover:border-amber-400 disabled:opacity-50"
                        >
                          <ThumbsUp
                            size={17}
                            aria-hidden="true"
                          />
                        </button>

                        <button
                          type="button"
                          aria-label="Mark SalonAI answer not useful"
                          aria-pressed={
                            feedbackRating ===
                            -1
                          }
                          disabled={
                            feedbackLoading
                          }
                          onClick={() =>
                            rateAnswer(
                              -1
                            )
                          }
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-300 bg-white p-2 text-black hover:border-amber-400 disabled:opacity-50"
                        >
                          <ThumbsDown
                            size={17}
                            aria-hidden="true"
                          />
                        </button>

                        {feedbackRating !==
                        null ? (
                          <span
                            role="status"
                            className="text-xs font-semibold text-stone-600"
                          >
                            Feedback saved.
                          </span>
                        ) : null}
                      </div>

                      {feedbackError ? (
                        <div
                          role="alert"
                          className="mt-2 text-xs font-semibold text-red-700"
                        >
                          {feedbackError}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ) : (
                <div className="rounded-2xl border border-dashed border-stone-300 p-5 text-sm text-stone-600">
                  Ask about bookings, revenue, no-shows, operational issues or reviewed salon knowledge. The Adviser only uses evidence your account is permitted to access.
                </div>
              )}

              {error ? (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
                >
                  {error}
                </div>
              ) : null}
            </div>

            <form
              className="border-t border-stone-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              onSubmit={ask}
            >
              <label
                htmlFor="salonai-adviser-question"
                className="sr-only"
              >
                Ask SalonAI
              </label>
              <textarea
                id="salonai-adviser-question"
                rows="3"
                maxLength="1500"
                value={
                  question
                }
                onChange={(
                  event
                ) =>
                  setQuestion(
                    event.target
                      .value
                  )
                }
                placeholder="Why are no-shows increasing?"
                className="w-full resize-none rounded-xl border border-stone-300 px-3 py-3 text-sm text-black outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-stone-500">
                  Context:{" "}
                  {contextPath ||
                    "management"}
                </span>

                <button
                  type="submit"
                  disabled={
                    loading
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-black text-black hover:bg-amber-300 disabled:opacity-50"
                >
                  <Send
                    size={15}
                    aria-hidden="true"
                  />
                  {loading
                    ? "Thinking…"
                    : "Ask"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
