import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Loader2 } from 'lucide-react';

// ============================================================================
// Configuration Constants
// ============================================================================

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwYSD59rFSVlIr4OxPZuuuuxOn0NVeFhHjtcFYEkO6Mdmfdahz1xP1iGKwOIwa1XFmR/exec';

const LOGO_URL = '';

const SURVEY_CONFIG = {
  surveyTitle: 'Online Shopping Experience Survey',
  surveySubtitle:
    'Share your honest feedback about shopping on eBay. Your insights help highlight what works well and what needs improvement.',
  requiredLegend: 'Required fields are marked with',
  progressLabel: (answered: number, total: number) =>
    `Question ${answered} of ${total}`,
  progressSummary: (answered: number, total: number) =>
    `${answered}/${total} answered`,
  maxTextareaLength: 1000,
  textareaPlaceholder: 'Write your response here…',
  selectPlaceholder: 'Select an area…',
  emailPlaceholder: 'you@example.com',
  submitLabel: 'Submit feedback',
  submittingLabel: 'Submitting…',
  networkErrorMessage: 'Something went wrong. Please try again.',
  footerText:
    'Independent survey about shopping on eBay. Not affiliated with or endorsed by eBay Inc.',
  thankYou: {
    heading: 'Thank you for your feedback!',
    body: 'Your response has been recorded and will help improve the shopping experience.',
    resetButton: 'Submit another response',
  },
  errors: {
    ratingRequired: 'Please select a rating.',
    textRequired: 'Please enter a response.',
    radioRequired: 'Please select an option.',
    selectRequired: 'Please choose an area from the list.',
    emailInvalid: 'Please enter a valid email address or leave this field blank.',
  },
  questions: {
    Q1: {
      label:
        'Q1. Overall, how satisfied are you with your eBay shopping experience?',
      required: true,
      min: 1,
      max: 5,
      minLabel: '1 = Very dissatisfied',
      maxLabel: '5 = Very satisfied',
    },
    Q2: {
      label: 'Q2. What is the primary reason for your satisfaction rating?',
      required: true,
    },
    Q3: {
      label:
        'Q3. How likely are you to recommend shopping on eBay to a friend or colleague?',
      required: true,
      min: 0,
      max: 10,
      minLabel: '0 = Not at all likely',
      maxLabel: '10 = Extremely likely',
    },
    Q4: {
      label: 'Q4. What is the main reason for your recommendation score?',
      required: true,
    },
    Q5: {
      label:
        "Q5. Did the item condition and delivery match the seller's listing description?",
      required: true,
      options: ['Yes', 'Partly', 'No'] as const,
    },
    Q6: {
      label:
        'Q6. What specific aspects of the item condition, packaging, or delivery could be improved?',
      required: false,
    },
    Q7: {
      label:
        "Q7. How do you rate eBay's pricing, seller fees, and overall value for money?",
      required: true,
      min: 1,
      max: 5,
      minLabel: '1 = Very poor',
      maxLabel: '5 = Very good',
    },
    Q8: {
      label:
        'Q8. Which other shopping platforms do you use regularly? (pick as many as apply)',
      required: false,
      options: [
        'Amazon',
        'Walmart',
        'AliExpress',
        'Temu',
        'Etsy',
        'Facebook Marketplace',
        'Jumia',
        'Konga',
        'Shein',
        'Alibaba',
        'Other',
      ] as const,
    },
    Q9: {
      label: 'Q9. What do other platforms do better than eBay?',
      required: false,
    },
    Q10: {
      label: 'Q10. What area should eBay prioritize improving most?',
      required: true,
      options: [
        'Item quality and listing accuracy',
        'Delivery speed and tracking',
        'Pricing and fees',
        'Seller trust and verification',
        'Returns and buyer protection',
        'Search and site navigation',
        'Customer support',
        'Payments and checkout',
        'Mobile app experience',
        'Other',
      ] as const,
    },
    Q11: {
      label:
        'Q11. What is the single most important improvement eBay should make to enhance your experience?',
      required: true,
    },
    Q12: {
      label: 'Q12. Email address (optional)',
      required: false,
      note: 'Only used if we need to follow up. Leave blank to stay anonymous.',
    },
  },
} as const;

// ============================================================================
// Types & Initial State
// ============================================================================

type QuestionKey =
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'Q4'
  | 'Q5'
  | 'Q6'
  | 'Q7'
  | 'Q8'
  | 'Q9'
  | 'Q10'
  | 'Q11'
  | 'Q12';

interface SurveyFormState {
  Q1: number | null;
  Q2: string;
  Q3: number | null;
  Q4: string;
  Q5: string;
  Q6: string;
  Q7: number | null;
  Q8: string[];
  Q9: string;
  Q10: string;
  Q11: string;
  Q12: string;
  website: string; // Honeypot
}

type FieldErrors = Partial<Record<QuestionKey, string>>;

const QUESTION_ORDER: QuestionKey[] = [
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'Q5',
  'Q6',
  'Q7',
  'Q8',
  'Q9',
  'Q10',
  'Q11',
  'Q12',
];

const INITIAL_FORM_STATE: SurveyFormState = {
  Q1: null,
  Q2: '',
  Q3: null,
  Q4: '',
  Q5: '',
  Q6: '',
  Q7: null,
  Q8: [],
  Q9: '',
  Q10: '',
  Q11: '',
  Q12: '',
  website: '',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================================
// Reusable Subcomponents
// ============================================================================

function RequiredMark() {
  return (
    <span className="text-[#C81E1E] ml-1 font-semibold" aria-hidden="true">
      *
    </span>
  );
}

function InlineError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-[#C81E1E]"
    >
      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

interface TextareaQuestionProps {
  id: QuestionKey;
  label: string;
  required: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  containerRef: (el: HTMLElement | null) => void;
}

function TextareaQuestion({
  id,
  label,
  required,
  value,
  error,
  onChange,
  containerRef,
}: TextareaQuestionProps) {
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;
  const maxLen = SURVEY_CONFIG.maxTextareaLength;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={`rounded-[8px] border bg-white p-5 sm:p-6 transition-colors duration-150 focus:outline-none ${
        error
          ? 'border-[#C81E1E] ring-1 ring-[#C81E1E]'
          : 'border-[#E5E7EB]'
      }`}
    >
      <label
        htmlFor={id}
        className="block text-base font-semibold leading-snug text-[#191919] mb-3"
      >
        {label}
        {required && <RequiredMark />}
      </label>

      <textarea
        id={id}
        name={id}
        rows={4}
        maxLength={maxLen}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={SURVEY_CONFIG.textareaPlaceholder}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${errorId} ${counterId}` : counterId}
        className={`w-full rounded-[8px] border bg-white px-3.5 py-3 text-base leading-relaxed text-[#191919] placeholder:text-[#767676] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#1A5FD0]/25 ${
          error
            ? 'border-[#C81E1E] focus:border-[#C81E1E]'
            : 'border-[#D1D5DB] focus:border-[#1A5FD0]'
        }`}
      />

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <InlineError id={errorId} message={error} />
        </div>
        <span
          id={counterId}
          className={`text-xs tabular-nums shrink-0 pt-0.5 ${
            value.length >= maxLen
              ? 'text-[#C81E1E] font-medium'
              : 'text-[#555555]'
          }`}
        >
          {value.length} / {maxLen}
        </span>
      </div>
    </div>
  );
}

interface RatingQuestionProps {
  id: 'Q1' | 'Q3' | 'Q7';
  label: string;
  required: boolean;
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  value: number | null;
  error?: string;
  onChange: (value: number) => void;
  containerRef: (el: HTMLElement | null) => void;
}

function RatingQuestion({
  id,
  label,
  required,
  min,
  max,
  minLabel,
  maxLabel,
  value,
  error,
  onChange,
  containerRef,
}: RatingQuestionProps) {
  const errorId = `${id}-error`;
  const numbers = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max]
  );

  return (
    <fieldset
      ref={containerRef}
      tabIndex={-1}
      aria-required={required}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : undefined}
      className={`rounded-[8px] border bg-white p-5 sm:p-6 transition-colors duration-150 focus:outline-none ${
        error
          ? 'border-[#C81E1E] ring-1 ring-[#C81E1E]'
          : 'border-[#E5E7EB]'
      }`}
    >
      <legend className="sr-only">
        {label}
        {required ? ' (required)' : ''}
      </legend>

      <div
        aria-hidden="true"
        className="text-base font-semibold leading-snug text-[#191919] mb-4"
      >
        {label}
        {required && <RequiredMark />}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {numbers.map((num) => {
          const isSelected = value === num;
          return (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              aria-pressed={isSelected}
              className={`min-h-[48px] min-w-[48px] px-3.5 rounded-full text-base font-semibold tabular-nums transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5FD0] focus-visible:ring-offset-2 ${
                isSelected
                  ? 'bg-[#1A5FD0] text-white border border-[#1A5FD0]'
                  : 'bg-white text-[#191919] border border-[#D1D5DB] hover:border-[#1A5FD0] hover:bg-[#F3F7FE]'
              }`}
            >
              {num}
            </button>
          );
        })}
      </div>

      {(minLabel || maxLabel) && (
        <div className="mt-3 flex items-center justify-between gap-4 text-xs text-[#555555]">
          <span>{minLabel}</span>
          <span className="text-right">{maxLabel}</span>
        </div>
      )}

      <InlineError id={errorId} message={error} />
    </fieldset>
  );
}

// ============================================================================
// Main Application
// ============================================================================

export default function App() {
  const [form, setForm] = useState<SurveyFormState>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const submittingGuardRef = useRef(false);
  const fieldRefs = useRef<Partial<Record<QuestionKey, HTMLElement | null>>>({});

  useEffect(() => {
    document.title = SURVEY_CONFIG.surveyTitle;
  }, []);

  const setFieldRef = (key: QuestionKey) => (el: HTMLElement | null) => {
    fieldRefs.current[key] = el;
  };

  const answeredCount = useMemo(() => {
    let count = 0;
    if (form.Q1 !== null) count++;
    if (form.Q2.trim().length > 0) count++;
    if (form.Q3 !== null) count++;
    if (form.Q4.trim().length > 0) count++;
    if (form.Q5.trim().length > 0) count++;
    if (form.Q6.trim().length > 0) count++;
    if (form.Q7 !== null) count++;
    if (form.Q8.length > 0) count++;
    if (form.Q9.trim().length > 0) count++;
    if (form.Q10.trim().length > 0) count++;
    if (form.Q11.trim().length > 0) count++;
    if (form.Q12.trim().length > 0) count++;
    return count;
  }, [form]);

  const progressRatio = answeredCount / QUESTION_ORDER.length;

  const clearFieldError = (key: QuestionKey) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (submitError) setSubmitError(null);
  };

  const updateField = <K extends keyof SurveyFormState>(
    key: K,
    value: SurveyFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key !== 'website') {
      clearFieldError(key as QuestionKey);
    }
  };

  const togglePlatform = (platform: string) => {
    setForm((prev) => {
      const exists = prev.Q8.includes(platform);
      const nextQ8 = exists
        ? prev.Q8.filter((item) => item !== platform)
        : [...prev.Q8, platform];
      return { ...prev, Q8: nextQ8 };
    });
    clearFieldError('Q8');
  };

  const validate = (): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (form.Q1 === null) {
      nextErrors.Q1 = SURVEY_CONFIG.errors.ratingRequired;
    }
    if (form.Q2.trim() === '') {
      nextErrors.Q2 = SURVEY_CONFIG.errors.textRequired;
    }
    if (form.Q3 === null) {
      nextErrors.Q3 = SURVEY_CONFIG.errors.ratingRequired;
    }
    if (form.Q4.trim() === '') {
      nextErrors.Q4 = SURVEY_CONFIG.errors.textRequired;
    }
    if (form.Q5.trim() === '') {
      nextErrors.Q5 = SURVEY_CONFIG.errors.radioRequired;
    }
    if (form.Q7 === null) {
      nextErrors.Q7 = SURVEY_CONFIG.errors.ratingRequired;
    }
    if (form.Q10.trim() === '') {
      nextErrors.Q10 = SURVEY_CONFIG.errors.selectRequired;
    }
    if (form.Q11.trim() === '') {
      nextErrors.Q11 = SURVEY_CONFIG.errors.textRequired;
    }
    const emailTrimmed = form.Q12.trim();
    if (emailTrimmed !== '' && !EMAIL_REGEX.test(emailTrimmed)) {
      nextErrors.Q12 = SURVEY_CONFIG.errors.emailInvalid;
    }

    return nextErrors;
  };

  const scrollToFirstError = (validationErrors: FieldErrors) => {
    const firstKey = QUESTION_ORDER.find((key) => Boolean(validationErrors[key]));
    if (!firstKey) return;

    const target = fieldRefs.current[firstKey];
    if (!target) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });

    // Focus the first interactive control inside the question block, or the block itself
    const focusable = target.querySelector<HTMLElement>(
      'textarea, select, input:not([type="hidden"]), button'
    );
    if (focusable) {
      focusable.focus({ preventScroll: true });
    } else {
      target.focus({ preventScroll: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingGuardRef.current || isSubmitting) return;

    setSubmitError(null);
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      scrollToFirstError(validationErrors);
      return;
    }

    // Honeypot check: if filled by automated bot, silently skip sending and show thank-you screen
    if (form.website.trim() !== '') {
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    submittingGuardRef.current = true;
    setIsSubmitting(true);

    const payload = {
      Q1: form.Q1 as number,
      Q2: form.Q2.trim(),
      Q3: form.Q3 as number,
      Q4: form.Q4.trim(),
      Q5: form.Q5.trim(),
      Q6: form.Q6.trim(),
      Q7: form.Q7 as number,
      Q8: form.Q8,
      Q9: form.Q9.trim(),
      Q10: form.Q10.trim(),
      Q11: form.Q11.trim(),
      Q12: form.Q12.trim(),
    };

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {
      setSubmitError(SURVEY_CONFIG.networkErrorMessage);
    } finally {
      submittingGuardRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm(INITIAL_FORM_STATE);
    setErrors({});
    setSubmitError(null);
    setIsSubmitted(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const showLogo = LOGO_URL.trim() !== '' && !logoFailed;

  return (
    <div className="min-h-screen bg-white text-[#191919] flex flex-col">
      {/* Compact Sticky Progress Indicator (when survey is active) */}
      {!isSubmitted && (
        <div
          className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-[#E5E7EB]"
          role="region"
          aria-label="Survey progress"
        >
          <div className="max-w-[640px] mx-auto px-4 sm:px-6 pt-3 pb-2.5">
            <div className="flex items-center justify-between gap-4 text-xs sm:text-sm font-medium text-[#191919] mb-2">
              <span className="tabular-nums">
                {SURVEY_CONFIG.progressLabel(
                  answeredCount,
                  QUESTION_ORDER.length
                )}
              </span>
              <span className="text-[#555555] tabular-nums">
                {SURVEY_CONFIG.progressSummary(
                  answeredCount,
                  QUESTION_ORDER.length
                )}
              </span>
            </div>
            <div
              className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={QUESTION_ORDER.length}
              aria-valuenow={answeredCount}
              aria-label={`Answered ${answeredCount} of ${QUESTION_ORDER.length} questions`}
            >
              <div
                className="h-full w-full bg-[#1A5FD0] origin-left transition-transform duration-200 ease-out"
                style={{ transform: `scaleX(${progressRatio})` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 w-full max-w-[640px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header */}
        <header className="mb-8">
          {showLogo && (
            <div className="mb-4">
              <img
                src={LOGO_URL}
                alt={`${SURVEY_CONFIG.surveyTitle} logo`}
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="max-h-12 w-auto object-contain"
              />
            </div>
          )}

          <div className="rounded-[8px] bg-[#EEF4FF] border border-[#D8E5FC] px-5 py-6 sm:px-6 sm:py-7">
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#191919] leading-tight [text-wrap:balance]">
              {SURVEY_CONFIG.surveyTitle}
            </h1>
            <p className="mt-2.5 text-base text-[#374151] leading-relaxed">
              {SURVEY_CONFIG.surveySubtitle}
            </p>
            {!isSubmitted && (
              <p className="mt-3 text-sm text-[#555555]">
                {SURVEY_CONFIG.requiredLegend}
                <RequiredMark />.
              </p>
            )}
          </div>
        </header>

        {/* Main Content: Thank-you Screen or Survey Form */}
        <main>
          {isSubmitted ? (
            <section
              aria-live="polite"
              className="rounded-[8px] border border-[#E5E7EB] bg-white px-6 py-10 sm:px-8 sm:py-12 text-center"
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A5FD0] text-white">
                <Check className="h-7 w-7 stroke-[2.5]" aria-hidden="true" />
              </div>

              <h2 className="text-2xl font-bold text-[#191919] [text-wrap:balance]">
                {SURVEY_CONFIG.thankYou.heading}
              </h2>

              <p className="mt-3 text-base text-[#555555] leading-relaxed max-w-md mx-auto">
                {SURVEY_CONFIG.thankYou.body}
              </p>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-full bg-[#1A5FD0] text-white text-base font-semibold hover:bg-[#154EB0] active:bg-[#124296] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5FD0] focus-visible:ring-offset-2"
                >
                  {SURVEY_CONFIG.thankYou.resetButton}
                </button>
              </div>
            </section>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* Hidden Honeypot Field */}
              <div
                className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden"
                aria-hidden="true"
              >
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => updateField('website', e.target.value)}
                />
              </div>

              {/* Q1 */}
              <RatingQuestion
                id="Q1"
                label={SURVEY_CONFIG.questions.Q1.label}
                required={SURVEY_CONFIG.questions.Q1.required}
                min={SURVEY_CONFIG.questions.Q1.min}
                max={SURVEY_CONFIG.questions.Q1.max}
                minLabel={SURVEY_CONFIG.questions.Q1.minLabel}
                maxLabel={SURVEY_CONFIG.questions.Q1.maxLabel}
                value={form.Q1}
                error={errors.Q1}
                onChange={(val) => updateField('Q1', val)}
                containerRef={setFieldRef('Q1')}
              />

              {/* Q2 */}
              <TextareaQuestion
                id="Q2"
                label={SURVEY_CONFIG.questions.Q2.label}
                required={SURVEY_CONFIG.questions.Q2.required}
                value={form.Q2}
                error={errors.Q2}
                onChange={(val) => updateField('Q2', val)}
                containerRef={setFieldRef('Q2')}
              />

              {/* Q3 */}
              <RatingQuestion
                id="Q3"
                label={SURVEY_CONFIG.questions.Q3.label}
                required={SURVEY_CONFIG.questions.Q3.required}
                min={SURVEY_CONFIG.questions.Q3.min}
                max={SURVEY_CONFIG.questions.Q3.max}
                minLabel={SURVEY_CONFIG.questions.Q3.minLabel}
                maxLabel={SURVEY_CONFIG.questions.Q3.maxLabel}
                value={form.Q3}
                error={errors.Q3}
                onChange={(val) => updateField('Q3', val)}
                containerRef={setFieldRef('Q3')}
              />

              {/* Q4 */}
              <TextareaQuestion
                id="Q4"
                label={SURVEY_CONFIG.questions.Q4.label}
                required={SURVEY_CONFIG.questions.Q4.required}
                value={form.Q4}
                error={errors.Q4}
                onChange={(val) => updateField('Q4', val)}
                containerRef={setFieldRef('Q4')}
              />

              {/* Q5: Three large radio buttons */}
              <fieldset
                ref={setFieldRef('Q5')}
                tabIndex={-1}
                aria-required={SURVEY_CONFIG.questions.Q5.required}
                aria-invalid={Boolean(errors.Q5)}
                aria-describedby={errors.Q5 ? 'Q5-error' : undefined}
                className={`rounded-[8px] border bg-white p-5 sm:p-6 transition-colors duration-150 focus:outline-none ${
                  errors.Q5
                    ? 'border-[#C81E1E] ring-1 ring-[#C81E1E]'
                    : 'border-[#E5E7EB]'
                }`}
              >
                <legend className="sr-only">
                  {SURVEY_CONFIG.questions.Q5.label} (required)
                </legend>

                <div
                  aria-hidden="true"
                  className="text-base font-semibold leading-snug text-[#191919] mb-4"
                >
                  {SURVEY_CONFIG.questions.Q5.label}
                  {SURVEY_CONFIG.questions.Q5.required && <RequiredMark />}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  {SURVEY_CONFIG.questions.Q5.options.map((option) => {
                    const isSelected = form.Q5 === option;
                    return (
                      <label
                        key={option}
                        className={`relative flex-1 min-h-[48px] px-5 py-2.5 rounded-full border text-base font-medium flex items-center justify-center gap-2.5 cursor-pointer transition-colors duration-150 select-none focus-within:ring-2 focus-within:ring-[#1A5FD0] focus-within:ring-offset-2 ${
                          isSelected
                            ? 'bg-[#1A5FD0] text-white border-[#1A5FD0]'
                            : 'bg-white text-[#191919] border-[#D1D5DB] hover:border-[#1A5FD0] hover:bg-[#F3F7FE]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="Q5"
                          value={option}
                          checked={isSelected}
                          onChange={() => updateField('Q5', option)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-white bg-white'
                              : 'border-[#767676] bg-white'
                          }`}
                        >
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-[#1A5FD0]" />
                          )}
                        </span>
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>

                <InlineError id="Q5-error" message={errors.Q5} />
              </fieldset>

              {/* Q6 */}
              <TextareaQuestion
                id="Q6"
                label={SURVEY_CONFIG.questions.Q6.label}
                required={SURVEY_CONFIG.questions.Q6.required}
                value={form.Q6}
                error={errors.Q6}
                onChange={(val) => updateField('Q6', val)}
                containerRef={setFieldRef('Q6')}
              />

              {/* Q7 */}
              <RatingQuestion
                id="Q7"
                label={SURVEY_CONFIG.questions.Q7.label}
                required={SURVEY_CONFIG.questions.Q7.required}
                min={SURVEY_CONFIG.questions.Q7.min}
                max={SURVEY_CONFIG.questions.Q7.max}
                minLabel={SURVEY_CONFIG.questions.Q7.minLabel}
                maxLabel={SURVEY_CONFIG.questions.Q7.maxLabel}
                value={form.Q7}
                error={errors.Q7}
                onChange={(val) => updateField('Q7', val)}
                containerRef={setFieldRef('Q7')}
              />

              {/* Q8: Multi-select checkboxes styled as chips */}
              <fieldset
                ref={setFieldRef('Q8')}
                tabIndex={-1}
                className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 sm:p-6 focus:outline-none"
              >
                <legend className="sr-only">
                  {SURVEY_CONFIG.questions.Q8.label}
                </legend>

                <div
                  aria-hidden="true"
                  className="text-base font-semibold leading-snug text-[#191919] mb-4"
                >
                  {SURVEY_CONFIG.questions.Q8.label}
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {SURVEY_CONFIG.questions.Q8.options.map((platform) => {
                    const isChecked = form.Q8.includes(platform);
                    return (
                      <label
                        key={platform}
                        className={`min-h-[48px] px-4 py-2 rounded-full border text-base font-medium inline-flex items-center gap-2 cursor-pointer transition-colors duration-150 select-none focus-within:ring-2 focus-within:ring-[#1A5FD0] focus-within:ring-offset-2 ${
                          isChecked
                            ? 'bg-[#1A5FD0] text-white border-[#1A5FD0]'
                            : 'bg-white text-[#191919] border-[#D1D5DB] hover:border-[#1A5FD0] hover:bg-[#F3F7FE]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="Q8"
                          value={platform}
                          checked={isChecked}
                          onChange={() => togglePlatform(platform)}
                          className="sr-only"
                        />
                        {isChecked && (
                          <Check
                            className="w-4 h-4 shrink-0 stroke-[2.5]"
                            aria-hidden="true"
                          />
                        )}
                        <span>{platform}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {/* Q9 */}
              <TextareaQuestion
                id="Q9"
                label={SURVEY_CONFIG.questions.Q9.label}
                required={SURVEY_CONFIG.questions.Q9.required}
                value={form.Q9}
                error={errors.Q9}
                onChange={(val) => updateField('Q9', val)}
                containerRef={setFieldRef('Q9')}
              />

              {/* Q10: Dropdown select */}
              <div
                ref={setFieldRef('Q10')}
                tabIndex={-1}
                className={`rounded-[8px] border bg-white p-5 sm:p-6 transition-colors duration-150 focus:outline-none ${
                  errors.Q10
                    ? 'border-[#C81E1E] ring-1 ring-[#C81E1E]'
                    : 'border-[#E5E7EB]'
                }`}
              >
                <label
                  htmlFor="Q10"
                  className="block text-base font-semibold leading-snug text-[#191919] mb-3"
                >
                  {SURVEY_CONFIG.questions.Q10.label}
                  {SURVEY_CONFIG.questions.Q10.required && <RequiredMark />}
                </label>

                <div className="relative">
                  <select
                    id="Q10"
                    name="Q10"
                    value={form.Q10}
                    onChange={(e) => updateField('Q10', e.target.value)}
                    aria-required={SURVEY_CONFIG.questions.Q10.required}
                    aria-invalid={Boolean(errors.Q10)}
                    aria-describedby={errors.Q10 ? 'Q10-error' : undefined}
                    className={`w-full min-h-[48px] appearance-none rounded-[8px] border bg-white px-3.5 py-2.5 pr-11 text-base transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#1A5FD0]/25 ${
                      form.Q10 === '' ? 'text-[#767676]' : 'text-[#191919]'
                    } ${
                      errors.Q10
                        ? 'border-[#C81E1E] focus:border-[#C81E1E]'
                        : 'border-[#D1D5DB] focus:border-[#1A5FD0]'
                    }`}
                  >
                    <option value="">{SURVEY_CONFIG.selectPlaceholder}</option>
                    {SURVEY_CONFIG.questions.Q10.options.map((opt) => (
                      <option
                        key={opt}
                        value={opt}
                        className="text-[#191919]"
                      >
                        {opt}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555555]"
                    aria-hidden="true"
                  />
                </div>

                <InlineError id="Q10-error" message={errors.Q10} />
              </div>

              {/* Q11 */}
              <TextareaQuestion
                id="Q11"
                label={SURVEY_CONFIG.questions.Q11.label}
                required={SURVEY_CONFIG.questions.Q11.required}
                value={form.Q11}
                error={errors.Q11}
                onChange={(val) => updateField('Q11', val)}
                containerRef={setFieldRef('Q11')}
              />

              {/* Q12: Optional email */}
              <div
                ref={setFieldRef('Q12')}
                tabIndex={-1}
                className={`rounded-[8px] border bg-white p-5 sm:p-6 transition-colors duration-150 focus:outline-none ${
                  errors.Q12
                    ? 'border-[#C81E1E] ring-1 ring-[#C81E1E]'
                    : 'border-[#E5E7EB]'
                }`}
              >
                <label
                  htmlFor="Q12"
                  className="block text-base font-semibold leading-snug text-[#191919] mb-1.5"
                >
                  {SURVEY_CONFIG.questions.Q12.label}
                </label>

                <p id="Q12-note" className="text-sm text-[#555555] mb-3">
                  {SURVEY_CONFIG.questions.Q12.note}
                </p>

                <input
                  id="Q12"
                  name="Q12"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.Q12}
                  onChange={(e) => updateField('Q12', e.target.value)}
                  placeholder={SURVEY_CONFIG.emailPlaceholder}
                  aria-invalid={Boolean(errors.Q12)}
                  aria-describedby={
                    errors.Q12 ? 'Q12-note Q12-error' : 'Q12-note'
                  }
                  className={`w-full min-h-[48px] rounded-[8px] border bg-white px-3.5 py-2.5 text-base text-[#191919] placeholder:text-[#767676] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#1A5FD0]/25 ${
                    errors.Q12
                      ? 'border-[#C81E1E] focus:border-[#C81E1E]'
                      : 'border-[#D1D5DB] focus:border-[#1A5FD0]'
                  }`}
                />

                <InlineError id="Q12-error" message={errors.Q12} />
              </div>

              {/* Submit Section */}
              <div className="pt-2">
                {submitError && (
                  <div
                    role="alert"
                    className="mb-4 rounded-[8px] border border-[#C81E1E] bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#C81E1E] flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto sm:min-w-[240px] min-h-[48px] px-8 py-3 rounded-full bg-[#1A5FD0] text-white text-base font-semibold inline-flex items-center justify-center gap-2.5 hover:bg-[#154EB0] active:bg-[#124296] disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5FD0] focus-visible:ring-offset-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2
                        className="w-5 h-5 animate-spin shrink-0"
                        aria-hidden="true"
                      />
                      <span>{SURVEY_CONFIG.submittingLabel}</span>
                    </>
                  ) : (
                    <span>{SURVEY_CONFIG.submitLabel}</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-[#E5E7EB] text-center">
          <p className="text-xs sm:text-sm text-[#555555] leading-relaxed">
            {SURVEY_CONFIG.footerText}
          </p>
        </footer>
      </div>
    </div>
  );
}
