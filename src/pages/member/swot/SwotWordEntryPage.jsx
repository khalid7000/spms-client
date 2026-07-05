import { useState, useRef, useEffect } from 'react'
import { Card, Steps, Button, AutoComplete, Input, List, Space, message, Popconfirm, Alert, Typography } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getMySwotEntries, submitSwotWord, deleteSwotWord, suggestSynonyms, submitFullSwot,
} from '../../../api/swot'
import QuadrantBadge from '../../../components/swot/QuadrantBadge'

const { Paragraph } = Typography

const QUADRANTS = ['STRENGTH', 'WEAKNESS', 'OPPORTUNITY', 'THREAT']
const MIN_WORDS = 3 // mirrors the backend default (app.swot.min-words-per-quadrant)

const QUADRANT_PROMPTS = {
  STRENGTH: 'What does this organization do well? (internal)',
  WEAKNESS: 'Where does this organization fall short? (internal)',
  OPPORTUNITY: 'What external trends or openings could this organization pursue?',
  THREAT: 'What external risks or pressures could hurt this organization?',
}

export default function SwotWordEntryPage() {
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
    onError: (err) => message.error(err.response?.data?.message || 'Could not add word'),
  })

  const deleteMut = useMutation({
    mutationFn: (entryId) => deleteSwotWord(strategyId, entryId),
    onSuccess: refresh,
  })

  const submitMut = useMutation({
    mutationFn: () => submitFullSwot(strategyId),
    onSuccess: () => { message.success('SWOT analysis submitted'); navigate(`/strategies/${strategyId}/swot`) },
    onError: (err) => message.error(err.response?.data?.message || 'Submission failed'),
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
      message.warning('Enter a word and a one-sentence justification')
      return
    }
    addMut.mutate({ quadrant, word: word.trim(), justification: justification.trim() })
  }

  const canAdvanceFrom = (index) => countFor(QUADRANTS[index]) >= MIN_WORDS
  const isInternalToExternalBoundary = step === 1 // moving from WEAKNESS -> OPPORTUNITY

  const handleNext = () => {
    if (isInternalToExternalBoundary && !(canAdvanceFrom(0) && canAdvanceFrom(1))) {
      message.warning(`Add at least ${MIN_WORDS} words to both Strength and Weakness before moving to external factors`)
      return
    }
    if (!canAdvanceFrom(step)) {
      message.warning(`Add at least ${MIN_WORDS} words to ${quadrant} before continuing`)
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
        Back to SWOT Overview
      </Button>

      <Card>
        <Steps
          current={step}
          size="small"
          onChange={(i) => { if (i <= step || canAdvanceFrom(step)) setStep(i) }}
          items={QUADRANTS.map((q) => ({ title: q.charAt(0) + q.slice(1).toLowerCase() }))}
          style={{ marginBottom: 20 }}
        />

        {step === 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Start internal, then go external"
            description="Work through Strengths and Weaknesses (what's happening inside the organization) before moving on to Opportunities and Threats (external factors)."
          />
        )}
        {isInternalToExternalBoundary && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Internal factors first"
            description="You must add enough Strengths and Weaknesses before continuing to Opportunities and Threats."
          />
        )}

        {step < QUADRANTS.length ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <QuadrantBadge quadrant={quadrant} />
              <Paragraph style={{ marginTop: 8 }}>{QUADRANT_PROMPTS[quadrant]}</Paragraph>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                {countFor(quadrant)} / {MIN_WORDS} minimum words added
              </Paragraph>
            </div>

            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <AutoComplete
                value={word}
                options={synonymOptions}
                onChange={setWord}
                onSelect={setWord}
                style={{ width: '100%' }}
                placeholder="Type a word or short phrase — synonyms will appear as you type"
              />
              <Input.TextArea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="One sentence: why is this a good description?"
              />
              <Button type="primary" style={{ background: '#13223a' }} loading={addMut.isPending} onClick={handleAdd}>
                Add Word
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
              <Button disabled={step === 0} onClick={() => setStep((s) => Math.max(s - 1, 0))}>Back</Button>
              <Button type="primary" style={{ background: '#13223a' }} onClick={handleNext}>
                {step === QUADRANTS.length - 1 ? 'Review & Submit' : 'Next'}
              </Button>
            </div>
          </>
        ) : (
          <div>
            <Paragraph strong>Review your SWOT analysis before submitting.</Paragraph>
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
                message={`Each quadrant needs at least ${MIN_WORDS} words before you can submit.`} />
            )}
            <Space>
              <Button onClick={() => setStep(QUADRANTS.length - 1)}>Back</Button>
              <Popconfirm
                title="Submit your SWOT analysis?"
                description="You won't be able to add more words after this."
                onConfirm={() => submitMut.mutate()}
                disabled={!allMinMet}
              >
                <Button type="primary" disabled={!allMinMet} loading={submitMut.isPending}
                  style={{ background: '#13223a' }}>
                  Submit SWOT Analysis
                </Button>
              </Popconfirm>
            </Space>
          </div>
        )}
      </Card>
    </div>
  )
}
