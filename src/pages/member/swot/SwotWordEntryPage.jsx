import { useState, useRef, useEffect } from 'react'
import { Card, Steps, Button, AutoComplete, Input, List, Space, message, Popconfirm, Alert, Typography } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getMySwotEntries, submitSwotWord, deleteSwotWord, suggestSynonyms, submitFullSwot,
} from '../../../api/swot'
import QuadrantBadge from '../../../components/swot/QuadrantBadge'

const { Paragraph } = Typography

const QUADRANTS = ['STRENGTH', 'WEAKNESS', 'OPPORTUNITY', 'THREAT']
const MIN_WORDS = 3 // mirrors the backend default (app.swot.min-words-per-quadrant)

const QUADRANT_LABEL_KEYS = {
  STRENGTH: 'swot.quadrantStrength',
  WEAKNESS: 'swot.quadrantWeakness',
  OPPORTUNITY: 'swot.quadrantOpportunity',
  THREAT: 'swot.quadrantThreat',
}

const QUADRANT_PROMPT_KEYS = {
  STRENGTH: 'swot.promptStrength',
  WEAKNESS: 'swot.promptWeakness',
  OPPORTUNITY: 'swot.promptOpportunity',
  THREAT: 'swot.promptThreat',
}

export default function SwotWordEntryPage() {
  const { t } = useTranslation()
  const { strategyId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [step, setStep] = useState(0)
  const [word, setWord] = useState('')
  const [justification, setJustification] = useState('')
  const [synonymOptions, setSynonymOptions] = useState([])
  const debounceRef = useRef(null)

  const quadrant = QUADRANTS[step]
  const entriesKey = ['swot-entries', strategyId]

  const { data: entries = [] } = useQuery({
    queryKey: entriesKey,
    queryFn: () => getMySwotEntries(strategyId),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: entriesKey })

  const addMut = useMutation({
    mutationFn: (payload) => submitSwotWord(strategyId, payload),
    onSuccess: () => { setWord(''); setJustification(''); setSynonymOptions([]); refresh() },
    onError: (err) => message.error(err.response?.data?.message || t('swot.addWordFailed')),
  })

  const deleteMut = useMutation({
    mutationFn: (entryId) => deleteSwotWord(strategyId, entryId),
    onSuccess: refresh,
  })

  const submitMut = useMutation({
    mutationFn: () => submitFullSwot(strategyId),
    onSuccess: () => { message.success(t('swot.submittedSuccess')); navigate(`/strategies/${strategyId}/swot`) },
    onError: (err) => message.error(err.response?.data?.message || t('swot.submitFailed')),
  })

  const countFor = (q) => entries.filter((e) => e.quadrant === q).length
  const wordsFor = (q) => entries.filter((e) => e.quadrant === q)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (word.trim().length < 3) { setSynonymOptions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const synonyms = await suggestSynonyms(strategyId, { quadrant, partialWord: word.trim() })
        setSynonymOptions((synonyms || []).map((s) => ({ value: s })))
      } catch {
        setSynonymOptions([])
      }
    }, 350)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, quadrant])

  const handleAdd = () => {
    if (!word.trim() || !justification.trim()) {
      message.warning(t('swot.enterWordAndJustification'))
      return
    }
    addMut.mutate({ quadrant, word: word.trim(), justification: justification.trim() })
  }

  const canAdvanceFrom = (index) => countFor(QUADRANTS[index]) >= MIN_WORDS
  const isInternalToExternalBoundary = step === 1 // moving from WEAKNESS -> OPPORTUNITY

  const handleNext = () => {
    if (isInternalToExternalBoundary && !(canAdvanceFrom(0) && canAdvanceFrom(1))) {
      message.warning(t('swot.needMinWordsBothInternal', { min: MIN_WORDS }))
      return
    }
    if (!canAdvanceFrom(step)) {
      message.warning(t('swot.needMinWordsThisQuadrant', { min: MIN_WORDS, quadrant: t(QUADRANT_LABEL_KEYS[quadrant]) }))
      return
    }
    setStep((s) => Math.min(s + 1, QUADRANTS.length))
  }

  const allMinMet = QUADRANTS.every((q) => countFor(q) >= MIN_WORDS)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Button type="text" icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/strategies/${strategyId}/swot`)}
        style={{ marginBottom: 16, color: '#6b7280' }}>
        {t('swot.backToOverview')}
      </Button>

      <Card>
        <Steps
          current={step}
          size="small"
          onChange={(i) => { if (i <= step || canAdvanceFrom(step)) setStep(i) }}
          items={QUADRANTS.map((q) => ({ title: t(QUADRANT_LABEL_KEYS[q]) }))}
          style={{ marginBottom: 20 }}
        />

        {step === 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('swot.startInternalTitle')}
            description={t('swot.startInternalDescription')}
          />
        )}
        {isInternalToExternalBoundary && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('swot.internalFirstTitle')}
            description={t('swot.internalFirstDescription')}
          />
        )}

        {step < QUADRANTS.length ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <QuadrantBadge quadrant={quadrant} />
              <Paragraph style={{ marginTop: 8 }}>{t(QUADRANT_PROMPT_KEYS[quadrant])}</Paragraph>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                {t('swot.minWordsAdded', { count: countFor(quadrant), min: MIN_WORDS })}
              </Paragraph>
            </div>

            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <AutoComplete
                value={word}
                options={synonymOptions}
                onChange={setWord}
                onSelect={setWord}
                style={{ width: '100%' }}
                placeholder={t('swot.wordInputPlaceholder')}
              />
              <Input.TextArea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t('swot.justificationPlaceholder')}
              />
              <Button type="primary" style={{ background: '#13223a' }} loading={addMut.isPending} onClick={handleAdd}>
                {t('swot.addWordButton')}
              </Button>
            </Space>

            <List
              style={{ marginTop: 16 }}
              size="small"
              dataSource={wordsFor(quadrant)}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button key="del" type="text" danger size="small" icon={<DeleteOutlined />}
                      onClick={() => deleteMut.mutate(item.id)} />,
                  ]}
                >
                  <List.Item.Meta title={item.word} description={item.justification} />
                </List.Item>
              )}
            />

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Button disabled={step === 0} onClick={() => setStep((s) => Math.max(s - 1, 0))}>{t('swot.backButton')}</Button>
              <Button type="primary" style={{ background: '#13223a' }} onClick={handleNext}>
                {step === QUADRANTS.length - 1 ? t('swot.reviewAndSubmit') : t('swot.nextButton')}
              </Button>
            </div>
          </>
        ) : (
          <div>
            <Paragraph strong>{t('swot.reviewBeforeSubmit')}</Paragraph>
            {QUADRANTS.map((q) => (
              <div key={q} style={{ marginBottom: 16 }}>
                <QuadrantBadge quadrant={q} />
                <ul style={{ marginTop: 8 }}>
                  {wordsFor(q).map((e) => <li key={e.id}>{e.word} — <em>{e.justification}</em></li>)}
                </ul>
              </div>
            ))}
            {!allMinMet && (
              <Alert type="error" showIcon style={{ marginBottom: 16 }}
                message={t('swot.eachQuadrantNeedsMin', { min: MIN_WORDS })} />
            )}
            <Space>
              <Button onClick={() => setStep(QUADRANTS.length - 1)}>{t('swot.backButton')}</Button>
              <Popconfirm
                title={t('swot.submitConfirmTitle')}
                description={t('swot.submitConfirmDescription')}
                onConfirm={() => submitMut.mutate()}
                disabled={!allMinMet}
              >
                <Button type="primary" disabled={!allMinMet} loading={submitMut.isPending}
                  style={{ background: '#13223a' }}>
                  {t('swot.submitButton')}
                </Button>
              </Popconfirm>
            </Space>
          </div>
        )}
      </Card>
    </div>
  )
}
