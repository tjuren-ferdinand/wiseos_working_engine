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
  const [facitMode, setFacitMode] = useState<'uploaded' | 'ai_generated' | 'none'>('uploaded');
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
  const answerKeyInputRef = useRef<HTMLInputElement>(null);
  
  // Batch grading pipeline state
  const [showBatchPipeline, setShowBatchPipeline] = useState(false);
  const [createdProvId, setCreatedProvId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

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
    setFacitMode('uploaded');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper backdrop-blur-sm" onClick={handleClose}>
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-paper-raised shadow-card border border-ink-hairline max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-8 pt-7 pb-4 border-b border-ink-hairline">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.08em] text-ink-secondary font-semibold">Rätta nytt prov</div>
              <div className="mt-1 text-xl font-semibold tracking-tight text-ink">{klass.name}</div>
              <div className="mt-1 text-xs font-medium text-ink-muted tracking-wide uppercase">{(klass as any).code || klass.name}</div>
            </div>
            <button onClick={handleClose} aria-label="Stäng" className="h-8 w-8 grid place-items-center rounded-full text-ink-muted hover:bg-paper hover:text-ink">
              <LineIcon name="x" className="h-4 w-4" />
            </button>
          </div>
          
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-7">
          {true && (
            <div className="space-y-5">
              <Field label="Provets namn">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="t.ex. Prov 2 · Mekanik – Kraft & rörelse"
                  autoFocus
                />
              </Field>
              
              <div className="grid grid-cols-2 gap-4">
                <Field label="Provdatum">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>

              {/* V2: Facithantering - 3 alternativ */}
              <Field label="Facithantering" hint="Välj hur WiseOS ska hantera facit för detta prov.">
                <div className="grid grid-cols-2 gap-2">
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
                          ? 'border-accent bg-paper'
                          : 'border-ink-hairline hover:border-ink-hairline'
                      }`}
                    >
                      <div className={`text-sm font-semibold ${facitMode === opt.value ? 'text-ink' : 'text-ink'}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-ink-secondary mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="rounded-2xl border border-ink-hairline bg-paper p-4 text-xs text-ink-secondary leading-relaxed">
                <div className="font-medium text-ink mb-1">Klassens rättningsparametrar</div>
                <div className="italic">
                  {klass.gradingParams.customRules.length > 0
                    ? klass.gradingParams.customRules.join(' • ')
                    : "Standardinställningar aktiva"}
                </div>
              </div>
            </div>
          )}

          {true && facitMode === 'uploaded' && (
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
                      ? "border-accent bg-paper"
                      : "border-ink-hairline bg-paper hover:border-ink-hairline hover:bg-paper"
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

          {true && facitMode === 'ai_generated' && (
            <div className="space-y-5">
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
              <AIGeneratedStep2
                files={files}
                setFiles={setFiles}
                inputRef={inputRef}
                identificationMethod={identificationMethod}
                setIdentificationMethod={setIdentificationMethod}
                klass={klass}
              />
            </div>
          )}

          {true && (
            <div className="space-y-5">
              <Field
                label="Skannad provbunt"
                hint="Dra in den sammanslagna PDF:en eller alla bilder från hela klassens prov. WiseOS sektionerar automatiskt per elev."
              >
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    setFiles(Array.from(e.dataTransfer.files));
                  }}
                  className="cursor-pointer rounded-2xl border-2 border-dashed border-ink-hairline bg-paper hover:bg-paper hover:border-ink-hairline transition-all p-10 text-center"
                >
                  <div className="mx-auto h-10 w-10 rounded-xl bg-paper text-ink-secondary grid place-items-center">
                    <LineIcon name="upload" className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-sm font-medium text-ink">
                    {files.length ? `${files.length} fil(er) valda` : "Dra in PDF eller bilder"}
                  </div>
                  <div className="mt-1 text-xs text-ink-secondary">PDF · PNG · JPG · max 100 MB totalt</div>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                </div>
              </Field>

              {/* V2: Elevidentifiering */}
              <Field
                label="Elevidentifiering"
                hint="Hur ska WiseOS identifiera vilken elev som skrivit varje prov?"
              >
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'name_field', label: 'Namnfält', desc: 'OCR läser elevens namn' },
                    { value: 'qr_code', label: 'QR-kod', desc: 'Förtryckt QR per elev' },
                    { value: 'barcode', label: 'Streckkod', desc: 'Förtryckt streckkod' },
                    { value: 'student_id', label: 'Elev-ID', desc: 'Skrivet elev-ID' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIdentificationMethod(opt.value as typeof identificationMethod)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        identificationMethod === opt.value
                          ? 'border-accent bg-paper'
                          : 'border-ink-hairline hover:border-ink-hairline'
                      }`}
                    >
                      <div className={`text-sm font-semibold ${identificationMethod === opt.value ? 'text-ink' : 'text-ink'}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-ink-secondary mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>

              {/* V2: Elevlista från klassen */}
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
            </div>
          )}
        </div>

                <footer className="px-8 py-5 border-t border-ink-hairline flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-ink-secondary hover:text-ink"
          >
            Avbryt
          </button>
          {startError && <p className="text-sm text-state-danger flex-1 text-right">{startError}</p>}
          <button
            onClick={handleStart}
            disabled={
              !title.trim() ||
              (facitMode === 'uploaded' && !facit.trim()) ||
              files.length === 0 ||
              starting
            }
            className="rounded-full bg-accent text-ink px-6 py-2.5 text-sm font-semibold hover:bg-accent/85 disabled:opacity-40 disabled:cursor-not-allowed"
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

function AIGeneratedStep2({
  files,
  setFiles,
  inputRef,
  identificationMethod,
  setIdentificationMethod,
  klass,
}: {
  files: File[];
  setFiles: (files: File[]) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  identificationMethod: 'name_field' | 'qr_code' | 'barcode' | 'student_id';
  setIdentificationMethod: (method: 'name_field' | 'qr_code' | 'barcode' | 'student_id') => void;
  klass: Klass;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string[]>([]);

  const handleFiles = (newFiles: File[]) => {
    setFiles(newFiles);
    // Generate previews for images
    const previews: string[] = [];
    newFiles.slice(0, 4).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          previews.push(reader.result as string);
          setUploadedPreview([...previews]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Hero upload area */}
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-paper text-ink text-sm font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          AI-läge aktivt – WiseOS genererar facit automatiskt
        </div>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(Array.from(e.dataTransfer.files));
        }}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
          dragOver
            ? "border-accent bg-paper scale-[1.01]"
            : files.length > 0
            ? "border-ink-hairline bg-paper"
            : "border-ink-hairline bg-paper hover:border-ink-hairline hover:bg-paper"
        }`}
      >
        {files.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-paper text-ink-secondary grid place-items-center shadow-lg shadow-soft">
              <LineIcon name="upload" className="h-7 w-7" />
            </div>
            <div className="mt-5 text-lg font-semibold text-ink">
              Ladda upp inskannade tentor
            </div>
            <div className="mt-2 text-sm text-ink-secondary max-w-sm mx-auto">
              Dra in PDF:en med alla elevers prov, eller klicka för att välja filer. WiseOS sektionerar och analyserar automatiskt.
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
        ) : (
          <div className="p-6">
            <div className="flex items-start gap-4">
              {/* File preview thumbnails */}
              <div className="flex -space-x-3">
                {uploadedPreview.length > 0 ? (
                  uploadedPreview.slice(0, 3).map((src, i) => (
                    <div
                      key={i}
                      className="h-16 w-12 rounded-lg border-2 border-paper-secondary shadow-md overflow-hidden bg-paper"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))
                ) : (
                  [0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-16 w-12 rounded-lg border-2 border-paper-secondary shadow-md bg-gradient-to-br from-paper-secondary to-paper-secondary grid place-items-center"
                    >
                      <LineIcon name="file" className="h-5 w-5 text-ink-muted" />
                    </div>
                  ))
                )}
                {files.length > 3 && (
                  <div className="h-16 w-12 rounded-lg border-2 border-paper-secondary shadow-md bg-paper text-ink grid place-items-center text-xs font-bold">
                    +{files.length - 3}
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <LineIcon name="check" className="h-5 w-5 text-state-success" />
                  <span className="text-base font-semibold text-ink">
                    {files.length} fil{files.length !== 1 ? 'er' : ''}
                  </span>
                </div>
                <div className="mt-1 text-sm text-ink-secondary">
                  {files.map(f => f.name).slice(0, 2).join(', ')}
                  {files.length > 2 && ` och ${files.length - 2} till...`}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFiles([]);
                    setUploadedPreview([]);
                  }}
                  className="mt-2 text-xs text-ink-secondary hover:text-ink font-medium"
                >
                  Byt filer
                </button>
              </div>
            </div>
          </div>
        )}
        
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => handleFiles(Array.from(e.target.files || []))}
        />
      </div>

      {/* Identification method */}
      <div>
        <div className="text-sm font-medium text-ink mb-1">Elevidentifiering</div>
        <div className="text-xs text-ink-secondary mb-3">Hur ska WiseOS identifiera vilken elev som skrivit varje prov?</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'name_field', label: 'Namnfält', desc: 'OCR läser elevens namn', icon: 'users' as const },
            { value: 'qr_code', label: 'QR-kod', desc: 'Förtryckt QR per elev', icon: 'grid' as const },
            { value: 'barcode', label: 'Streckkod', desc: 'Förtryckt streckkod', icon: 'menu' as const },
            { value: 'student_id', label: 'Elev-ID', desc: 'Skrivet elev-ID', icon: 'edit' as const },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setIdentificationMethod(opt.value as typeof identificationMethod)}
              className={`rounded-xl border-2 p-3 text-left transition-all flex items-start gap-3 ${
                identificationMethod === opt.value
                  ? 'border-accent bg-paper-secondary'
                  : 'border-ink-hairline hover:border-ink-hairline'
              }`}
            >
              <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${
                identificationMethod === opt.value ? 'bg-paper-secondary text-ink' : 'bg-paper-secondary text-ink-secondary'
              }`}>
                <LineIcon name={opt.icon} className="h-4 w-4" />
              </div>
              <div>
                <div className={`text-sm font-semibold ${identificationMethod === opt.value ? 'text-ink' : 'text-ink'}`}>
                  {opt.label}
                </div>
                <div className="text-xs text-ink-secondary mt-0.5">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Class students preview */}
      {klass.students && klass.students.length > 0 && (
        <div className="rounded-2xl border border-ink-hairline bg-paper-secondary p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-ink mb-3">
            <LineIcon name="users" className="h-4 w-4 text-ink-secondary" />
            Registrerade elever i {klass.name}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {klass.students.slice(0, 10).map((s) => (
              <span key={s.id} className="text-xs bg-paper-secondary px-2.5 py-1.5 rounded-lg border border-ink-hairline">
                {s.name}
              </span>
            ))}
            {klass.students.length > 10 && (
              <span className="text-xs text-ink-secondary px-2.5 py-1.5">
                +{klass.students.length - 10} till
              </span>
            )}
          </div>
        </div>
      )}

      {/* AI process preview */}
      {files.length > 0 && (
        <div className="rounded-2xl bg-accent p-5 text-ink">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-paper-raised text-ink grid place-items-center">
              <LineIcon name="play" className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-ink">AI-pipeline redo</div>
              <div className="text-xs text-ink/60">Följande steg körs automatiskt</div>
            </div>
          </div>
          <div className="space-y-1">
            {[
              { step: '1', label: 'Sektionera per elev', desc: 'OCR + siduppdelning' },
              { step: '2', label: 'Generera facit', desc: 'Claude analyserar uppgifterna' },
              { step: '3', label: 'Rätta varje svar', desc: 'Jämför med AI-facit' },
              { step: '4', label: 'Beräkna poäng', desc: 'Enligt klassens regler' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm py-1.5">
                <div className="h-6 w-6 shrink-0 rounded-full bg-paper-raised text-ink grid place-items-center text-xs font-bold">
                  {item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-ink font-medium">{item.label}</span>
                  <span className="text-ink/50 ml-2">– {item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
