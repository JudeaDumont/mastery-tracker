import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react'
import type { NodeId, RootAccent, RootId } from '../model'
import { useMastery } from '../store'
import { currentLevelProgressFor, levelFor } from '../xp'

interface NodeSearchProps {
  onSelect: (nodeId: NodeId, rootId: RootId) => void
}

interface SearchResult {
  id: NodeId
  rootId: RootId
  title: string
  rootTitle: string
  root: boolean
  accent: RootAccent
  momentum: number
  level: number
  maxLevel: number
  progress: number
}

const SEARCH_RESULT_LIMIT = 40
const SEARCH_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true
})

export function NodeSearch({ onSelect }: NodeSearchProps): ReactElement {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([])

  const searchableNodes = useMemo<SearchResult[]>(() => {
    const rootResults = roots.map((root): SearchResult => {
      const rootSkills = skills.filter((skill) => skill.rootId === root.id)
      const level = Math.min(
        10,
        rootSkills.reduce((sum, skill) => sum + levelFor(skill), 0)
      )
      const momentum =
        rootSkills.length > 0
          ? Math.round(
              rootSkills.reduce((sum, skill) => sum + skill.momentum, 0) /
                rootSkills.length
            )
          : 0

      return {
        id: root.id,
        rootId: root.id,
        title: root.title,
        rootTitle: root.title,
        root: true,
        accent: root.accent ?? 'teal',
        momentum,
        level,
        maxLevel: 10,
        progress: level / 10
      }
    })

    const rootById = new Map(roots.map((root) => [root.id, root]))
    const skillResults = skills.map((skill): SearchResult => {
      const level = levelFor(skill)
      const partialLevel = currentLevelProgressFor(skill)
      const root = rootById.get(skill.rootId)

      return {
        id: skill.id,
        rootId: skill.rootId,
        title: skill.title,
        rootTitle: root?.title ?? 'Unknown root',
        root: false,
        accent: root?.accent ?? 'teal',
        momentum: skill.momentum,
        level,
        maxLevel: skill.maxLevel,
        progress:
          skill.maxLevel > 0
            ? Math.min(1, (level + partialLevel) / skill.maxLevel)
            : 0
      }
    })

    return [...rootResults, ...skillResults]
  }, [roots, skills])

  const results = useMemo<SearchResult[]>(() => {
    const normalizedQuery = normalizeSearchText(query)

    return searchableNodes
      .map((node) => ({
        node,
        matchRank: nameMatchRank(node.title, normalizedQuery)
      }))
      .filter(({ matchRank }) => Number.isFinite(matchRank))
      .sort((left, right) => {
        if (left.matchRank !== right.matchRank) return left.matchRank - right.matchRank
        if (left.node.momentum !== right.node.momentum) {
          return right.node.momentum - left.node.momentum
        }
        return SEARCH_COLLATOR.compare(left.node.title, right.node.title)
      })
      .slice(0, SEARCH_RESULT_LIMIT)
      .map(({ node }) => node)
  }, [query, searchableNodes])

  const openSearch = useCallback((): void => {
    setOpen(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [])

  const closeSearch = useCallback((): void => {
    setOpen(false)
    setActiveIndex(0)
  }, [])

  const selectResult = useCallback(
    (result: SearchResult): void => {
      onSelect(result.id, result.rootId)
      closeSearch()
    },
    [closeSearch, onSelect]
  )

  useEffect(() => {
    const onGlobalKeyDown = (event: globalThis.KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        openSearch()
        return
      }

      if (event.key === 'Escape' && open) {
        event.preventDefault()
        closeSearch()
      }
    }

    window.addEventListener('keydown', onGlobalKeyDown, true)
    return () => window.removeEventListener('keydown', onGlobalKeyDown, true)
  }, [closeSearch, open, openSearch])

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof Node && containerRef.current?.contains(target)) return
      closeSearch()
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [closeSearch, open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (results.length === 0) {
      setActiveIndex(0)
      return
    }
    setActiveIndex((current) => Math.min(current, results.length - 1))
  }, [results.length])

  useEffect(() => {
    if (!open) return
    resultRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (results.length > 0) {
        setActiveIndex((current) => (current + 1) % results.length)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length > 0) {
        setActiveIndex((current) => (current - 1 + results.length) % results.length)
      }
      return
    }

    if (event.key === 'Home' && results.length > 0) {
      event.preventDefault()
      setActiveIndex(0)
      return
    }

    if (event.key === 'End' && results.length > 0) {
      event.preventDefault()
      setActiveIndex(results.length - 1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const result = results[activeIndex]
      if (result) selectResult(result)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch()
    }
  }

  return (
    <div ref={containerRef} className="node-search">
      <button
        className={open ? 'node-search__trigger node-search__trigger--active' : 'node-search__trigger'}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (open) closeSearch()
          else openSearch()
        }}
      >
        Search
        <kbd>Ctrl F</kbd>
      </button>

      {open && (
        <div className="node-search__popover" role="dialog" aria-label="Search nodes">
          <label className="node-search__input-wrap">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="Search node names"
              aria-label="Search node names"
              aria-controls="node-search-results"
              aria-activedescendant={
                results[activeIndex] ? `node-search-result-${activeIndex}` : undefined
              }
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            {query && (
              <button
                className="node-search__clear"
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
              >
                ×
              </button>
            )}
          </label>

          <div className="node-search__summary">
            <span>
              {results.length} {results.length === 1 ? 'match' : 'matches'}
            </span>
            <small>↑↓ choose · Enter focus · Esc close</small>
          </div>

          <div id="node-search-results" className="node-search__results" role="listbox">
            {results.length === 0 ? (
              <div className="node-search__empty">No node names match “{query.trim()}”.</div>
            ) : (
              results.map((result, index) => {
                const previewStyle = {
                  '--search-node-progress': `${Math.round(result.progress * 360)}deg`,
                  '--search-node-glow': `${6 + Math.round(result.momentum * 0.14)}px`,
                  '--search-node-glow-opacity': 0.18 + result.momentum * 0.006
                } as CSSProperties

                return (
                  <button
                    key={result.id}
                    ref={(element) => {
                      resultRefs.current[index] = element
                    }}
                    id={`node-search-result-${index}`}
                    className={`node-search__result ${index === activeIndex ? 'node-search__result--active' : ''}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectResult(result)}
                  >
                    <span
                      className={`node-search__preview node--accent-${result.accent} ${result.root ? 'node-search__preview--root' : ''}`}
                      style={previewStyle}
                      aria-hidden="true"
                    >
                      <span>{result.title.trim().charAt(0).toUpperCase() || '•'}</span>
                    </span>
                    <span className="node-search__result-copy">
                      <strong>{result.title}</strong>
                      <small>
                        {result.root
                          ? `Root node · Rank ${result.level}`
                          : `${result.rootTitle} · Level ${result.level}/${result.maxLevel}`}
                      </small>
                    </span>
                    <span className="node-search__heat">
                      <small>Heat</small>
                      <strong>{Math.round(result.momentum)}</strong>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function nameMatchRank(title: string, normalizedQuery: string): number {
  if (!normalizedQuery) return 1

  const normalizedTitle = normalizeSearchText(title)
  if (normalizedTitle === normalizedQuery) return 0

  const queryParts = normalizedQuery.split(' ').filter(Boolean)
  if (queryParts.every((part) => normalizedTitle.includes(part))) return 1

  return Number.POSITIVE_INFINITY
}
