"use client";

import { useState, useRef, useEffect } from "react";
import LineIcon from "./LineIcon";

interface LevelAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SUGGESTIONS = [
  "Åk 4–6",
  "Åk 7–9",
  "Gymnasiet åk 1",
  "Gymnasiet åk 2",
  "Gymnasiet åk 3",
  "Komvux",
  "Högskola – Grundnivå",
  "Högskola – Avancerad",
  "Yrkesutbildning",
  "Annan",
];

export default function LevelAutocomplete({ value, onChange, placeholder = "Ange nivå..." }: LevelAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [filtered, setFiltered] = useState<string[]>(SUGGESTIONS);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(SUGGESTIONS);
      return;
    }
    const lower = query.toLowerCase();
    setFiltered(SUGGESTIONS.filter((s) => s.toLowerCase().includes(lower)));
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onChange(e.target.value);
    setIsOpen(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setQuery(suggestion);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      setIsOpen(false);
    }
  };

  const showAll = () => {
    setFiltered(SUGGESTIONS);
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={showAll}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="input pr-10"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => {
            showAll();
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-muted hover:text-ink"
          aria-label="Visa alla nivåer"
        >
          <LineIcon name="chevron-down" className="h-4 w-4" />
        </button>
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-paper-raised border border-ink-hairline rounded-xl shadow-lg max-h-60 overflow-auto">
          {filtered.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-paper-secondary transition-colors ${
                index === 0 ? "rounded-t-xl" : ""
              } ${index === filtered.length - 1 ? "rounded-b-xl" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-ink">{suggestion}</span>
                {suggestion === query && (
                  <LineIcon name="check" className="h-4 w-4 text-ink-secondary" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
