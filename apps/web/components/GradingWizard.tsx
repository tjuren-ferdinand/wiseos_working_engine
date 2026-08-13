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
  const [maxPoints, setMaxPoints] = useState(20);
  
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
  const [studentCount, setStudentCount] = useState(5);
  const inputRef = useRef<HTMLInputElement>(null);
  const answerKeyInputRef = useRef<HTMLInputElement>(null);
  
  // Batch grading pipeline state
  const [showBatchPipeline, setShowBatchPipeline] = useState(false);
  const [createdProvId, setCreatedProvId] = useState<string | null>(null);

  const effectiveAnswerKey: AnswerKeyItem[] = useMemo(
    () =>
      answerKeyItems.length > 0
        ? answerKeyItems
        : facit
            .split(/\n{2,}/)
            .map((block, i) => ({
              question_number: String(i + 1),
              final_answer: block.trim(),
              derivation_steps: [],
            }))
            .filter((it) => it.final_answer.length > 0),
    [answerKeyItems, facit],
  );

  if (!open && !showBatchPipeline) return null;

  const reset = () => {
    setStep(1);
    setTitle("");
    setDate(new Date().toISOString().split('T')[0]);
    setMaxPoints(20);
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
    setStudentCount(5);
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
    // Skapa provet först
    const prov = actions.startProv({
      klassId: klass.id,
      title: title || "Prov utan namn",
      date,
      maxPoints,
      facitMode,
      facit: facitMode !== 'none' ? facit : undefined,
      customParams,
    });
    
    setCreatedProvId(prov.id);
    
    // Visa batch grading pipeline för hela klassen
    setShowBatchPipeline(true);
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
        customParams={customParams}
        answerKey={effectiveAnswerKey}
        files={files}
        identificationMethod={identificationMethod}
        expectedStudents={klass.students?.length || files.length}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200/60 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-8 pt-7 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-wise-600 font-semibold">Rätta nytt prov</div>
              <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{klass.name}</div>
            </div>
            <button onClick={handleClose} aria-label="Stäng" className="h-8 w-8 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <LineIcon name="x" className="h-4 w-4" />
            </button>
          </div>
          <ol className="mt-5 flex items-center gap-2 text-xs">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex items-center gap-2">
                <span
                  className={`h-6 w-6 grid place-items-center rounded-full text-[11px] font-semibold transition-all ${
                    step === n
                      ? "bg-wise-600 text-white"
                      : step > n
                      ? "bg-wise-100 text-wise-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step > n ? <LineIcon name="check" className="h-3.5 w-3.5" /> : n}
                </span>
                <span className={step === n ? "text-slate-900 font-medium" : "text-slate-500"}>
                  {facitMode === 'ai_generated'
                    ? ["Provets namn", "Ladda upp tentor", "AI-rättning"][n - 1]
                    : ["Provets namn", "Facit & parametrar", "Skanna alla elever"][n - 1]}
                </span>
                {n < 3 && <span className="text-slate-300 mx-1">→</span>}
              </li>
            ))}
          </ol>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-7">
          {step === 1 && (
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
                <Field label="Max poäng">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={maxPoints}
                    onChange={(e) => setMaxPoints(Number(e.target.value))}
                    className="input"
                  />
                </Field>
              </div>

              {/* V2: Facithantering - 3 alternativ */}
              <Field label="Facithantering" hint="Välj hur WiseOS ska hantera facit för detta prov.">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'uploaded', label: 'Ladda upp', desc: 'Jag har eget facit' },
                    { value: 'ai_generated', label: 'AI-genererat', desc: 'WiseOS skapar facit' },
                    { value: 'none', label: 'Inget facit', desc: 'Analysera utan facit' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFacitMode(opt.value as typeof facitMode)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        facitMode === opt.value
                          ? 'border-wise-500 bg-wise-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`text-sm font-semibold ${facitMode === opt.value ? 'text-wise-700' : 'text-slate-800'}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-600 leading-relaxed">
                <div className="font-medium text-slate-800 mb-1">Klassens rättningsparametrar</div>
                <div className="italic">
                  {klass.gradingParams.customRules.length > 0
                    ? klass.gradingParams.customRules.join(' • ')
                    : "Standardinställningar aktiva"}
                </div>
              </div>
            </div>
          )}

          {step === 2 && facitMode !== 'ai_generated' && (
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
                      ? "border-wise-500 bg-wise-50"
                      : "border-slate-300 bg-slate-50/50 hover:border-wise-400 hover:bg-wise-50/40"
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {answerKeyFileName || "Släpp facit.pdf här eller klicka för att välja fil"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">PDF, PNG, JPG eller WEBP. Max 10 MB.</div>
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
                  <div className="mt-2 text-sm text-slate-500">Analyserar facit och bygger strukturerad förhandsvisning...</div>
                )}
                {answerKeyError && <div className="mt-2 text-sm text-red-600">{answerKeyError}</div>}
              </Field>

              {answerKeyItems.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">Redigerbar förhandsvisning</div>
                    <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                      Justera slutsvar eller delsteg innan du går vidare.
                    </div>
                  </div>
                  {answerKeyItems.map((item, itemIndex) => (
                    <div key={`${item.question_number}-${itemIndex}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                        <label className="block">
                          <div className="text-xs font-semibold text-slate-600">Uppgift</div>
                          <input
                            value={item.question_number}
                            onChange={(e) => updateAnswerKeyItem(itemIndex, { question_number: e.target.value })}
                            className="input mt-1"
                          />
                        </label>
                        <label className="block">
                          <div className="text-xs font-semibold text-slate-600">Slutsvar</div>
                          <input
                            value={item.final_answer}
                            onChange={(e) => updateAnswerKeyItem(itemIndex, { final_answer: e.target.value })}
                            className="input mt-1 font-mono text-[13px]"
                          />
                        </label>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="text-xs font-semibold text-slate-600">Delsteg</div>
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
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
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
                  placeholder={`1) x = 3\n2) F = 24 N\n3) v = 9.8 m/s`}
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

          {step === 2 && facitMode === 'ai_generated' && (
            <AIGeneratedStep2
              files={files}
              setFiles={setFiles}
              inputRef={inputRef}
              identificationMethod={identificationMethod}
              setIdentificationMethod={setIdentificationMethod}
              studentCount={studentCount}
              setStudentCount={setStudentCount}
              klass={klass}
            />
          )}

          {step === 3 && (
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
                  className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 hover:bg-wise-50/40 hover:border-wise-300 transition-all p-10 text-center"
                >
                  <div className="mx-auto h-10 w-10 rounded-xl bg-wise-50 text-wise-600 grid place-items-center">
                    <LineIcon name="upload" className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-sm font-medium text-slate-800">
                    {files.length ? `${files.length} fil(er) valda` : "Dra in PDF eller bilder"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">PDF · PNG · JPG · max 100 MB totalt</div>
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
                          ? 'border-wise-500 bg-wise-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`text-sm font-semibold ${identificationMethod === opt.value ? 'text-wise-700' : 'text-slate-800'}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="Antal elever i bunten"
                hint="WiseOS försöker räkna automatiskt – justera vid behov."
              >
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={studentCount}
                  onChange={(e) => setStudentCount(Number(e.target.value))}
                  className="input w-32"
                />
              </Field>

              {/* V2: Elevlista från klassen */}
              {klass.students && klass.students.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-xs font-medium text-slate-800 mb-2">
                    Registrerade elever i {klass.name} ({klass.students.length} st)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {klass.students.slice(0, 8).map((s) => (
                      <span key={s.id} className="text-xs bg-white px-2 py-1 rounded border border-slate-200">
                        {s.name}
                      </span>
                    ))}
                    {klass.students.length > 8 && (
                      <span className="text-xs text-slate-500 px-2 py-1">
                        +{klass.students.length - 8} till
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="px-8 py-5 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => (step === 1 ? handleClose() : setStep((s) => (s - 1) as Step))}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            {step === 1 ? "Avbryt" : "← Tillbaka"}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={step === 1 ? !title.trim() : (facitMode === 'ai_generated' ? files.length === 0 : !facit.trim())}
              className="rounded-full bg-slate-900 text-white px-6 py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Nästa
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={files.length === 0}
              className="rounded-full bg-wise-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-wise-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-wise-600/20"
            >
              <span className="inline-flex items-center gap-2"><LineIcon name="play" className="h-3.5 w-3.5" /> Starta rättning</span>
            </button>
          )}
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
  studentCount,
  setStudentCount,
  klass,
}: {
  files: File[];
  setFiles: (files: File[]) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  identificationMethod: 'name_field' | 'qr_code' | 'barcode' | 'student_id';
  setIdentificationMethod: (method: 'name_field' | 'qr_code' | 'barcode' | 'student_id') => void;
  studentCount: number;
  setStudentCount: (count: number) => void;
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
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-wise-100 to-purple-100 text-wise-700 text-sm font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-wise-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-wise-500"></span>
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
        className={`relative cursor-pointer rounded-3xl border-2 border-dashed transition-all overflow-hidden ${
          dragOver
            ? "border-wise-500 bg-wise-50 scale-[1.01]"
            : files.length > 0
            ? "border-wise-400 bg-wise-50/50"
            : "border-slate-300 bg-gradient-to-b from-slate-50 to-white hover:border-wise-400 hover:bg-wise-50/30"
        }`}
      >
        {files.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-wise-100 to-purple-100 text-wise-600 grid place-items-center shadow-lg shadow-wise-200/50">
              <LineIcon name="upload" className="h-7 w-7" />
            </div>
            <div className="mt-5 text-lg font-semibold text-slate-900">
              Ladda upp inskannade tentor
            </div>
            <div className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
              Dra in PDF:en med alla elevers prov, eller klicka för att välja filer. WiseOS sektionerar och analyserar automatiskt.
            </div>
            <div className="mt-4 flex items-center justify-center gap-3 text-xs text-slate-400">
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
                      className="h-16 w-12 rounded-lg border-2 border-white shadow-md overflow-hidden bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))
                ) : (
                  [0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-16 w-12 rounded-lg border-2 border-white shadow-md bg-gradient-to-br from-slate-100 to-slate-200 grid place-items-center"
                    >
                      <LineIcon name="file" className="h-5 w-5 text-slate-400" />
                    </div>
                  ))
                )}
                {files.length > 3 && (
                  <div className="h-16 w-12 rounded-lg border-2 border-white shadow-md bg-slate-800 text-white grid place-items-center text-xs font-bold">
                    +{files.length - 3}
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <LineIcon name="check" className="h-5 w-5 text-emerald-500" />
                  <span className="text-base font-semibold text-slate-900">
                    {files.length} fil{files.length !== 1 ? 'er' : ''} uppladdade
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-500">
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
                  className="mt-2 text-xs text-wise-600 hover:text-wise-700 font-medium"
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
        <div className="text-sm font-medium text-slate-800 mb-1">Elevidentifiering</div>
        <div className="text-xs text-slate-500 mb-3">Hur ska WiseOS identifiera vilken elev som skrivit varje prov?</div>
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
                  ? 'border-wise-500 bg-wise-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${
                identificationMethod === opt.value ? 'bg-wise-200 text-wise-700' : 'bg-slate-100 text-slate-500'
              }`}>
                <LineIcon name={opt.icon} className="h-4 w-4" />
              </div>
              <div>
                <div className={`text-sm font-semibold ${identificationMethod === opt.value ? 'text-wise-700' : 'text-slate-800'}`}>
                  {opt.label}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Student count */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-800">Antal elever</div>
          <div className="text-xs text-slate-500">WiseOS räknar automatiskt – justera vid behov</div>
        </div>
        <input
          type="number"
          min={1}
          max={40}
          value={studentCount}
          onChange={(e) => setStudentCount(Number(e.target.value))}
          className="input w-24 text-center text-lg font-semibold"
        />
      </div>

      {/* Class students preview */}
      {klass.students && klass.students.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-800 mb-3">
            <LineIcon name="users" className="h-4 w-4 text-slate-500" />
            Registrerade elever i {klass.name}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {klass.students.slice(0, 10).map((s) => (
              <span key={s.id} className="text-xs bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                {s.name}
              </span>
            ))}
            {klass.students.length > 10 && (
              <span className="text-xs text-slate-500 px-2.5 py-1.5">
                +{klass.students.length - 10} till
              </span>
            )}
          </div>
        </div>
      )}

      {/* AI process preview */}
      {files.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-wise-400 to-purple-500 grid place-items-center">
              <LineIcon name="play" className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">AI-pipeline redo</div>
              <div className="text-xs text-white/60">Följande steg körs automatiskt</div>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { step: '1', label: 'Sektionera per elev', desc: 'OCR + siduppdelning' },
              { step: '2', label: 'Generera facit', desc: 'Claude analyserar uppgifterna' },
              { step: '3', label: 'Rätta varje svar', desc: 'Jämför med AI-facit' },
              { step: '4', label: 'Beräkna poäng', desc: 'Enligt klassens regler' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="h-6 w-6 rounded-full bg-white/10 text-white/80 grid place-items-center text-xs font-bold">
                  {item.step}
                </div>
                <div className="flex-1">
                  <span className="text-white/90">{item.label}</span>
                  <span className="text-white/40 ml-2">– {item.desc}</span>
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
      <div className="text-sm font-medium text-slate-800">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{hint}</div>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
