import { useEffect, useState } from 'react'
import { Radio, Input, Typography } from 'antd'

const { Text } = Typography

export const ALL_REVIEW_ACTIONS = [
  { value: 'REJECT', label: 'Reject' },
  { value: 'APPROVE_AS_IS', label: 'Approve as-is' },
  { value: 'APPROVE_WITH_EDITS', label: 'Approve with edits' },
  { value: 'PROPOSE_ALTERNATIVE', label: 'Prefer a different one' },
]

/**
 * Shared per-item review control: a button-style radio group choosing one of up to four review
 * actions, with an inline edit form when "approve with edits" is selected. Originally built for
 * the SWOT suggestion review workflow (see SwotSuggestionsReviewPage) and lifted out here so other
 * review-style workflows (e.g. Employee Goal suggestions) can reuse the exact same interface.
 *
 * Pass `actions` to restrict which choices are offered (e.g. omit REJECT for a stage where the
 * reviewer isn't allowed to reject).
 */
export default function ReviewControl({
  targetType, targetId, defaultTitle, defaultDescription, draft, onSave, disabled = false,
  actions = ALL_REVIEW_ACTIONS, alternativeLabel = 'Use "Propose a Different One" below to submit your alternative.',
}) {
  const current = draft || {}
  const [title, setTitle] = useState(current.editedTitle ?? defaultTitle)
  const [description, setDescription] = useState(current.editedDescription ?? defaultDescription)

  useEffect(() => {
    setTitle(current.editedTitle ?? defaultTitle)
    setDescription(current.editedDescription ?? defaultDescription)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.actionType])

  return (
    <div style={{ marginTop: 8 }}>
      <Radio.Group
        size="small"
        value={current.actionType}
        options={actions}
        optionType="button"
        disabled={disabled}
        onChange={(e) => onSave(targetType, targetId, { actionType: e.target.value, editedTitle: title, editedDescription: description })}
      />
      {current.actionType === 'APPROVE_WITH_EDITS' && (
        <div style={{ marginTop: 8, maxWidth: 480 }}>
          <Input
            value={title}
            disabled={disabled}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => onSave(targetType, targetId, { actionType: current.actionType, editedTitle: title, editedDescription: description })}
            placeholder="Edited title"
            style={{ marginBottom: 6 }}
          />
          <Input.TextArea
            value={description}
            disabled={disabled}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => onSave(targetType, targetId, { actionType: current.actionType, editedTitle: title, editedDescription: description })}
            rows={2}
            placeholder="Edited description"
          />
        </div>
      )}
      {current.actionType === 'PROPOSE_ALTERNATIVE' && (
        <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
          {alternativeLabel}
        </Text>
      )}
    </div>
  )
}
