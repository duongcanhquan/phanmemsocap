import { ArrowLeft, Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { EnrollmentManager } from '../../components/admin/EnrollmentManager'
import { ReportExport } from '../../components/ReportExport'
import { LessonModal } from '../../components/admin/LessonModal'
import { LessonSorter } from '../../components/admin/LessonSorter'
import { LocalizedFields } from '../../components/admin/LocalizedFields'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { useAuth } from '../../hooks/useAuth'
import { emptyLocalized, hasLocalizedText, localizedLabel, type LocalizedText } from '../../lib/localized'
import { isSchoolAdmin } from '../../lib/roles'
import { getProgram, listLessons, saveLessonOrder, updateProgram, type LessonRecord } from '../../lib/programs'

export function ProgramDetail() {
  const { t, i18n } = useTranslation()
  const { role } = useAuth()
  const admin = isSchoolAdmin(role)
  const { programId = '' } = useParams()
  const [title, setTitle] = useState<LocalizedText>(emptyLocalized())
  const [description, setDescription] = useState<LocalizedText>(emptyLocalized())
  const [category, setCategory] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [teacherId, setTeacherId] = useState('')
  const [lessons, setLessons] = useState<LessonRecord[]>([])
  const [editing, setEditing] = useState<LessonRecord | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [tab, setTab] = useState(() => (window.location.hash === '#class' ? 'class' : 'lessons'))

  async function loadLessons() {
    setLessons(await listLessons(programId))
  }

  useEffect(() => {
    let active = true
    void Promise.all([getProgram(programId), listLessons(programId)])
      .then(([program, nextLessons]) => {
        if (!active) return
        if (!program) {
          setMissing(true)
          return
        }
        setTitle(program.title)
        setDescription(program.description)
        setCategory(program.category)
        setCoverImageUrl(program.coverImageUrl)
        setIsActive(program.isActive)
        setTeacherId(program.teacherId)
        setLessons(nextLessons)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [programId, t])

  async function onSave(event: FormEvent) {
    event.preventDefault()
    if (!hasLocalizedText(title)) {
      setError(t('programs.titleRequired'))
      return
    }
    setPending(true)
    setError('')
    setNotice('')
    try {
      await updateProgram(programId, { title, description, category, coverImageUrl, isActive, teacherId })
      setNotice(t('programs.saved'))
    } catch {
      setError(t('programs.saveError'))
    } finally {
      setPending(false)
    }
  }

  async function onReorder(next: LessonRecord[]) {
    const previous = lessons
    setLessons(next)
    try {
      await saveLessonOrder(next)
    } catch {
      setLessons(previous)
      setError(t('programs.saveError'))
    }
  }

  const heading = localizedLabel(title, i18n.language) || t('programs.untitled')

  return (
    <div className="ui-page">
      <Link to={admin ? '/programs' : '/teacher'} className="ui-btn ui-btn-ghost w-fit px-2">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('programs.back')}
      </Link>
      <PageHeader title={heading} />
      {loading ? <p role="status">{t('programs.loading')}</p> : null}
      {missing ? <p role="status">{t('programs.missing')}</p> : null}
      {!loading && !missing ? (
        <>
          <Tabs
            label={t('panels.label')}
            value={tab}
            onChange={setTab}
            tabs={[
              ...(admin ? [{ id: 'info', label: t('panels.info') }] : []),
              { id: 'lessons', label: t('panels.lessons') },
              { id: 'class', label: t('panels.class') },
              { id: 'report', label: t('panels.report') },
            ]}
          />
          <div className="ui-fill">
          {admin && tab === 'info' ? (
          <form className="ui-card grid gap-4 lg:grid-cols-2" onSubmit={(event) => void onSave(event)}>
            <LocalizedFields id="program-title" label={t('programs.name')} value={title} onChange={setTitle} />
            <LocalizedFields
              id="program-description"
              label={t('programs.description')}
              value={description}
              onChange={setDescription}
              multiline
            />
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="program-category">
              {t('programs.category')}
              <input
                id="program-category"
                className="ui-field"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="program-cover">
              {t('programs.cover')}
              <input
                id="program-cover"
                className="ui-field"
                value={coverImageUrl}
                onChange={(event) => setCoverImageUrl(event.target.value)}
              />
            </label>
            {coverImageUrl ? (
              <img src={coverImageUrl} alt="" className="aspect-video max-w-sm rounded-xl object-cover" />
            ) : null}
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              {isActive ? t('programs.active') : t('programs.inactive')}
            </label>
            {notice ? (
              <p role="status" className="text-sm font-medium text-ink">
                {notice}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <button type="submit" className="ui-btn ui-btn-primary w-fit lg:col-span-2" disabled={pending}>
              {pending ? t('programs.saving') : t('programs.save')}
            </button>
          </form>
          ) : null}
          {tab === 'lessons' ? (
          <section className="ui-card grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">{t('programs.lessons')}</h2>
              <button type="button" className="ui-inline ui-btn-primary" onClick={() => setEditing(null)}>
                <Plus aria-hidden="true" className="size-4" />
                {t('programs.addLesson')}
              </button>
            </div>
            {lessons.length === 0 ? <p className="text-sm text-muted">{t('programs.lessonEmpty')}</p> : null}
            <LessonSorter lessons={lessons} onReorder={(next) => void onReorder(next)} onEdit={setEditing} />
          </section>
          ) : null}
          {tab === 'class' ? <EnrollmentManager programId={programId} /> : null}
          {tab === 'report' ? <ReportExport key={programId} programId={programId} /> : null}
          </div>
        </>
      ) : null}
      {editing !== undefined ? (
        <LessonModal
          programId={programId}
          lesson={editing}
          nextOrder={lessons.length}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            void loadLessons().catch(() => setError(t('programs.loadError')))
          }}
        />
      ) : null}
    </div>
  )
}
