import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  listMyMessages,
  listStudentMessages,
  messageKinds,
  sendStudentMessage,
  type MessageKind,
  type StudentMessage,
} from '../../lib/messages'

export function MessageThread({ studentId }: { studentId?: string }) {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<StudentMessage[]>([])
  const [kind, setKind] = useState<MessageKind>('note')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setRows([])
    const load = studentId ? listStudentMessages(studentId) : listMyMessages()
    void load
      .then((next) => {
        if (active) setRows(next)
      })
      .catch(() => {
        if (active) setError(t('messages.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [studentId, t])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!studentId || !body.trim()) return
    setPending(true)
    setError('')
    try {
      await sendStudentMessage(studentId, kind, body)
      setBody('')
      setRows(await listStudentMessages(studentId))
    } catch {
      setError(t('messages.saveError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="grid gap-4">
      {studentId ? (
        <form className="ui-card grid gap-3" onSubmit={(event) => void onSubmit(event)}>
          <h2 className="text-lg font-semibold text-ink">{t('messages.compose')}</h2>
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="message-kind">
            {t('messages.kind')}
            <select id="message-kind" className="ui-field" value={kind} onChange={(event) => setKind(event.target.value as MessageKind)}>
              {messageKinds.map((item) => (
                <option key={item} value={item}>{t(`messages.kinds.${item}`)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="message-body">
            {t('messages.body')}
            <textarea id="message-body" className="min-h-28 rounded-xl border border-sky-200 bg-white px-3 py-2 text-base text-ink" maxLength={2000} value={body} required onChange={(event) => setBody(event.target.value)} />
          </label>
          <button type="submit" className="ui-btn ui-btn-primary w-fit" disabled={pending}>
            {pending ? t('accounts.saving') : t('messages.send')}
          </button>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </form>
      ) : null}
      {loading ? <p className="text-muted">{t('accounts.loading')}</p> : null}
      {!studentId && error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {!loading && rows.length === 0 ? <p className="text-muted">{t('messages.empty')}</p> : null}
      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="ui-card grid gap-1">
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">{t(`messages.kinds.${row.kind}`)}</p>
            <p className="text-sm text-muted">
              {row.teacherName || t('accounts.roles.teacher')} · {new Date(row.createdAt).toLocaleString(i18n.language)}
            </p>
            <p className="whitespace-pre-wrap text-base text-ink">{row.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
