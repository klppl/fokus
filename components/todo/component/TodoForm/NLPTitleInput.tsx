// NLPTitleInput + NLPProjectDropdown (keyboard autocomplete)
// Paste into a single file or split as you prefer.

import { getCaretOffset } from "@/components/todo/lib/getCaretOffset";
import { setCaretOffset } from "@/components/todo/lib/setCaretOffset";
import { cn } from "@/lib/utils";
import { NonNullableDateRange } from "@/types";
import * as chrono from "chrono-node";
import { addHours } from "date-fns";
import React, { SetStateAction, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useTranslations, useMessages } from "next-intl";
import { useLocale } from "next-intl";
import { useProjectMetaData } from "@/components/Sidebar/Project/query/get-project-meta";
import { ProjectAutoComplete } from "./ProjectAutoComplete";

// Locales not natively supported by chrono-node
const CHRONO_UNSUPPORTED = ["sv", "ms", "ar"];

// --------------------------- NLPTitleInput ---------------------------

type NLPTitleInputProps = {
  titleRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  setTitle: React.Dispatch<SetStateAction<string>>;
  setDateRange: React.Dispatch<SetStateAction<NonNullableDateRange>>;
  setProjectID: React.Dispatch<SetStateAction<string | null>>;
  className?: string;
};

/**
 * NLP-assisted title input with Chrono highlighting and project dropdown.
 *
 * Keyboard features:
 * - Tab: selects the current/top result when dropdown is visible
 * - ArrowUp / ArrowDown: move selection in dropdown
 * - Enter: select highlighted result
 * - Escape: close dropdown
 */
export default function NLPTitleInput({
  titleRef,
  title,
  setTitle,
  setDateRange,
  setProjectID,
  className,
}: NLPTitleInputProps) {
  const locale = useLocale();
  const todayDict = useTranslations("today");
  const messages = useMessages();
  const isComposing = useRef(false);

  // Build sorted keyword replacement pairs (longest first to avoid partial matches)
  const nlpKeywords = useMemo(() => {
    if (!CHRONO_UNSUPPORTED.includes(locale)) return null;
    const raw = (messages as Record<string, unknown>).nlpDateKeywords as
      | Record<string, string>
      | undefined;
    if (!raw) return null;
    return Object.entries(raw).sort(
      ([a], [b]) => b.length - a.length,
    );
  }, [locale, messages]);

  // Replace locale keywords with English equivalents, tracking index shifts
  const replaceKeywords = useCallback(
    (text: string): { translated: string; indexMap: (idx: number) => number } => {
      if (!nlpKeywords) return { translated: text, indexMap: (i) => i };

      const lowerText = text.toLowerCase();
      // Track replacements as [origStart, origEnd, replacement]
      const replacements: [number, number, string][] = [];

      for (const [keyword, english] of nlpKeywords) {
        let searchFrom = 0;
        while (true) {
          const idx = lowerText.indexOf(keyword, searchFrom);
          if (idx === -1) break;
          // Check not overlapping with an existing replacement
          const overlaps = replacements.some(
            ([s, e]) => idx < e && idx + keyword.length > s,
          );
          if (!overlaps) {
            replacements.push([idx, idx + keyword.length, english]);
          }
          searchFrom = idx + 1;
        }
      }

      if (!replacements.length) return { translated: text, indexMap: (i) => i };

      replacements.sort((a, b) => a[0] - b[0]);

      // Build translated string and offset map
      let translated = "";
      let origPos = 0;
      // Store cumulative shift at each replacement boundary
      const shifts: { origEnd: number; delta: number }[] = [];
      let cumDelta = 0;

      for (const [start, end, replacement] of replacements) {
        translated += text.slice(origPos, start) + replacement;
        cumDelta += replacement.length - (end - start);
        shifts.push({ origEnd: end, delta: cumDelta });
        origPos = end;
      }
      translated += text.slice(origPos);

      // Map a translated-string index back to original-string index
      const indexMap = (translatedIdx: number): number => {
        let delta = 0;
        for (const s of shifts) {
          if (translatedIdx >= s.origEnd + s.delta - delta) {
            delta = s.delta;
          } else {
            break;
          }
        }
        return translatedIdx - delta;
      };

      return { translated, indexMap };
    },
    [nlpKeywords],
  );

  // --- Dropdown state ---
  const [projectDropdownVisible, setProjectDropdownVisible] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [dropdownCoords, setDropdownCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { projectMetaData } = useProjectMetaData();

  // compute filtered projects here so parent knows the list length
  const filteredProjects = useMemo(() => {
    const entries = Object.entries(projectMetaData || {});
    if (!projectQuery.trim()) return entries;
    const lowerQuery = projectQuery.toLowerCase();
    return entries.filter(([, value]) => value.name.toLowerCase().includes(lowerQuery));
  }, [projectMetaData, projectQuery]);

  // Initialize contentEditable
  useEffect(() => {
    const node = titleRef.current;
    if (node && !node.textContent) {
      node.textContent = title;
      moveCursorToEnd(node);
    }
  }, [title, titleRef]);

  // --- Helpers ---

  const parseDate = (text: string): { results: chrono.ParsedResult[]; originalIndex: (i: number) => number } => {
    // For chrono-unsupported locales, translate keywords first
    if (CHRONO_UNSUPPORTED.includes(locale)) {
      const { translated, indexMap } = replaceKeywords(text);
      const results = chrono.en.parse(translated);
      return { results, originalIndex: indexMap };
    }

    const identity = (i: number) => i;
    switch (locale) {
      case "ja":
        return { results: chrono.ja.parse(text), originalIndex: identity };
      case "fr":
        return { results: chrono.fr.parse(text), originalIndex: identity };
      case "ru":
        return { results: chrono.ru.parse(text), originalIndex: identity };
      case "es":
        return { results: chrono.es.parse(text), originalIndex: identity };
      case "it":
        return { results: chrono.it.parse(text), originalIndex: identity };
      case "de":
        return { results: chrono.de.parse(text), originalIndex: identity };
      case "pt":
        return { results: chrono.pt.parse(text), originalIndex: identity };
      case "zh":
        return { results: chrono.zh.parse(text), originalIndex: identity };
      default:
        return { results: chrono.en.parse(text), originalIndex: identity };
    }
  };

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // ---------------- HIGHLIGHTERS ----------------

  const highlightProjectsInHtml = (baseText: string) => {
    if (!projectMetaData) return { html: baseText, cleanText: baseText };

    const names = Object.values(projectMetaData).map((p) => p.name);
    if (!names.length) return { html: baseText, cleanText: baseText };

    const regex = new RegExp(`(#(${names.map((n) => escapeRegExp(n)).join("|")}))(?=\\s|$)`, "g");

    const container = document.createElement("div");
    container.textContent = baseText;

    const walker = (node: Node) => {
      const childNodes = Array.from(node.childNodes);
      childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent || "";
          let lastIndex = 0;
          let match: RegExpExecArray | null = null;
          const frag = document.createDocumentFragment();
          regex.lastIndex = 0;

          while ((match = regex.exec(text)) !== null) {
            const mIndex = match.index;
            if (mIndex > lastIndex) {
              frag.appendChild(document.createTextNode(text.slice(lastIndex, mIndex)));
            }
            const span = document.createElement("span");
            span.className = "bg-nlp inline rounded-[2px]";
            span.setAttribute("data-project", "");
            span.textContent = match[0];
            frag.appendChild(span);
            lastIndex = mIndex + match[0].length;
          }

          if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
          }

          if (
            frag.childNodes.length &&
            (frag.childNodes.length !== 1 || frag.firstChild?.textContent !== text)
          ) {
            child.parentNode?.replaceChild(frag, child);
          }

          regex.lastIndex = 0;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          if (el.getAttribute("data-project") == null) {
            walker(child);
          }
        }
      });
    };

    walker(container);
    return { html: container.innerHTML, cleanText: baseText };
  };

  const highlightDatesInHtml = (baseHtml: string, parsed: chrono.ParsedResult) => {
    const index = parsed.index as number;
    const matchedText = parsed.text as string;

    const container = document.createElement("div");
    container.innerHTML = baseHtml;

    let offset = 0;
    let done = false;

    const walker = (node: Node) => {
      if (done) return;
      const childNodes = Array.from(node.childNodes);

      for (const child of childNodes) {
        if (done) break;

        if (child.nodeType === Node.TEXT_NODE) {
          const txt = child.textContent ?? "";
          const nodeStart = offset;
          const nodeEnd = offset + txt.length;

          const matchStart = index;
          const matchEnd = index + matchedText.length;

          if (nodeEnd <= matchStart || nodeStart >= matchEnd) {
            offset += txt.length;
            continue;
          }

          const localStart = Math.max(0, matchStart - nodeStart);
          const localEnd = Math.min(txt.length, matchEnd - nodeStart);

          const frag = document.createDocumentFragment();
          if (localStart > 0) frag.appendChild(document.createTextNode(txt.slice(0, localStart)));

          const span = document.createElement("span");
          span.className = "bg-nlp inline rounded-[2px]";
          span.textContent = txt.slice(localStart, localEnd);
          frag.appendChild(span);

          if (localEnd < txt.length) frag.appendChild(document.createTextNode(txt.slice(localEnd)));

          child.parentNode?.replaceChild(frag, child);
          offset += txt.length;
          done = true;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          if (el.getAttribute("data-project") != null) {
            offset += el.textContent?.length ?? 0;
          } else {
            walker(child);
          }
        }
      }
    };

    walker(container);

    return { html: container.innerHTML, matchedText };
  };

  const stripProjectsFromText = (text: string) => {
    if (!projectMetaData) return text;

    const names = Object.values(projectMetaData).map((p) => p.name);
    if (!names.length) return text;

    const regex = new RegExp(`\\s*#(${names.map((n) => escapeRegExp(n)).join("|")})(?=\\s|$)`, "g");
    return text.replace(regex, "").replace(/\s{2,}/g, " ").trim();
  };


  const applyNLPHighlighting = (text: string) => {
    // project first (html only)
    const projectRes = highlightProjectsInHtml(text);
    let html = projectRes.html;

    let cleanTitle = text;

    // chrono
    const { results: parsedResults, originalIndex } = parseDate(text);
    if (parsedResults.length) {
      const parsed = parsedResults[0];

      // Map chrono index back to original text position for unsupported locales
      const origIdx = originalIndex(parsed.index as number);
      const origEnd = originalIndex((parsed.index as number) + (parsed.text as string).length);
      const origMatchLen = origEnd - origIdx;
      const origMatchText = text.slice(origIdx, origEnd);

      // Create a virtual ParsedResult with original-text coordinates for highlighting
      const highlightParsed = {
        ...parsed,
        index: origIdx,
        text: origMatchText,
      } as chrono.ParsedResult;

      const dateWrapRes = highlightDatesInHtml(html, highlightParsed);
      html = dateWrapRes.html;

      cleanTitle = text.slice(0, origIdx) + text.slice(origIdx + origMatchLen);

      const from = parsed.start.date();
      const to = parsed.end?.date() ?? addHours(from, 3);
      setDateRange({ from, to });
    }

    //  strip project tokens from clean title
    cleanTitle = stripProjectsFromText(cleanTitle);

    return { html, cleanTitle };
  };


  // ---------------- INPUT HANDLERS ----------------

  const handleNLPInput = () => {
    if (isComposing.current) return;

    const node = titleRef.current;
    if (!node) return;

    const caret = getCaretOffset(node);
    const fullText = node.textContent ?? "";

    const { html, cleanTitle } = applyNLPHighlighting(fullText);

    node.innerHTML = html;
    setTitle(cleanTitle);
    setCaretOffset(node, caret);
  };

  const handleProjectInput = () => {
    if (isComposing.current) return;
    const node = titleRef.current;
    if (!node) return;
    const container = titleRef.current?.parentElement;
    if (!container) return;

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      setProjectDropdownVisible(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const anchorNode: Node | null = range.startContainer;

    //  If caret is inside a project span, do nothing
    if (anchorNode) {
      const el =
        anchorNode.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as HTMLElement)
          : anchorNode.parentElement;

      if (el?.closest?.("[data-project]")) {
        setProjectDropdownVisible(false);
        return;
      }
    }

    const caret = getCaretOffset(node);
    const text = node.textContent ?? "";

    const beforeCaret = text.slice(0, caret);
    const hashIndex = beforeCaret.lastIndexOf("#");

    if (hashIndex >= 0 && (hashIndex === 0 || /\s/.test(beforeCaret[hashIndex - 1]))) {
      const query = beforeCaret.slice(hashIndex + 1);

      //  If user already finished token (space typed), don't reopen
      if (query.includes(" ")) {
        setProjectDropdownVisible(false);
        return;
      }

      const rangeForRect = range.cloneRange();
      rangeForRect.collapse(true);
      const rect = rangeForRect.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const x = rect.left - containerRect.left;
      const y = rect.bottom - containerRect.top;

      setProjectQuery(query);
      setDropdownCoords({ x, y });
      setProjectDropdownVisible(true);
      setSelectedIndex(0);
    } else {
      setProjectDropdownVisible(false);
    }
  };


  // ---------------- INSERT PROJECT ----------------

  const wrapProjectSpan = (name: string) =>
    `<span class="bg-nlp inline rounded-[2px]" data-project>#${name}</span>`;

  const insertProjectToken = (project: { id: string; name: string }) => {
    const node = titleRef.current;
    if (!node) return;

    const caret = getCaretOffset(node);
    const text = node.textContent ?? "";
    const beforeCaret = text.slice(0, caret);
    const hashIndex = beforeCaret.lastIndexOf("#");
    if (hashIndex < 0) return;

    const before = beforeCaret.slice(0, hashIndex);
    const after = text.slice(caret);

    const rawHtml = before + wrapProjectSpan(project.name) + "&nbsp;" + after;

    // insert project
    node.innerHTML = rawHtml;

    // re-run NLP so chrono highlight is restored
    const fullText = node.textContent ?? "";
    const caretAfterInsert = before.length + project.name.length + 2;
    const { html, cleanTitle } = applyNLPHighlighting(fullText);

    node.innerHTML = html;
    setTitle(cleanTitle);

    setProjectDropdownVisible(false);
    setProjectID?.(project.id);

    requestAnimationFrame(() => {
      setCaretOffset(node, caretAfterInsert);
    });
  };


  // ---------------- KEYBOARD ----------------

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isComposing.current) return;
    if (!projectDropdownVisible) return;

    const len = filteredProjects.length;
    if (!len) return;

    switch (e.key) {
      case "Tab":
        e.preventDefault();
        insertProjectToken({
          id: filteredProjects[selectedIndex][0],
          name: filteredProjects[selectedIndex][1].name,
        });
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((s) => (s + 1) % len);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((s) => (s - 1 + len) % len);
        break;
      case "Enter":
        e.preventDefault();
        insertProjectToken({
          id: filteredProjects[selectedIndex][0],
          name: filteredProjects[selectedIndex][1].name,
        });
        break;
      case "Escape":
        e.preventDefault();
        setProjectDropdownVisible(false);
        break;
    }
  };

  // ---------------- RENDER ----------------

  return (
    <div className={cn("relative text-[1.1rem] font-semibold", className)}>
      <div
        contentEditable
        suppressContentEditableWarning
        onCompositionStart={() => (isComposing.current = true)}
        onCompositionEnd={() => (isComposing.current = false)}
        onInput={() => {
          handleNLPInput();
          handleProjectInput();
        }}
        onKeyDown={onKeyDown}
        ref={titleRef}
        className="z-50 focus:outline-hidden"
        role="textbox"
        aria-multiline="true"
      />

      {!title.length && !(titleRef.current?.textContent ?? "").length && (
        <span className="select-none pointer-events-none z-10 absolute top-0 left-2">
          {todayDict("titlePlaceholder")}
        </span>
      )}

      {projectDropdownVisible && (
        <ProjectAutoComplete
          projects={filteredProjects}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          style={{
            position: "absolute",
            top: dropdownCoords.y,
            left: dropdownCoords.x,
          }}
          onSelect={(p) => insertProjectToken(p)}
        />
      )}
    </div>
  );
}

// Move caret to the end of contentEditable
function moveCursorToEnd(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
