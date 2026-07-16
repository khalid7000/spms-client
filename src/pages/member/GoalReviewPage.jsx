import { useEffect, useState } from 'react'
import { Card, Button, Table, Space, Tag, message, Empty, Spin, Alert, Select, Form, Input, Modal, Typography, Popconfirm } from 'antd'
import { CheckCircleOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../../api/portfolio'
import { getAcademicYears, getMostRecentAcademicYear } from '../../api/academicYears'
import ReviewControl, { ALL_REVIEW_ACTIONS } from '../../components/ReviewControl'
import { useTerminology } from '../../TerminologyContext'

const { Paragraph, Text } = Typography

// Employees cannot reject a goal outright -- they can accept it, accept it with edits, or
// propose an alternative and then submit the whole cycle back to their department head.
const EMPLOYEE_ACTIONS = ALL_REVIEW_ACTIONS.filter((a) => a.value !== 'REJECT')

const STATE_COLORS = {
  DRAFT: 'default',
  LEADER_SUBMITTED: 'processing',
  EMPLOYEE_REVIEW: 'warning',
  EMPLOYEE_SUBMITTED: 'processing',
  DEPLOYED: 'success',
  ARCHIVED: 'default',
}

// A stable reference so `goals` doesn't become a brand-new [] on every render when the query
// is disabled (no cycle yet) -- that would make the effect below depend on an ever-changing
// reference and loop forever, since a disabled query's `data` never settles into a cached value.
const EMPTY_ARRAY = []

export default function GoalReviewPage() {
  const { academicYearLabel, defaultHeadTitleLabel } = useTerminology()
  const [academicYear, setAcademicYear] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [signOpen, setSignOpen] = useState(false)
  const [signForm] = Form.useForm()
  const qc = useQueryClient()

  const { data: academicYears = [], isLoading: yearsLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: getAcademicYears,
  })

  // Default to the most recent year instead of leaving the selector blank.
  useEffect(() => {
    if (!academicYear && academicYears.length > 0) {
      setAcademicYear(getMostRecentAcademicYear(academicYears).id)
    }
  }, [academicYear, academicYears])

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery({
    queryKey: ['my-goal-cycles', academicYear],
    queryFn: () => api.getMyCycles(academicYear),
    enabled: !!academicYear,
  })
  const cycle = cycles[0]

  const { data: goals = EMPTY_ARRAY, isLoading: goalsLoading } = useQuery({
    queryKey: ['my-goal-cycle-goals', cycle?.id],
    queryFn: () => api.getCycleGoals(cycle.id),
    enabled: !!cycle && cycle.state !== 'DRAFT' && cycle.state !== 'LEADER_SUBMITTED',
  })

  useEffect(() => {
    const map = {}
    for (const g of goals) {
      if (g.employeeActionType) {
        map[g.id] = { actionType: g.employeeActionType, editedTitle: g.employeeEditedTitle, editedDescription: g.employeeEditedDescription }
      }
    }
    setDrafts(map)
  }, [goals])

  const startReviewMut = useMutation({
    mutationFn: () => api.startEmployeeReview(cycle.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-goal-cycles', academicYear] })
      qc.invalidateQueries({ queryKey: ['my-goal-cycle-goals', cycle.id] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not start review'),
  })

  const reviewGoalMut = useMutation({
    mutationFn: ({ goalId, payload }) => api.reviewGoal(cycle.id, goalId, payload),
    onError: (err) => message.error(err.response?.data?.message || 'Could not save review'),
  })

  const handleSave = (_targetType, goalId, payload) => {
    setDrafts((prev) => ({ ...prev, [goalId]: payload }))
    reviewGoalMut.mutate({ goalId, payload })
  }

  const acceptMut = useMutation({
    mutationFn: (signatureName) => api.acceptCycle(cycle.id, signatureName),
    onSuccess: () => {
      message.success(`Goals accepted, signed, and deployed for the ${academicYearLabel.toLowerCase()}`)
      setSignOpen(false)
      signForm.resetFields()
      qc.invalidateQueries({ queryKey: ['my-goal-cycles', academicYear] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not accept goals'),
  })

  const submitBackMut = useMutation({
    mutationFn: () => api.submitCycleBack(cycle.id),
    onSuccess: () => {
      message.success('Sent back to your department head for more consideration')
      qc.invalidateQueries({ queryKey: ['my-goal-cycles', academicYear] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not submit back'),
  })

  const allReviewed = goals.length > 0 && goals.every((g) => drafts[g.id]?.actionType)

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h1>My Goals</h1>
        <Paragraph type="secondary">
          Review the annual goals your department head has proposed. Accept them as-is or with edits, or send the
          whole set back for more consideration -- you can go back and forth until you're both satisfied.
        </Paragraph>

        <Form layout="inline" style={{ marginBottom: 24 }}>
          <Form.Item label={academicYearLabel}>
            <Select style={{ width: 200 }} placeholder="Select year" value={academicYear} onChange={setAcademicYear}
              loading={yearsLoading} options={academicYears.map((y) => ({ value: y.id, label: y.name }))} />
          </Form.Item>
        </Form>

        {!academicYear && <Empty description={`Select a ${academicYearLabel}`} />}

        {academicYear && cyclesLoading && <Spin />}

        {academicYear && !cyclesLoading && !cycle && (
          <Empty description={`No goals have been set for you yet this ${academicYearLabel.toLowerCase()}`} />
        )}

        {cycle && (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Text strong>{cycle.leaderName}</Text>
              <Tag color={STATE_COLORS[cycle.state]}>{cycle.state}</Tag>
            </Space>

            {cycle.state === 'DRAFT' && (
              <Alert type="info" showIcon message="Your department head is still preparing your goals" />
            )}

            {cycle.state === 'LEADER_SUBMITTED' && (
              <Alert type="info" showIcon
                message="Your department head has submitted goals for your review"
                action={<Button size="small" type="primary" loading={startReviewMut.isPending} onClick={() => startReviewMut.mutate()}>Start Review</Button>} />
            )}

            {cycle.state === 'EMPLOYEE_SUBMITTED' && (
              <Alert type="info" showIcon message="Sent back to your department head for more consideration" />
            )}

            {cycle.state === 'DEPLOYED' && cycle.employeeSignatureName && (
              <Alert type="success" showIcon style={{ marginBottom: 16 }}
                message={`Signed and accepted by ${cycle.employeeSignatureName} on ${new Date(cycle.employeeAcceptedAt).toLocaleDateString()}`} />
            )}

            {(cycle.state === 'EMPLOYEE_REVIEW' || cycle.state === 'DEPLOYED') && (
              goalsLoading ? <Spin /> : goals.length === 0 ? <Empty description="No goals found" /> : (
                <>
                  {goals.map((g) => (
                    <Card key={g.id} size="small" style={{ marginBottom: 12 }} title={<>{g.goalTitle} <Tag>{g.categoryName}</Tag></>}>
                      <Paragraph type="secondary" style={{ marginBottom: cycle.state === 'DEPLOYED' ? 0 : undefined }}>{g.description}</Paragraph>
                      {cycle.state === 'EMPLOYEE_REVIEW' && (
                        <ReviewControl targetType="GOAL" targetId={g.id} defaultTitle={g.goalTitle} defaultDescription={g.description}
                          draft={drafts[g.id]} onSave={handleSave} actions={EMPLOYEE_ACTIONS}
                          alternativeLabel="Edit the title/description above with your proposed alternative, then submit back for more consideration." />
                      )}
                    </Card>
                  ))}

                  {cycle.state === 'EMPLOYEE_REVIEW' && (
                    <Space>
                      <Button type="primary" icon={<CheckCircleOutlined />} disabled={!allReviewed} onClick={() => setSignOpen(true)}>
                        Accept, Sign & Deploy
                      </Button>
                      <Popconfirm title="Submit back for more consideration?" onConfirm={() => submitBackMut.mutate()}>
                        <Button icon={<SendOutlined />} loading={submitBackMut.isPending}>Submit Back to Department {defaultHeadTitleLabel}</Button>
                      </Popconfirm>
                      {!allReviewed && <Text type="secondary" style={{ fontSize: 12 }}>Review every goal above first</Text>}
                    </Space>
                  )}
                </>
              )
            )}
          </>
        )}
      </Card>

      <Modal title="Accept, Sign & Deploy" open={signOpen} onCancel={() => setSignOpen(false)} destroyOnClose
        onOk={() => signForm.submit()} confirmLoading={acceptMut.isPending} okText="Accept, Sign & Deploy">
        <Paragraph type="secondary">
          These goals will be deployed as your active goals for this {academicYearLabel.toLowerCase()}. Type your full name
          below to sign and confirm.
        </Paragraph>
        <Form form={signForm} layout="vertical" onFinish={(values) => acceptMut.mutate(values.signatureName)}>
          <Form.Item name="signatureName" label="Type your name to sign" rules={[{ required: true, message: 'Type your name to sign' }]}>
            <Input placeholder="Your full name" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
