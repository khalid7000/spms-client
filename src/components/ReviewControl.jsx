import { useEffect, useState } from 'react'
import { Radio, Input, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

const { Text } = Typography

export const ALL_REVIEW_ACTION_KEYS = [
  { value: 'REJECT', labelKey: 'review.actionReject' },
  { value: 'APPROVE_AS_IS', labelKey: 'review.actionApproveAsIs' },
  { value: 'APPROVE_WITH_EDITS', labelKey: 'review.actionApproveWithEdits' },
  { value: 'PROPOSE_ALTERNATIVE', labelKey: 'review.actionProposeAlternative' },
]

/**
 * Shared per-item review control: a button-style radio group choosing one of up to four review
 * actions, with an inline edit form when "approve with edits" is selected. Originally built for
 * the SWOT suggestion review workflow (see SwotSuggestionsReviewPage) and lifted out here so other
 * review-style workflows (e.g. Employee Goal suggestions) can reuse the exact same interface.
 *
 * Pass `actionKeys` to restrict which choices are offered (e.g. omit REJECT for a stage where the
 * reviewer isn't allowed to reject) or to override a label's translation key for this call site.
 */
export default function ReviewControl({
  targetType, targetId, defaultTitle, defaultDescription, draft, onSave, disabled = false,
  actionKeys = ALL_REVIEW_ACTION_KEYS, alternativeLabelKey = 'review.defaultAlternativeLabel',
}) {
  const { t } = useTranslation()
  const actions = actionKeys.map((a) => ({ value: a.value, label: t(a.labelKey) }))
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
            placeholder={t('review.editedTitlePlaceholder')}
            style={{ marginBottom: 6 }}
          />
          <Input.TextArea
            value={description}
            disabled={disabled}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => onSave(targetType, targetId, { actionType: current.actionType, editedTitle: title, editedDescription: description })}
            rows={2}
            placeholder={t('review.editedDescriptionPlaceholder')}
          />
        </div>
      )}
      {current.actionType === 'PROPOSE_ALTERNATIVE' && (
        <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
          {t(alternativeLabelKey)}
        </Text>
      )}
    </div>
  )
}
