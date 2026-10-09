import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlignLeft, FileText, GripVertical, ListChecks, Pencil, Video, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterBar, SelectFilter } from '../ui/DataSheet'
import { localizedLabel } from '../../lib/localized'
import type { LessonRecord, LessonType } from '../../lib/programs'

const typeIcons: Record<LessonType, LucideIcon> = {
  pdf: FileText,
  video: Video,
  text: AlignLeft,
  quiz: ListChecks,
}

type LessonSorterProps = {
  lessons: LessonRecord[]
  onReorder: (lessons: LessonRecord[]) => void
  onEdit: (lesson: LessonRecord) => void
}

export function LessonSorter({ lessons, onReorder, onEdit }: LessonSorterProps) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = lessons.findIndex((lesson) => lesson.id === active.id)
    const newIndex = lessons.findIndex((lesson) => lesson.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = [...lessons]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    onReorder(next)
  }

  const shown = lessons.filter((lesson) => {
    const title = localizedLabel(lesson.title, i18n.language).toLowerCase()
    const matchesQuery = title.includes(query.trim().toLowerCase())
    const matchesType = typeFilter === 'all' || lesson.contentType === typeFilter
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'published' ? lesson.isPublished : !lesson.isPublished)
    return matchesQuery && matchesType && matchesStatus
  })

  return (
    <div>
      <FilterBar query={query} onQuery={setQuery} count={shown.length}>
        <SelectFilter
          id="lesson-type"
          label={t('filters.type')}
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: t('filters.all') },
            { value: 'text', label: t('programs.types.text') },
            { value: 'video', label: t('programs.types.video') },
            { value: 'pdf', label: t('programs.types.pdf') },
            { value: 'quiz', label: t('programs.types.quiz') },
          ]}
        />
        <SelectFilter
          id="lesson-status"
          label={t('filters.status')}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: t('filters.all') },
            { value: 'published', label: t('programs.published') },
            { value: 'draft', label: t('programs.draft') },
          ]}
        />
      </FilterBar>
      {lessons.length > 0 && shown.length === 0 ? <p className="mb-3 text-muted">{t('filters.noMatch')}</p> : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={shown.map((lesson) => lesson.id)} strategy={verticalListSortingStrategy}>
          <div className="ui-card overflow-auto p-0">
            <table className="ui-grid">
              <thead>
                <tr>
                  <th>{t('programs.reorder')}</th>
                  <th>{t('programs.name')}</th>
                  <th>{t('filters.type')}</th>
                  <th>{t('filters.status')}</th>
                  <th>{t('teacher.action')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((lesson) => (
                  <SortableLesson key={lesson.id} lesson={lesson} onEdit={onEdit} />
                ))}
              </tbody>
            </table>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableLesson({ lesson, onEdit }: { lesson: LessonRecord; onEdit: (lesson: LessonRecord) => void }) {
  const { t, i18n } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lesson.id })
  const Icon = typeIcons[lesson.contentType]
  const title = localizedLabel(lesson.title, i18n.language) || t('programs.untitled')

  return (
    <tr
      ref={setNodeRef}
      className="ui-row"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={() => onEdit(lesson)}
    >
      <td>
        <button
          type="button"
          className="ui-btn ui-btn-ghost"
          aria-label={t('programs.reorder')}
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      </td>
      <td className="font-medium text-ink">
        <span className="inline-flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-accent" />
          {title}
        </span>
      </td>
      <td>{t(`programs.types.${lesson.contentType}`)}</td>
      <td>{lesson.isPublished ? t('programs.published') : t('programs.draft')}</td>
      <td>
        <button type="button" className="ui-inline ui-btn-ghost" onClick={(event) => { event.stopPropagation(); onEdit(lesson) }}>
          <Pencil aria-hidden="true" className="size-4" />
          {t('programs.edit')}
        </button>
      </td>
    </tr>
  )
}
