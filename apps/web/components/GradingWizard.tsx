"use client";

import { useMemo, useRef, useState } from "react";
import { api, type AnswerKeyItem } from "@/lib/api";
import { actions, type Klass } from "@/lib/store";
import LineIcon from "./LineIcon";
import BatchGradingPipeline from "./BatchGradingPipeline";

type Step = 1 | 2 | 3;

export default function GradingWizard({
  klass,
  open,
  onClose,
  onStarted,
}: {
  klass: Klass;
  open: boolean;
  onClose: () => void;
  onStarted: (provId: string) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // V2: Facithantering - 3 alternativ
  const [facitMode, setFacitMode] = useState<'uploaded' | 'ai_generated' | 'none'>('none');
  const [facit, setFacit] = useState("");
  const [answerKeyItems, setAnswerKeyItems] = useState<AnswerKeyItem[]>([]);
  const [answerKeyFileName, setAnswerKeyFileName] = useState("");
  const [answerKeyLoading, setAnswerKeyLoading] = useState(false);
  const [answerKeyError, setAnswerKeyError] = useState<string | null>(null);
  const [answerKeyDragOver, setAnswerKeyDragOver] = useState(false);
  const [customParams, setCustomParams] = useState("");
  
  // V2: Elevidentifiering
  const [identificationMethod, setIdentificationMethod] = useState<'name_field' | 'qr_code' | 'barcode' | 'student_id'>('name_field');
  
  const [files, setFiles] = useState<File[]>([]);
  const [aiDescription, setAiDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const answerKeyInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: File[]) => {
    if (incoming.length) setFiles((prev) => [...prev, ...incoming]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };
  
  // Batch grading pipeline state
  const [showBatchPipeline, setShowBatchPipeline] = useState(false);
  const [createdProvId, setCreatedProvId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const parseManualFacit = (text: string): AnswerKeyItem[] => {
    const items: AnswerKeyItem[] = [];
    const re = /(?:^|\n)\s*(\d+[a-zA-Z]?)[\.:\)\-]\s*([^\n]*(?:\n(?!\s*\d+[a-zA-Z]?[\.:\)\-]\s*)[^\n]*)*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const final = m[2].replace(/\n+/g, " ").trim();
      if (final) items.push({ question_number: m[1], question_text: "", final_answer: final, derivation_steps: [], max_points: 1 });
    }
    if (items.length > 0) return items;
    return text
      .split(/\n{2,}/)
      .map((block, i) => ({
        question_number: String(i + 1),
        question_text: "",
        final_answer: block.trim(),
        derivation_steps: [],
        max_points: 1,
      }))
      .filter((it) => it.final_answer.length > 0);
  };

  const effectiveAnswerKey: AnswerKeyItem[] = useMemo(
    () => (answerKeyItems.length > 0 ? answerKeyItems : parseManualFacit(facit)),
    [answerKeyItems, facit],
  );

  if (!open && !showBatchPipeline) return null;

  const reset = () => {
    setStep(1);
    setTitle("");
    setDate(new Date().toISOString().split('T')[0]);
    setFacitMode('none');
    setFacit("");
    setAnswerKeyItems([]);
    setAnswerKeyFileName("");
    setAnswerKeyLoading(false);
    setAnswerKeyError(null);
    setAnswerKeyDragOver(false);
    setCustomParams("");
    setIdentificationMethod('name_field');
    setFiles([]);
    setAiDescription("");
    setShowAdvanced(false);
    setShowBatchPipeline(false);
    setCreatedProvId(null);
  };

  const formatAnswerKey = (items: AnswerKeyItem[]) =>
    items
      .map((item) => {
        const steps = item.derivation_steps.map((s) => `  - ${s}`).join("\n");
        return `Uppgift ${item.question_number}\nSlutsvar: ${item.final_answer}\nDelsteg:\n${steps || "  -"}`;
      })
      .join("\n\n");

  const updateAnswerKeyItem = (index: number, patch: Partial<AnswerKeyItem>) => {
    setAnswerKeyItems((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, ...patch } : item));
      setFacit(formatAnswerKey(next));
      return next;
    });
  };

  const updateAnswerKeyStep = (itemIndex: number, stepIndex: number, value: string) => {
    setAnswerKeyItems((prev) => {
      const next = prev.map((item, i) => {
        if (i !== itemIndex) return item;
        const derivation_steps = item.derivation_steps.map((stepText, j) => (j === stepIndex ? value : stepText));
        return { ...item, derivation_steps };
      });
      setFacit(formatAnswerKey(next));
      return next;
    });
  };

  const addAnswerKeyStep = (itemIndex: number) => {
    setAnswerKeyItems((prev) => {
      const next = prev.map((item, i) =>
        i === itemIndex ? { ...item, derivation_steps: [...item.derivation_steps, ""] } : item,
      );
      setFacit(formatAnswerKey(next));
      return next;
    });
  };

  const handleAnswerKeyFile = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setAnswerKeyError("Ladda upp en PDF eller bildfil.");
      return;
    }

    setAnswerKeyFileName(file.name);
    setAnswerKeyError(null);
    setAnswerKeyLoading(true);
    try {
      const items = await api.answerKeyUpload(file);
      setAnswerKeyItems(items);
      setFacit(formatAnswerKey(items));
    } catch (e) {
      setAnswerKeyError((e as Error).message);
    } finally {
      setAnswerKeyLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const handleStart = async () => {
    setStartError(null);
    setStarting(true);
    try {
      let finalAnswerKey: AnswerKeyItem[] = effectiveAnswerKey;

      // Generera facit i AI-läget innan vi går vidare.
      if (facitMode === 'ai_generated') {
        const generated = await api.answerKeyGenerate(aiDescription, 2);
        setAnswerKeyItems(generated);
        finalAnswerKey = generated;
      }

      if (finalAnswerKey.length === 0 && facitMode !== 'none') {
        throw new Error("Du måste ange, ladda upp eller generera ett facit först.");
      }

      const activeCustomParams = facitMode === 'ai_generated' ? aiDescription : facitMode === 'uploaded' ? customParams : '';
      const totalMaxPoints = facitMode === 'none' ? 0 : finalAnswerKey.reduce(
        (sum, item) => sum + Math.max(1, item.max_points ?? item.derivation_steps?.length ?? 1),
        0
      );

      // Bygg frågelista från facit så att ReviewWorkbench vet rätt antal uppgifter.
      const questions = facitMode === 'none' ? [] : finalAnswerKey.map((item) => ({
        id: crypto.randomUUID(),
        number: String(item.question_number),
        maxPoints: Math.max(1, item.max_points ?? item.derivation_steps?.length ?? 1),
      }));

      // Skapa provet först
      const prov = await actions.startProv({
        klassId: klass.id,
        title: title || "Prov utan namn",
        date,
        maxPoints: totalMaxPoints,
        facitMode,
        facit: facitMode === 'uploaded' ? facit : undefined,
        customParams: activeCustomParams,
        questions,
      });

      setCreatedProvId(prov.id);

      // Visa batch grading pipeline för hela klassen
      setShowBatchPipeline(true);
    } catch (e) {
      const message = (e as Error).message;
      setStartError(
        message === "Failed to fetch"
          ? "Kunde inte nå backend-servern. Kontrollera att API:et körs på http://localhost:8000."
          : message,
      );
    } finally {
      setStarting(false);
    }
  };
  
  const handleBatchComplete = () => {
    if (createdProvId) {
      onStarted(createdProvId);
    }
    handleClose();
  };

  // Show batch pipeline if active
  if (showBatchPipeline && createdProvId) {
    return (
      <BatchGradingPipeline
        open={showBatchPipeline}
        onClose={handleClose}
        onComplete={handleBatchComplete}
        provTitle={title || "Prov utan namn"}
        provId={createdProvId}
        klassId={klass.id}
        klassParams={klass.gradingParams}
        customParams={facitMode === 'ai_generated' ? aiDescription : customParams}
        answerKey={effectiveAnswerKey}
        files={files}
        identificationMethod={identificationMethod}
        expectedStudents={files.length}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-paper backdrop-blur-sm sm:items-center sm:p-4" onClick={handleClose}>
      <div
        className="relative flex w-full max-w-2xl flex-col border-ink-hairline bg-paper-raised shadow-card max-h-none sm:max-h-[90vh] sm:rounded-2xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-ink-hairline px-5 pb-3 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.08em] text-ink-secondary font-semibold">Rätta nytt prov</div>
              <div className="mt-1 text-xl font-semibold tracking-tight text-ink">{klass.name}</div>
              {((klass as any).code && (klass as any).code !== klass.name) || (klass.students?.length ?? 0) > 0 ? (
                <div className="mt-1 text-xs font-medium text-ink-muted tracking-wide uppercase">
                  {(klass as any).code && (klass as any).code !== klass.name
                    ? (klass as any).code
                    : `${klass.students.length} elever`}
                </div>
              ) : null}
            </div>
            <button onClick={handleClose} aria-label="Stäng" className="h-8 w-8 grid place-items-center rounded-full text-ink-muted hover:bg-paper hover:text-ink">
              <LineIcon name="x" className="h-4 w-4" />
            </button>
          </div>
          
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          <div className="space-y-5">
            {/* Grundflöde */}
            <div className="space-y-4">
              <Field label="Provets namn">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="t.ex. Prov 2 · Mekanik – Kraft & rörelse"
                  autoFocus
                />
              </Field>
              <Field label="Provdatum">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                />
              </Field>
            </div>

            <Field
              label="Skannad provbunt"
              hint="Fota proven direkt med kameran, eller välj en PDF/bilder. WiseOS sektionerar och rättar automatiskt."
            >
              {/* Mobil: kamera primär — direktfotografering är huvudflödet.
                  capture="environment" öppnar bakre kameran direkt på iOS/
                  Android; filväljaren finns som sekundärt alternativ. */}
              <div className="space-y-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="btn-primary w-full gap-2.5 py-3.5 text-[15px]"
                >
                  <LineIcon name="camera" className="h-5 w-5" />
                  Fota provet med kameran
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="btn-secondary w-full py-3 text-[14px]"
                >
                  <LineIcon name="file" className="h-4 w-4" />
                  Välj PDF eller bilder
                </button>
                <p className="text-center text-[11px] leading-relaxed text-ink-muted">
                  En elev i taget — foton samlas i listan nedan
                </p>
              </div>

              {/* Desktop: dropzone + sekundär kameraknapp */}
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(Array.from(e.dataTransfer.files));
                }}
                className="hidden cursor-pointer rounded-2xl border-2 border-dashed border-ink-hairline bg-paper p-10 text-center transition-all hover:border-ink-hairline hover:bg-paper-secondary sm:block"
              >
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-paper-secondary text-ink-secondary shadow-soft">
                  <LineIcon name="upload" className="h-7 w-7" />
                </div>
                <div className="mt-5 text-lg font-semibold text-ink">
                  {files.length ? `${files.length} fil(er) valda` : "Dra in PDF eller bilder"}
                </div>
                <div className="mx-auto mt-2 max-w-sm text-sm text-ink-secondary">
                  {files.length ? "Klicka eller dra för att lägga till fler filer." : "Klicka för att välja filer, eller släpp dem här."}
                </div>
                <div className="mt-4 flex items-center justify-center gap-3 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <LineIcon name="file" className="h-3.5 w-3.5" /> PDF
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <LineIcon name="file" className="h-3.5 w-3.5" /> PNG / JPG
                  </span>
                  <span>•</span>
                  <span>Max 100 MB</span>
                </div>
              </div>

              <div className="hidden flex-wrap items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="btn-tertiary gap-2 px-4 py-2.5 text-[13px]"
                >
                  <LineIcon name="camera" className="h-4 w-4" />
                  Fota med kameran
                </button>
                <span className="text-xs text-ink-muted">
                  En elev i taget — foton läggs till i listan
                </span>
              </div>

              {/* Delade dolda fil-inputs — både mobil- och desktop-knappar
                  trigg dessa. Appendar alltid; aldrig ersätt. */}
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []));
                  e.currentTarget.value = "";
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []));
                  e.currentTarget.value = "";
                }}
              />

              {/* Vald fillista — mobilvänlig: varje fil kan tas bort */}
              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-3 rounded-xl border border-ink-hairline bg-paper-secondary px-3 py-2"
                    >
                      <LineIcon name="file" className="h-4 w-4 shrink-0 text-ink-secondary" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {f.name}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
                        {(f.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        aria-label={`Ta bort ${f.name}`}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-paper hover:text-ink"
                      >
                        <LineIcon name="x" className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            <div className="rounded-2xl border border-ink-hairline bg-paper-secondary p-3 text-xs text-ink-secondary leading-snug">
              <span className="font-medium text-ink">Smart defaults:</span>{" "}
              WiseOS använder klassens rättningsparametrar, identifierar elever via namnfältet med OCR och avgör facit utifrån proven. Vill du ändra något?{" "}
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="font-medium text-ink underline hover:text-ink"
              >
                Visa avancerade inställningar
              </button>
            </div>

            {/* Avancerat */}
            {showAdvanced && (
              <div className="space-y-6 border-t border-ink-hairline pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">Avancerade inställningar</h3>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(false)}
                    className="text-xs text-ink-secondary hover:text-ink"
                  >
                    Dölj
                  </button>
                </div>

                <Field label="Facithantering" hint="Välj hur WiseOS ska hantera facit för detta prov.">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { value: 'uploaded', label: 'Ladda upp', desc: 'Jag har eget facit' },
                      { value: 'ai_generated', label: 'AI-genererat', desc: 'Beskriv provet, WiseOS skapar facit' },
                      { value: 'none', label: 'Inget facit', desc: 'WiseOS avgör själv utifrån proven' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFacitMode(opt.value as typeof facitMode)}
                        className={`rounded-xl border-2 p-3 text-left transition-all ${
                          facitMode === opt.value
                            ? 'border-ink bg-ink/5 ring-1 ring-ink/20 shadow-sm'
                            : 'border-ink-hairline bg-paper-secondary hover:border-ink-hairline hover:bg-paper'
                        }`}
                      >
                        <div className="text-sm font-semibold text-ink">
                          {opt.label}
                        </div>
                        <div className="text-xs text-ink-secondary mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </Field>

                {facitMode === 'uploaded' && (
                  <div className="space-y-5">
                    <Field
                      label="Ladda upp facit"
                      hint="Dra in befintligt lösningsförslag som PDF eller bild. wiseOS extraherar slutsvar och delsteg automatiskt."
                    >
                      <div
                        onClick={() => answerKeyInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setAnswerKeyDragOver(true);
                        }}
                        onDragLeave={() => setAnswerKeyDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setAnswerKeyDragOver(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleAnswerKeyFile(file);
                        }}
                        className={`cursor-pointer rounded-2xl border-2 border-dashed p-7 text-center transition-all ${
                          answerKeyDragOver
                            ? "border-ink bg-ink/5"
                            : "border-ink-hairline bg-paper-secondary hover:border-ink-hairline hover:bg-paper"
                        }`}
                      >
                        <div className="text-sm font-semibold text-ink">
                          {answerKeyFileName || "Släpp facit.pdf här eller klicka för att välja fil"}
                        </div>
                        <div className="mt-1 text-xs text-ink-secondary">PDF, PNG, JPG eller WEBP. Max 10 MB.</div>
                        <input
                          ref={answerKeyInputRef}
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAnswerKeyFile(file);
                            e.currentTarget.value = "";
                          }}
                        />
                      </div>
                      {answerKeyLoading && (
                        <div className="mt-2 text-sm text-ink-secondary">Analyserar facit och bygger strukturerad förhandsvisning...</div>
                      )}
                      {answerKeyError && <div className="mt-2 text-sm text-state-danger">{answerKeyError}</div>}
                    </Field>

                    {answerKeyItems.length > 0 && (
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-medium text-ink">Redigerbar förhandsvisning</div>
                          <div className="mt-0.5 text-xs text-ink-secondary leading-relaxed">
                            Justera slutsvar eller delsteg innan du går vidare.
                          </div>
                        </div>
                        {answerKeyItems.map((item, itemIndex) => (
                          <div key={`${item.question_number}-${itemIndex}`} className="rounded-2xl border border-ink-hairline bg-paper p-4">
                            <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                              <label className="block">
                                <div className="text-xs font-semibold text-ink-secondary">Uppgift</div>
                                <input
                                  value={item.question_number}
                                  onChange={(e) => updateAnswerKeyItem(itemIndex, { question_number: e.target.value })}
                                  className="input mt-1"
                                />
                              </label>
                              <label className="block">
                                <div className="text-xs font-semibold text-ink-secondary">Slutsvar</div>
                                <input
                                  value={item.final_answer}
                                  onChange={(e) => updateAnswerKeyItem(itemIndex, { final_answer: e.target.value })}
                                  className="input mt-1 font-mono text-[13px]"
                                />
                              </label>
                            </div>
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-semibold text-ink-secondary">Delsteg</div>
                              {item.derivation_steps.map((stepText, stepIndex) => (
                                <input
                                  key={stepIndex}
                                  value={stepText}
                                  onChange={(e) => updateAnswerKeyStep(itemIndex, stepIndex, e.target.value)}
                                  className="input font-mono text-[13px]"
                                  placeholder={`Delsteg ${stepIndex + 1}`}
                                />
                              ))}
                              <button
                                type="button"
                                onClick={() => addAnswerKeyStep(itemIndex)}
                                className="rounded-lg border border-ink-hairline px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-paper"
                              >
                                Lägg till delsteg
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <Field label="Manuell fallback" hint="Används om filen inte kan tolkas, eller som råtext bakom förhandsvisningen.">
                      <textarea
                        value={facit}
                        onChange={(e) => {
                          setFacit(e.target.value);
                          setAnswerKeyItems([]);
                        }}
                        className="input min-h-[160px] font-mono text-[13px] leading-relaxed"
                        placeholder="Ange facit, en uppgift per rad"
                      />
                    </Field>
                    <Field
                      label="Specifika instruktioner för detta prov (valfritt)"
                      hint="Ovanpå klassens defaults. T.ex. ”På uppgift 3 acceptera även energimetod”."
                    >
                      <textarea
                        value={customParams}
                        onChange={(e) => setCustomParams(e.target.value)}
                        className="input min-h-[80px] font-mono text-[13px] leading-relaxed"
                        placeholder="Specialregler bara för detta prov…"
                      />
                    </Field>
                  </div>
                )}

                {facitMode === 'ai_generated' && (
                  <Field
                    label="Vad handlar provet om?"
                    hint="Beskriv ämne, årskurs och centrala begrepp så att AI:n kan skapa ett rimligt facit."
                  >
                    <textarea
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      className="input min-h-[80px]"
                      placeholder="Geografi åk 6: Sveriges storstäder, kommuner och riksdagspartier"
                    />
                  </Field>
                )}

                <Field
                  label="Elevidentifiering"
                  hint="Hur ska WiseOS identifiera vilken elev som skrivit varje prov? Namnfält är förvalt."
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { value: 'name_field', label: 'Namnfält', desc: 'OCR läser elevens namn', available: true },
                      { value: 'qr_code', label: 'QR-kod', desc: 'Kommer i en senare version', available: false },
                      { value: 'barcode', label: 'Streckkod', desc: 'Kommer i en senare version', available: false },
                      { value: 'student_id', label: 'Elev-ID', desc: 'Kommer i en senare version', available: false },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={!opt.available}
                        onClick={() => setIdentificationMethod(opt.value as typeof identificationMethod)}
                        className={`rounded-xl border-2 p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                          identificationMethod === opt.value
                            ? 'border-ink bg-paper'
                            : 'border-ink-hairline hover:border-ink-hairline'
                        }`}
                      >
                        <div className="text-sm font-semibold text-ink">
                          {opt.label}
                        </div>
                        <div className="text-xs text-ink-secondary mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </Field>

                {klass.students && klass.students.length > 0 && (
                  <div className="rounded-2xl border border-ink-hairline bg-paper p-4">
                    <div className="text-xs font-medium text-ink mb-2">
                      Registrerade elever i {klass.name} ({klass.students.length} st)
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {klass.students.slice(0, 8).map((s) => (
                        <span key={s.id} className="text-xs bg-paper px-2 py-1 rounded border border-ink-hairline">
                          {s.name}
                        </span>
                      ))}
                      {klass.students.length > 8 && (
                        <span className="text-xs text-ink-secondary px-2 py-1">
                          +{klass.students.length - 8} till
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-ink-hairline bg-paper-secondary p-4 text-xs text-ink-secondary leading-relaxed">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-ink mb-1">Klassens rättningsparametrar</div>
                      <div className="italic">
                        {klass.gradingParams.customRules.length > 0
                          ? klass.gradingParams.customRules.join(' • ')
                          : "Standardinställningar aktiva"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { onClose(); window.location.href = `/classes/${klass.id}?tab=params`; }}
                      className="shrink-0 text-ink underline hover:text-ink"
                    >
                      Ändra
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-ink-hairline bg-paper-raised px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-ink-secondary hover:text-ink"
          >
            Avbryt
          </button>
          {startError && <p className="flex-1 text-right text-sm text-state-danger">{startError}</p>}
          <button
            onClick={handleStart}
            disabled={
              !title.trim() ||
              (facitMode === 'uploaded' && !facit.trim()) ||
              (facitMode === 'ai_generated' && !aiDescription.trim()) ||
              files.length === 0 ||
              starting
            }
            className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40 sm:py-2.5"
          >
            <span className="inline-flex items-center gap-2">
              <LineIcon name="play" className="h-3.5 w-3.5" /> {starting ? "Skapar prov…" : "Starta rättning"}
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-ink">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-secondary leading-relaxed">{hint}</div>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
