"use client";

import { useEffect, useRef, useState } from "react";
import { actions, DEFAULT_GRADE_THRESHOLDS, deriveSubject, useStore, type Kurs } from "@/lib/store";
import LineIcon from "./LineIcon";

interface CourseComboboxProps {
  value: string;
  onSelect: (id: string, subject: string) => void;
  placeholder?: string;
}

export default function CourseCombobox({ value, onSelect, placeholder = "Sök eller skriv kursnamn..." }: CourseComboboxProps) {
  const kurser = useStore((s) => s.kurser);
  const selected = kurser.find((k) => k.id === value);

  const [inputValue, setInputValue] = useState(selected?.name || "");
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState<Kurs[]>(kurser);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(selected?.name || "");
  }, [selected]);

  useEffect(() => {
    if (!inputValue.trim()) {
      setFiltered(kurser);
      return;
    }
    const lower = inputValue.toLowerCase();
    setFiltered(
      kurser
        .filter(
          (k) =>
            k.name.toLowerCase().includes(lower) ||
            k.subject.toLowerCase().includes(lower) ||
            (k.code && k.code.toLowerCase().includes(lower))
        )
        .slice(0, 50)
    );
  }, [inputValue, kurser]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectCourse = (kurs: Kurs) => {
    setInputValue(kurs.name);
    setIsOpen(false);
    onSelect(kurs.id, kurs.subject);
  };

  const createCustomCourse = (name: string) => {
    const subject = deriveSubject(name);
    const id = name;
    const newKurs: Kurs = {
      id,
      name,
      code: "",
      subject,
      description: "",
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
    };
    actions.addKurs(newKurs);
    onSelect(id, subject);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      const exact = kurser.find(
        (k) => k.name.toLowerCase() === inputValue.trim().toLowerCase()
      );
      if (exact) {
        selectCourse(exact);
      } else if (inputValue.trim()) {
        createCustomCourse(inputValue.trim());
        setIsOpen(false);
      }
    }
  };

  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="input pr-10"
          placeholder={placeholder}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <LineIcon name="chevron-down" className="h-4 w-4 text-ink-muted" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-ink-hairline bg-paper-raised shadow-card max-h-64 overflow-auto">
          {filtered.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                if (inputValue.trim()) {
                  createCustomCourse(inputValue.trim());
                  setIsOpen(false);
                }
              }}
              className="w-full px-4 py-3 text-left text-sm hover:bg-paper-secondary transition-colors"
            >
              <span className="text-ink">Använd ”{inputValue.trim()}”</span>
              <span className="ml-2 text-ink-muted">({deriveSubject(inputValue)})</span>
            </button>
          ) : (
            filtered.map((kurs, index) => (
              <button
                key={kurs.id}
                type="button"
                onClick={() => selectCourse(kurs)}
                className={`w-full px-4 py-3 text-left hover:bg-paper-secondary transition-colors ${
                  index === 0 ? "rounded-t-xl" : ""
                } ${index === filtered.length - 1 ? "rounded-b-xl" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink">{kurs.name}</span>
                  {kurs.code && (
                    <span className="text-[11px] text-ink-muted font-mono">{kurs.code}</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-muted">
                  <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px]">{kurs.subject}</span>
                  {kurs.level && <span>· {kurs.level}</span>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
