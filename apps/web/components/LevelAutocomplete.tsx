"use client";

import { useState, useRef, useEffect } from "react";
import LineIcon from "./LineIcon";

interface LevelAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SUGGESTIONS = [
  "Åk 7",
  "Åk 8", 
  "Åk 9",
  "Gymnasiet åk 1",
  "Gymnasiet åk 2",
  "Gymnasiet åk 3",
  "Komvux",
  "Högskola – Grundnivå",
  "Högskola – Avancerad",
  "Yrkesutbildning",
  "Övrigt"
];

export default function LevelAutocomplete({ value, onChange, placeholder = "Ange nivå..." }: LevelAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      const filtered = SUGGESTIONS.filter(suggestion =>
        suggestion.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions(SUGGESTIONS);
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
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

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="input pr-10"
          placeholder={placeholder}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <LineIcon name="chevron-down" className="h-4 w-4 text-ink-muted" />
        </div>
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-paper-raised border border-ink-hairline rounded-xl shadow-lg max-h-60 overflow-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-paper-secondary transition-colors ${
                index === 0 ? "rounded-t-xl" : ""
              } ${index === filteredSuggestions.length - 1 ? "rounded-b-xl" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-ink">{suggestion}</span>
                {suggestion === value && (
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
