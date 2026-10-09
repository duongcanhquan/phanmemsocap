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
import { useTranslation } from 'react-i18next'
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={lessons.map((lesson) => lesson.id)} strategy={verticalListSortingStrategy}>
        <ul className="grid gap-2">
          {lessons.map((lesson) => (
            <SortableLesson key={lesson.id} lesson={lesson} onEdit={onEdit} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableLesson({ lesson, onEdit }: { lesson: LessonRecord; onEdit: (lesson: LessonRecord) => void }) {
  const { t, i18n } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lesson.id })
  const Icon = typeIcons[lesson.contentType]
  const title = localizedLabel(lesson.title, i18n.language) || t('programs.untitled')

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-2"
    >
      <button
        type="button"
        className="ui-btn ui-btn-ghost"
        aria-label={t('programs.reorder')}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <Icon aria-hidden="true" className="size-5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{title}</p>
        <p className="text-sm text-muted">
          {t(`programs.types.${lesson.contentType}`)} · {lesson.isPublished ? t('programs.published') : t('programs.draft')}
        </p>
      </div>
      <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={() => onEdit(lesson)}>
        <Pencil aria-hidden="true" className="size-4" />
        {t('programs.edit')}
      </button>
    </li>
  )
}
